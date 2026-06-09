import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: false,
    outDir: ".vite/preload",
    rollupOptions: {
      external: ["electron"],
    },
  },
});
