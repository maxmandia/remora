import { app, BrowserWindow, ipcMain, safeStorage, shell } from "electron";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";

import { env } from "./env.ts";
import { getElectronAuthTokenFromDeepLink } from "./auth-deep-link.ts";
import { getSessionCookieFromSetCookieHeader } from "./auth-session-cookie.ts";
import { authChannel, type AuthUser } from "../shared/auth.ts";

type SessionPayload = {
  cookie: string;
};

type PendingAuth = {
  state: string;
  codeVerifier: string;
};

let pendingAuth: PendingAuth | null = null;

export function setupAuthService(getWindow: () => BrowserWindow | null) {
  registerProtocol(getWindow);

  ipcMain.handle(`${authChannel}:get-user`, async () => getCurrentUser());
  ipcMain.handle(`${authChannel}:request-auth`, async () => {
    await requestAuth();
  });
  ipcMain.handle(`${authChannel}:sign-out`, async () => {
    await signOut();
    getWindow()?.webContents.send(`${authChannel}:user-updated`, null);
  });
}

export async function getStoredSessionCookie() {
  const session = await readSession();

  return session?.cookie ?? null;
}

async function requestAuth() {
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

  await shell.openExternal(url.toString());
}

async function authenticateDeepLink(
  url: string,
  getWindow: () => BrowserWindow | null,
) {
  const token = getElectronAuthTokenFromDeepLink(url, {
    protocolScheme: env.DESKTOP_PROTOCOL_SCHEME,
  });

  if (!token) {
    return;
  }

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

    const data = (await response.json()) as {
      token: string;
      user: AuthUser;
    };
    const cookie = getSessionCookieFromResponse(response);

    if (!cookie) {
      throw new Error("Auth token exchange did not return a session cookie");
    }

    await writeSession({
      cookie,
    });

    getWindow()?.webContents.send(`${authChannel}:authenticated`, data.user);
  } catch {
    getWindow()?.webContents.send(`${authChannel}:error`, {
      message: "Unable to complete authentication.",
    });
  }
}

async function getCurrentUser() {
  const session = await readSession();

  if (!session) {
    return null;
  }

  const response = await fetch(authUrl("/get-session"), {
    method: "GET",
    headers: {
      cookie: session.cookie,
      "content-type": "application/json",
      "electron-origin": desktopOrigin(),
    },
  });

  if (!response.ok) {
    await clearSession();
    return null;
  }

  const data = (await response.json()) as {
    user?: AuthUser | null;
  } | null;

  const user = data?.user ?? null;

  if (!user) {
    await clearSession();
    return null;
  }

  const refreshedCookie = getSessionCookieFromResponse(response);

  if (refreshedCookie) {
    await writeSession({
      cookie: refreshedCookie,
    });
  }

  return user;
}

async function signOut() {
  const session = await readSession();

  if (session) {
    await fetch(authUrl("/sign-out"), {
      method: "POST",
      headers: {
        cookie: session.cookie,
        "content-type": "application/json",
        "electron-origin": desktopOrigin(),
      },
      body: "{}",
    }).catch(() => undefined);
  }

  await clearSession();
}

function registerProtocol(getWindow: () => BrowserWindow | null) {
  if (process.defaultApp) {
    app.setAsDefaultProtocolClient(
      env.DESKTOP_PROTOCOL_SCHEME,
      process.execPath,
      [process.argv[1] ?? ""],
    );
  } else {
    app.setAsDefaultProtocolClient(env.DESKTOP_PROTOCOL_SCHEME);
  }

  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }

  app.on("second-instance", (_event, commandLine) => {
    focusWindow(getWindow());

    const url = commandLine.find((item) =>
      item.startsWith(`${env.DESKTOP_PROTOCOL_SCHEME}:`),
    );

    if (url) {
      void authenticateDeepLink(url, getWindow);
    }
  });

  app.on("open-url", (event, url) => {
    event.preventDefault();
    focusWindow(getWindow());
    void authenticateDeepLink(url, getWindow);
  });

  app.whenReady().then(() => {
    const launchUrl = process.argv.find((item) =>
      item.startsWith(`${env.DESKTOP_PROTOCOL_SCHEME}:`),
    );

    if (launchUrl) {
      void authenticateDeepLink(launchUrl, getWindow);
    }
  });
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

    return JSON.parse(value) as SessionPayload;
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

function getSessionCookieFromResponse(response: Response) {
  const getSetCookie = (
    response.headers as Headers & {
      getSetCookie?: () => string[];
    }
  ).getSetCookie;
  const setCookieHeaders = getSetCookie?.call(response.headers);

  return getSessionCookieFromSetCookieHeader(
    setCookieHeaders && setCookieHeaders.length > 0
      ? setCookieHeaders
      : response.headers.get("set-cookie"),
  );
}

function base64Url(value: Buffer) {
  return value.toString("base64url");
}
