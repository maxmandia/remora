import { parseDesktopEnv } from "@remora/env";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { createSentryVitePlugins } from "./sentry-vite.ts";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const desktopEnv = parseDesktopEnv(process.env);
const outDir = path.resolve(appDir, ".vite/preload");

export default defineConfig({
  define: {
    __REMORA_DESKTOP_SENTRY_ENABLED__: JSON.stringify(
      Boolean(desktopEnv.DESKTOP_SENTRY_DSN),
    ),
  },
  build: {
    emptyOutDir: false,
    outDir,
    sourcemap: "hidden",
    rollupOptions: {
      external: ["electron"],
    },
  },
  plugins: [...createSentryVitePlugins(outDir)],
});
