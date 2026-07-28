import { electronProxyClient } from "@better-auth/electron/proxy";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { apiOrigin } from "./api-origin";

const desktopProtocolScheme = getDesktopProtocolScheme();
const additionalFieldsClient = inferAdditionalFields({
  user: {
    isAdmin: {
      type: "boolean",
      defaultValue: false,
      input: false,
      required: true,
    },
  },
});
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
  plugins: [additionalFieldsClient, electronProxy] as [
    typeof additionalFieldsClient,
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
