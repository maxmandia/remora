import { parseDesktopEnv } from "@remora/env";
import { builtinModules } from "node:module";
import { defineConfig } from "vite";

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
    outDir: ".vite/main",
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
});
