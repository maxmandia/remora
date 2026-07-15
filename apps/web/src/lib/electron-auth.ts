import { useEffect } from "react";

import { authClient } from "./auth-client";

const electronAuthRequestKeys = [
  "client_id",
  "state",
  "code_challenge",
  "code_challenge_method",
] as const;
const electronAuthTransportKeys = [
  "desktop_callback_port",
  "desktop_callback_nonce",
] as const;
const electronAuthKeys = [
  ...electronAuthRequestKeys,
  ...electronAuthTransportKeys,
] as const;

export type ElectronAuthSearch = Partial<
  Record<(typeof electronAuthKeys)[number], string>
>;

type ElectronRedirectConfig = Parameters<
  typeof authClient.ensureElectronRedirect
>[0];
type ElectronRedirectInterval = ReturnType<
  typeof authClient.ensureElectronRedirect
>;

let activeElectronRedirectInterval: ElectronRedirectInterval | null = null;

export function parseElectronAuthSearch(
  search: Record<string, unknown>,
): ElectronAuthSearch {
  const parsed: ElectronAuthSearch = {};

  for (const key of electronAuthKeys) {
    const value = search[key];

    if (typeof value === "string" && value.length > 0) {
      parsed[key] = value;
    }
  }

  if (!getLoopbackCallback(parsed)) {
    delete parsed.desktop_callback_port;
    delete parsed.desktop_callback_nonce;
  }

  return parsed;
}

export function hasElectronAuthSearch(search: ElectronAuthSearch) {
  return Boolean(search.client_id && search.state && search.code_challenge);
}

export function getElectronFetchOptions(search: ElectronAuthSearch) {
  if (!hasElectronAuthSearch(search)) {
    return undefined;
  }

  return {
    query: Object.fromEntries(
      electronAuthRequestKeys.flatMap((key) =>
        search[key] ? [[key, search[key]]] : [],
      ),
    ),
  };
}

export function restartElectronRedirect(
  search: ElectronAuthSearch = {},
  config?: ElectronRedirectConfig,
) {
  if (activeElectronRedirectInterval) {
    clearInterval(activeElectronRedirectInterval);
  }

  const loopbackCallback = getLoopbackCallback(search);
  activeElectronRedirectInterval = loopbackCallback
    ? startLoopbackRedirect(loopbackCallback, config)
    : authClient.ensureElectronRedirect(config);

  return activeElectronRedirectInterval;
}

export function stopElectronRedirect(interval?: ElectronRedirectInterval) {
  if (interval && activeElectronRedirectInterval !== interval) {
    clearInterval(interval);
    return;
  }

  if (activeElectronRedirectInterval) {
    clearInterval(activeElectronRedirectInterval);
    activeElectronRedirectInterval = null;
  }
}

export function useElectronRedirect(search: ElectronAuthSearch) {
  const callbackPort = search.desktop_callback_port;
  const callbackNonce = search.desktop_callback_nonce;

  useEffect(() => {
    const redirectInterval = restartElectronRedirect({
      ...(callbackPort ? { desktop_callback_port: callbackPort } : {}),
      ...(callbackNonce ? { desktop_callback_nonce: callbackNonce } : {}),
    });

    return () => {
      stopElectronRedirect(redirectInterval);
    };
  }, [callbackNonce, callbackPort]);
}

export async function transferElectronUser(search: ElectronAuthSearch) {
  const fetchOptions = getElectronFetchOptions(search);

  if (!fetchOptions) {
    return;
  }

  await authClient.electron.transferUser({
    fetchOptions,
  });

  restartElectronRedirect(search);
}

export function createLoopbackAuthCallbackUrl(
  search: ElectronAuthSearch,
  authorizationCode: string,
) {
  const callback = getLoopbackCallback(search);

  if (!callback) {
    return null;
  }

  const url = new URL(
    `/callbacks/auth/${encodeURIComponent(callback.nonce)}`,
    `http://127.0.0.1:${callback.port}`,
  );
  url.searchParams.set("token", authorizationCode);

  return url.toString();
}

function getLoopbackCallback(search: ElectronAuthSearch) {
  const port = search.desktop_callback_port;
  const nonce = search.desktop_callback_nonce;

  if (
    !port ||
    !/^[1-9]\d{0,4}$/.test(port) ||
    Number(port) > 65_535 ||
    !nonce ||
    !/^[A-Za-z0-9_-]{43}$/.test(nonce)
  ) {
    return null;
  }

  return { nonce, port };
}

function startLoopbackRedirect(
  callback: { nonce: string; port: string },
  config?: ElectronRedirectConfig,
) {
  const timeout = config?.timeout ?? 10_000;
  const interval = config?.interval ?? 100;
  const startedAt = Date.now();
  const id = setInterval(() => {
    const authorizationCode = authClient.electron.getAuthorizationCode();

    if (authorizationCode) {
      clearInterval(id);
      document.cookie =
        "better-auth.electron=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/";
      const callbackUrl = createLoopbackAuthCallbackUrl(
        {
          desktop_callback_nonce: callback.nonce,
          desktop_callback_port: callback.port,
        },
        authorizationCode,
      );

      if (callbackUrl) {
        window.location.replace(callbackUrl);
      }
      return;
    }

    if (Date.now() - startedAt > timeout) {
      clearInterval(id);
    }
  }, interval);

  return id;
}
