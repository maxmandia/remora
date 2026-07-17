import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Plugin } from "vite";

import { parseModelPageFrontmatter } from "../src/lib/seo/model-page-frontmatter";

const publicModuleId = "virtual:model-page-metadata";
const resolvedModuleId = `\0${publicModuleId}`;
const modelsDirectory = fileURLToPath(
  new URL("../src/content/models", import.meta.url),
);

export function modelPageMetadataPlugin(): Plugin {
  return {
    name: "remora-model-page-metadata",
    configureServer(server) {
      const reloadMetadataForCatalogChange = (filePath: string) => {
        if (
          path.dirname(filePath) !== modelsDirectory ||
          !filePath.endsWith(".mdx")
        ) {
          return;
        }

        const metadataModule =
          server.moduleGraph.getModuleById(resolvedModuleId);
        if (metadataModule) {
          server.moduleGraph.invalidateModule(metadataModule);
        }
        server.ws.send({ type: "full-reload" });
      };

      server.watcher.on("add", reloadMetadataForCatalogChange);
      server.watcher.on("unlink", reloadMetadataForCatalogChange);
      server.httpServer?.once("close", () => {
        server.watcher.off("add", reloadMetadataForCatalogChange);
        server.watcher.off("unlink", reloadMetadataForCatalogChange);
      });
    },
    resolveId(id) {
      return id === publicModuleId ? resolvedModuleId : null;
    },
    async load(id) {
      if (id !== resolvedModuleId) {
        return null;
      }

      const fileNames = (await readdir(modelsDirectory))
        .filter((fileName) => fileName.endsWith(".mdx"))
        .sort((left, right) => left.localeCompare(right));
      const metadataEntries = await Promise.all(
        fileNames.map(async (fileName) => {
          const filePath = path.join(modelsDirectory, fileName);
          this.addWatchFile(filePath);
          const source = await readFile(filePath, "utf8");

          return [
            `../../content/models/${fileName}`,
            parseModelPageFrontmatter(source, filePath),
          ] as const;
        }),
      );

      return `export default ${JSON.stringify(Object.fromEntries(metadataEntries))};`;
    },
    handleHotUpdate(context) {
      if (
        path.dirname(context.file) !== modelsDirectory ||
        !context.file.endsWith(".mdx")
      ) {
        return;
      }

      const metadataModule =
        context.server.moduleGraph.getModuleById(resolvedModuleId);
      if (!metadataModule) {
        return;
      }

      context.server.moduleGraph.invalidateModule(metadataModule);
      return [metadataModule];
    },
  };
}
