import { app, BrowserWindow, ipcMain, safeStorage, shell } from "electron";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";

import { env } from "./env.ts";
import type { DesktopCallbackService } from "./desktop-callback-service.ts";
import { getElectronAuthTokenFromDeepLink } from "./auth-deep-link.ts";
import {
  setDesktopObservabilityUser,
  wrapIpcHandler,
} from "./observability.ts";
import {
  applyAuthSetCookieHeaders,
  getAuthCookieHeader,
  normalizeStoredAuthCookieJar,
  type AuthCookieJar,
} from "./auth-session-cookie.ts";
import { getDesktopNavigationTargetFromDeepLink } from "./navigation-deep-link.ts";
import { authChannel, type AuthState } from "../shared/auth.ts";
import type {
  AccountImpersonationSearchField,
  AccountImpersonationUser,
} from "@remora/app/admin";
import {
  navigationChannel,
  type DesktopNavigationTarget,
} from "../shared/navigation.ts";

type SessionPayload = {
  cookies: AuthCookieJar;
};

type PendingAuth = {
  state: string;
  codeVerifier: string;
};

let pendingAuth: PendingAuth | null = null;

export function setupAuthService(
  getWindow: () => BrowserWindow | null,
  callbackService: DesktopCallbackService,
) {
  registerProtocol(getWindow);

  const getStateChannel = `${authChannel}:get-state`;
  const listUsersChannel = `${authChannel}:list-users`;
  const impersonateUserChannel = `${authChannel}:impersonate-user`;
  const stopImpersonatingChannel = `${authChannel}:stop-impersonating`;
  const requestAuthChannel = `${authChannel}:request-auth`;
  const signOutChannel = `${authChannel}:sign-out`;

  ipcMain.handle(
    getStateChannel,
    wrapIpcHandler(getStateChannel, async () => {
      const state = await getCurrentAuthState();

      setDesktopObservabilityUser(getActorUserId(state));

      return state;
    }),
  );
  ipcMain.handle(
    listUsersChannel,
    wrapIpcHandler(
      listUsersChannel,
      async (
        _event,
        input: {
          searchField: AccountImpersonationSearchField;
          searchValue: string;
          limit: number;
          offset: number;
        },
      ) => listUsers(input),
    ),
  );
  ipcMain.handle(
    impersonateUserChannel,
    wrapIpcHandler(impersonateUserChannel, async (_event, userId: string) => {
      const state = await impersonateUser(userId);
      setDesktopObservabilityUser(getActorUserId(state));
      getWindow()?.webContents.send(`${authChannel}:user-updated`, state);

      return state;
    }),
  );
  ipcMain.handle(
    stopImpersonatingChannel,
    wrapIpcHandler(stopImpersonatingChannel, async () => {
      const state = await stopImpersonating();
      setDesktopObservabilityUser(getActorUserId(state));
      getWindow()?.webContents.send(`${authChannel}:user-updated`, state);

      return state;
    }),
  );
  ipcMain.handle(
    requestAuthChannel,
    wrapIpcHandler(requestAuthChannel, async () => {
      await requestAuth(getWindow, callbackService);
    }),
  );
  ipcMain.handle(
    signOutChannel,
    wrapIpcHandler(signOutChannel, async () => {
      await signOut();
      setDesktopObservabilityUser(null);
      getWindow()?.webContents.send(`${authChannel}:user-updated`, null);
    }),
  );
}

export async function getStoredAuthCookieHeader() {
  const session = await readSession();

  return session ? getAuthCookieHeader(session.cookies) : null;
}

async function requestAuth(
  getWindow: () => BrowserWindow | null,
  callbackService: DesktopCallbackService,
) {
  const state = base64Url(randomBytes(16));
  const codeVerifier = base64Url(randomBytes(32));
  const codeChallenge = base64Url(
    createHash("sha256").update(codeVerifier).digest(),
  );
  const url = new URL("/sign-in", env.WEB_ORIGIN);

  pendingAuth = {
    state,
    codeVerifier,
  };

  url.searchParams.set("client_id", "electron");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  if (!app.isPackaged) {
    try {
      const callbackUrl = await callbackService.createAuthCallback(
        async (receivedUrl) => {
          focusWindow(getWindow());
          const token = receivedUrl.searchParams.get("token");

          if (!token) {
            pendingAuth = null;
            getWindow()?.webContents.send(`${authChannel}:error`, {
              message:
                "The sign-in callback was invalid. Try signing in again.",
            });
            return;
          }

          await authenticateToken(token, getWindow);
        },
        () => {
          pendingAuth = null;
          getWindow()?.webContents.send(`${authChannel}:error`, {
            message: "The sign-in callback expired. Try signing in again.",
          });
        },
      );
      const nonce = callbackUrl.pathname.split("/").at(-1);

      if (!nonce) {
        throw new Error("Desktop auth callback did not include a nonce");
      }

      url.searchParams.set("desktop_callback_port", callbackUrl.port);
      url.searchParams.set("desktop_callback_nonce", nonce);
    } catch {
      pendingAuth = null;
      getWindow()?.webContents.send(`${authChannel}:error`, {
        message: "Unable to start the sign-in callback. Try signing in again.",
      });
      return;
    }
  }

  await shell.openExternal(url.toString());
}

async function authenticateDeepLink(
  url: string,
  getWindow: () => BrowserWindow | null,
): Promise<boolean> {
  const token = getElectronAuthTokenFromDeepLink(url, {
    protocolScheme: env.DESKTOP_PROTOCOL_SCHEME,
  });

  if (!token) {
    return false;
  }

  await authenticateToken(token, getWindow);

  return true;
}

async function authenticateToken(
  token: string,
  getWindow: () => BrowserWindow | null,
) {
  if (!pendingAuth) {
    getWindow()?.webContents.send(`${authChannel}:error`, {
      message: "Start sign-in from Remora and try again.",
    });
    return;
  }

  const payload = decodeElectronToken(token);

  if (!payload || payload.state !== pendingAuth.state) {
    pendingAuth = null;
    getWindow()?.webContents.send(`${authChannel}:error`, {
      message: "Authentication state did not match.",
    });
    return;
  }

  const codeVerifier = pendingAuth.codeVerifier;
  pendingAuth = null;

  try {
    const response = await fetch(authUrl("/electron/token"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "electron-origin": desktopOrigin(),
      },
      body: JSON.stringify({
        token: payload.identifier,
        state: payload.state,
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      throw new Error(`Auth token exchange failed with ${response.status}`);
    }

    await response.json();
    const cookies = applyResponseCookies({}, response);

    if (!getAuthCookieHeader(cookies)) {
      throw new Error("Auth token exchange did not return a session cookie");
    }

    await writeSession({ cookies });
    const state = await getCurrentAuthState();

    if (!state) {
      throw new Error("Auth token exchange did not create a session");
    }

    setDesktopObservabilityUser(getActorUserId(state));
    getWindow()?.webContents.send(`${authChannel}:authenticated`, state);
  } catch {
    getWindow()?.webContents.send(`${authChannel}:error`, {
      message: "Unable to complete authentication.",
    });
  }
}

async function getCurrentAuthState() {
  const session = await readSession();

  if (!session) {
    return null;
  }

  const response = await fetch(authUrl("/get-session"), {
    method: "GET",
    headers: {
      cookie: getAuthCookieHeader(session.cookies) ?? "",
      "content-type": "application/json",
      "electron-origin": desktopOrigin(),
    },
  });

  if (!response.ok) {
    await clearSession();
    setDesktopObservabilityUser(null);
    return null;
  }

  const state = (await response.json()) as AuthState | null;

  if (!state?.user || !state.session) {
    await clearSession();
    setDesktopObservabilityUser(null);
    return null;
  }

  const refreshedCookies = applyResponseCookies(session.cookies, response);

  if (getAuthCookieHeader(refreshedCookies)) {
    await writeSession({ cookies: refreshedCookies });
  }

  return state;
}

async function signOut() {
  const session = await readSession();

  if (session) {
    await fetch(authUrl("/sign-out"), {
      method: "POST",
      headers: {
        cookie: getAuthCookieHeader(session.cookies) ?? "",
        "content-type": "application/json",
        "electron-origin": desktopOrigin(),
      },
      body: "{}",
    }).catch(() => undefined);
  }

  await clearSession();
}

async function listUsers(input: {
  searchField: AccountImpersonationSearchField;
  searchValue: string;
  limit: number;
  offset: number;
}) {
  const url = authUrl("/admin/list-users");

  url.searchParams.set("limit", String(input.limit));
  url.searchParams.set("offset", String(input.offset));
  url.searchParams.set("sortBy", "createdAt");
  url.searchParams.set("sortDirection", "desc");
  url.searchParams.set("filterField", "role");
  url.searchParams.set("filterValue", "user");
  url.searchParams.set("filterOperator", "eq");

  if (input.searchValue) {
    url.searchParams.set("searchField", input.searchField);
    url.searchParams.set("searchValue", input.searchValue);
    url.searchParams.set("searchOperator", "contains");
  }

  const response = await authenticatedFetch(url, { method: "GET" });

  if (!response.ok) {
    throw new Error(`Unable to list users (${response.status})`);
  }

  const data = (await response.json()) as {
    users: Array<{
      id: string;
      name: string;
      email: string;
      createdAt: string | Date;
    }>;
    total: number;
  };

  return {
    users: data.users.map(
      (user): AccountImpersonationUser => ({
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: new Date(user.createdAt).toISOString(),
      }),
    ),
    total: data.total,
  };
}

async function impersonateUser(userId: string) {
  const response = await authenticatedFetch(
    authUrl("/admin/impersonate-user"),
    {
      method: "POST",
      body: JSON.stringify({ userId }),
    },
  );

  if (!response.ok) {
    throw new Error(`Unable to impersonate user (${response.status})`);
  }

  return requireCurrentAuthState();
}

async function stopImpersonating() {
  const response = await authenticatedFetch(
    authUrl("/admin/stop-impersonating"),
    {
      method: "POST",
      body: "{}",
    },
  );

  if (!response.ok) {
    throw new Error(`Unable to stop impersonating (${response.status})`);
  }

  return requireCurrentAuthState();
}

async function requireCurrentAuthState() {
  const state = await getCurrentAuthState();

  if (!state) {
    throw new Error("The authentication session is no longer valid");
  }

  return state;
}

async function authenticatedFetch(url: URL, init: RequestInit) {
  const session = await readSession();
  const cookie = session ? getAuthCookieHeader(session.cookies) : null;

  if (!session || !cookie) {
    throw new Error("Authentication is required");
  }

  const response = await fetch(url, {
    ...init,
    headers: {
      ...init.headers,
      cookie,
      "content-type": "application/json",
      "electron-origin": desktopOrigin(),
    },
  });
  const cookies = applyResponseCookies(session.cookies, response);

  if (getAuthCookieHeader(cookies)) {
    await writeSession({ cookies });
  } else {
    await clearSession();
  }

  return response;
}

function registerProtocol(getWindow: () => BrowserWindow | null) {
  if (app.isPackaged) {
    app.setAsDefaultProtocolClient(env.DESKTOP_PROTOCOL_SCHEME);
  }

  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }

  app.on("second-instance", (_event, commandLine) => {
    const url = commandLine.find((item) =>
      item.startsWith(`${env.DESKTOP_PROTOCOL_SCHEME}:`),
    );

    if (url) {
      void handleDeepLink(url, getWindow);
    }
  });

  app.on("open-url", (event, url) => {
    event.preventDefault();
    void handleDeepLink(url, getWindow);
  });

  app.whenReady().then(() => {
    const launchUrl = process.argv.find((item) =>
      item.startsWith(`${env.DESKTOP_PROTOCOL_SCHEME}:`),
    );

    if (launchUrl) {
      void handleDeepLink(launchUrl, getWindow);
    }
  });
}

async function handleDeepLink(
  url: string,
  getWindow: () => BrowserWindow | null,
) {
  focusWindow(getWindow());

  if (await authenticateDeepLink(url, getWindow)) {
    return;
  }

  const navigationTarget = getDesktopNavigationTargetFromDeepLink(url, {
    protocolScheme: env.DESKTOP_PROTOCOL_SCHEME,
  });

  if (navigationTarget) {
    sendNavigationTarget(getWindow, navigationTarget);
  }
}

function sendNavigationTarget(
  getWindow: () => BrowserWindow | null,
  target: DesktopNavigationTarget,
) {
  const window = getWindow();

  if (!window) {
    void app.whenReady().then(() => sendNavigationTarget(getWindow, target));
    return;
  }

  const send = () => {
    window.webContents.send(`${navigationChannel}:navigate`, target);
  };

  if (window.webContents.isLoading()) {
    window.webContents.once("did-finish-load", send);
    return;
  }

  send();
}

function focusWindow(window: BrowserWindow | null) {
  if (!window) {
    return;
  }

  if (window.isMinimized()) {
    window.restore();
  }

  window.focus();
}

function decodeElectronToken(token: string) {
  try {
    const decoded = JSON.parse(
      Buffer.from(decodeURIComponent(token), "base64url").toString("utf8"),
    ) as {
      identifier?: unknown;
      state?: unknown;
    };

    if (
      typeof decoded.identifier !== "string" ||
      typeof decoded.state !== "string"
    ) {
      return null;
    }

    return {
      identifier: decoded.identifier,
      state: decoded.state,
    };
  } catch {
    return null;
  }
}

async function readSession() {
  try {
    const raw = await readFile(sessionPath(), "utf8");
    const parsed = JSON.parse(raw) as {
      encrypted?: boolean;
      value?: unknown;
    };

    if (typeof parsed.value !== "string") {
      return null;
    }

    const value =
      parsed.encrypted && safeStorage.isEncryptionAvailable()
        ? safeStorage.decryptString(Buffer.from(parsed.value, "base64"))
        : parsed.value;

    const cookies = normalizeStoredAuthCookieJar(JSON.parse(value));

    return cookies ? { cookies } : null;
  } catch {
    return null;
  }
}

async function writeSession(payload: SessionPayload) {
  const value = JSON.stringify(payload);
  const encrypted = safeStorage.isEncryptionAvailable();
  const storedValue = encrypted
    ? safeStorage.encryptString(value).toString("base64")
    : value;

  await mkdir(path.dirname(sessionPath()), { recursive: true });
  await writeFile(
    sessionPath(),
    JSON.stringify({
      encrypted,
      value: storedValue,
    }),
    "utf8",
  );
}

async function clearSession() {
  await rm(sessionPath(), { force: true });
}

function sessionPath() {
  return path.join(app.getPath("userData"), "session.json");
}

function authUrl(pathname: string) {
  return new URL(`/api/auth${pathname}`, env.DESKTOP_API_ORIGIN);
}

function desktopOrigin() {
  return `${env.DESKTOP_PROTOCOL_SCHEME}:/`;
}

function applyResponseCookies(cookieJar: AuthCookieJar, response: Response) {
  const getSetCookie = (
    response.headers as Headers & {
      getSetCookie?: () => string[];
    }
  ).getSetCookie;
  const setCookieHeaders = getSetCookie?.call(response.headers);

  return applyAuthSetCookieHeaders(
    cookieJar,
    setCookieHeaders && setCookieHeaders.length > 0
      ? setCookieHeaders
      : response.headers.get("set-cookie"),
  );
}

function getActorUserId(state: AuthState | null) {
  return state?.session.impersonatedBy ?? state?.user.id ?? null;
}

function base64Url(value: Buffer) {
  return value.toString("base64url");
}
