import { electronProxyClient } from "@better-auth/electron/proxy";
import { adminClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { apiOrigin } from "./api-origin";

const desktopProtocolScheme = getDesktopProtocolScheme();
const adminPluginClient: ReturnType<typeof adminClient<{}>> = adminClient();
const electronProxy = electronProxyClient({
  protocol: {
    scheme: desktopProtocolScheme,
  },
  clientID: "electron",
});

const authClientOptions = {
  baseURL: apiOrigin,
  fetchOptions: {
    credentials: "include" as const,
  },
  plugins: [adminPluginClient, electronProxy] as [
    typeof adminPluginClient,
    typeof electronProxy,
  ],
};

type RemoraAuthClient = ReturnType<
  typeof createAuthClient<typeof authClientOptions>
>;

export const authClient: RemoraAuthClient = createAuthClient(authClientOptions);

function getDesktopProtocolScheme() {
  const scheme = import.meta.env.VITE_DESKTOP_PROTOCOL_SCHEME;

  if (!scheme) {
    throw new Error("VITE_DESKTOP_PROTOCOL_SCHEME is required.");
  }

  return scheme;
}
