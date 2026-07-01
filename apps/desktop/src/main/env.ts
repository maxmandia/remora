import { parseDesktopEnv, type DesktopEnv } from "@remora/env";

declare const __REMORA_DESKTOP_BUILD_ENV__: DesktopEnv | undefined;

const buildEnv =
  typeof __REMORA_DESKTOP_BUILD_ENV__ === "undefined"
    ? undefined
    : __REMORA_DESKTOP_BUILD_ENV__;

export const env = parseDesktopEnv({
  ...buildEnv,
  ...process.env,
});
