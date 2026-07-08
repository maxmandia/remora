import { parseDesktopEnv, type DesktopEnv } from "@remora/env";

declare const __REMORA_DESKTOP_BUILD_ENV__: DesktopEnv | undefined;

const buildEnv =
  typeof __REMORA_DESKTOP_BUILD_ENV__ === "undefined"
    ? undefined
    : __REMORA_DESKTOP_BUILD_ENV__;
const serializedBuildEnv = buildEnv
  ? Object.fromEntries(
      Object.entries(buildEnv).map(([key, value]) => [
        key,
        value === null ? undefined : value,
      ]),
    )
  : undefined;

export const env = parseDesktopEnv({
  ...serializedBuildEnv,
  ...process.env,
});
