import { defineConfig, type Plugin } from "vite";
import mdx from "@mdx-js/rollup";
import { devtools } from "@tanstack/devtools-vite";
import remarkFrontmatter from "remark-frontmatter";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

import { modelPageMetadataPlugin } from "./build/model-page-metadata";

const baseMdxPlugin = mdx({
  remarkPlugins: [remarkFrontmatter],
});
const mdxPlugin = {
  ...baseMdxPlugin,
  enforce: "pre",
  transform(value: string, id: string) {
    if (new URLSearchParams(id.split("?", 2)[1]).has("raw")) {
      return null;
    }

    return baseMdxPlugin.transform(value, id);
  },
} as Plugin;

const config = defineConfig({
  envDir: "../..",
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
  plugins: [
    modelPageMetadataPlugin(),
    devtools(),
    tailwindcss(),
    mdxPlugin,
    tanstackStart(),
    viteReact({ include: /\.(js|jsx|ts|tsx|md|mdx)$/ }),
  ],
});

export default config;
