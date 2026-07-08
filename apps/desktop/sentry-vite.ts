import { sentryVitePlugin } from "@sentry/vite-plugin";
import path from "node:path";
import type { PluginOption } from "vite";

import { parseDesktopEnv, parseDesktopSentryBuildEnv } from "@remora/env";

export function createSentryVitePlugins(bundleOutDir: string): PluginOption[] {
  const desktopEnv = parseDesktopEnv(process.env);
  const sentryBuildEnv = parseDesktopSentryBuildEnv(process.env);

  if (!sentryBuildEnv.enabled) {
    return [];
  }

  return sentryVitePlugin({
    authToken: sentryBuildEnv.authToken ?? undefined,
    org: sentryBuildEnv.org ?? undefined,
    project: sentryBuildEnv.project ?? undefined,
    release: {
      name: desktopEnv.SENTRY_RELEASE ?? undefined,
    },
    sourcemaps: {
      filesToDeleteAfterUpload: path.join(bundleOutDir, "**/*.map"),
    },
  });
}
