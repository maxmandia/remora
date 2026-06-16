import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const config = defineConfig({
  resolve: {
    dedupe: ["react", "react-dom"],
    tsconfigPaths: true,
  },
  ssr: {
    noExternal: [
      "@remora/form",
      "@tanstack/form-core",
      "@tanstack/react-form",
      "@tanstack/react-store",
      "@tanstack/store",
    ],
  },
  plugins: [devtools(), tailwindcss(), tanstackStart(), viteReact()],
});

export default config;
