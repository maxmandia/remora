import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseDesktopAnalyticsEnv, parseDesktopEnv } from "@remora/env";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import {
  createLogger,
  defineConfig,
  type LogErrorOptions,
  type Logger,
  type LogOptions,
} from "vite";
import { createSentryVitePlugins } from "./sentry-vite.ts";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(appDir, "../..");
const desktopEnv = parseDesktopEnv(process.env);
const analyticsEnv = parseDesktopAnalyticsEnv(process.env);
const outDir = path.resolve(appDir, ".vite/renderer/main_window");
const viteLogger = createLogger();
const remoraWorkspacePackages = [
  "@remora/domain",
  "@remora/form",
  "@remora/realtime",
  "@remora/ui",
  "@remora/utils",
  "@remora/utils/currency",
];
const packageJson = JSON.parse(
  readFileSync(path.join(appDir, "package.json"), "utf8"),
);

function isTailwindMergeSourcemapWarning(message: string) {
  return (
    message.includes("Sourcemap for ") &&
    message.includes("tailwind-merge/dist/bundle-mjs.mjs") &&
    message.includes("points to a source file outside its package")
  );
}

const desktopLogger: Logger = {
  get hasWarned() {
    return viteLogger.hasWarned;
  },
  set hasWarned(value: boolean) {
    viteLogger.hasWarned = value;
  },
  info(message: string, options?: LogOptions) {
    viteLogger.info(message, options);
  },
  warn(message: string, options?: LogOptions) {
    if (isTailwindMergeSourcemapWarning(message)) {
      return;
    }

    viteLogger.warn(message, options);
  },
  warnOnce(message: string, options?: LogOptions) {
    if (isTailwindMergeSourcemapWarning(message)) {
      return;
    }

    viteLogger.warnOnce(message, options);
  },
  error(message: string, options?: LogErrorOptions) {
    viteLogger.error(message, options);
  },
  clearScreen(type) {
    viteLogger.clearScreen(type);
  },
  hasErrorLogged(error) {
    return viteLogger.hasErrorLogged(error);
  },
};

export default defineConfig({
  root: "src/renderer",
  base: "./",
  define: {
    __REMORA_MIXPANEL_PROJECT_TOKEN__: JSON.stringify(
      analyticsEnv.MIXPANEL_PROJECT_TOKEN,
    ),
    __REMORA_DESKTOP_ANALYTICS_CONTEXT__: JSON.stringify({
      appVersion: packageJson.version,
      releaseChannel: desktopEnv.DESKTOP_CHANNEL,
      platform: process.platform,
      architecture: process.env.ARCH?.trim() || process.arch,
    }),
    __REMORA_DESKTOP_SENTRY_ENABLED__: JSON.stringify(
      Boolean(desktopEnv.DESKTOP_SENTRY_DSN),
    ),
  },
  build: {
    emptyOutDir: true,
    outDir,
    sourcemap: "hidden",
  },
  customLogger: desktopLogger,
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    exclude: remoraWorkspacePackages,
    include: [
      "use-sync-external-store/shim",
      "use-sync-external-store/shim/with-selector",
    ],
  },
  server: {
    port: 3001,
    strictPort: true,
    fs: {
      allow: [monorepoRoot],
    },
    watch: {
      ignored: ["**/node_modules/**", "!**/node_modules/@remora/**"],
    },
  },
  plugins: [tailwindcss(), react(), ...createSentryVitePlugins(outDir)],
});
