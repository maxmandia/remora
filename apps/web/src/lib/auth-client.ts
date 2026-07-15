import { electronProxyClient } from "@better-auth/electron/proxy";
import { createAuthClient } from "better-auth/react";

type AuthClient = ReturnType<typeof createAuthClient> & {
  ensureElectronRedirect: (config?: {
    timeout?: number;
    interval?: number;
  }) => ReturnType<typeof setInterval>;
  electron: {
    getAuthorizationCode: () => string | null;
    transferUser: (args: {
      fetchOptions: {
        query: Record<string, string | undefined>;
      };
    }) => Promise<unknown>;
  };
};

const apiOrigin = import.meta.env.VITE_API_ORIGIN ?? "http://localhost:4000";
const desktopProtocolScheme = getDesktopProtocolScheme();

export const authClient = createAuthClient({
  baseURL: apiOrigin,
  fetchOptions: {
    credentials: "include",
  },
  plugins: [
    electronProxyClient({
      protocol: {
        scheme: desktopProtocolScheme,
      },
      clientID: "electron",
    }),
  ],
}) as AuthClient;

function getDesktopProtocolScheme() {
  const scheme = import.meta.env.VITE_DESKTOP_PROTOCOL_SCHEME;

  if (!scheme) {
    throw new Error("VITE_DESKTOP_PROTOCOL_SCHEME is required.");
  }

  return scheme;
}
