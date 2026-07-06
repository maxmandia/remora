import { parseDesktopEnv } from "@remora/env";
import { builtinModules } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { createSentryVitePlugins } from "./sentry-vite.ts";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(appDir, ".vite/main");

const external = [
  "electron",
  "electron/main",
  ...builtinModules,
  ...builtinModules.map((moduleName) => `node:${moduleName}`),
];

export default defineConfig({
  define: {
    __REMORA_DESKTOP_BUILD_ENV__: JSON.stringify(parseDesktopEnv(process.env)),
  },
  build: {
    emptyOutDir: false,
    outDir,
    sourcemap: "hidden",
    target: "node22",
    lib: {
      entry: "src/main.ts",
      formats: ["cjs"],
      fileName: () => "main.js",
    },
    rollupOptions: {
      external,
    },
  },
  resolve: {
    conditions: ["node"],
    mainFields: ["module", "jsnext:main", "jsnext"],
  },
  plugins: [...createSentryVitePlugins(outDir)],
});
