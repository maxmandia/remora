import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerZIP } from "@electron-forge/maker-zip";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { parseDesktopEnv } from "@remora/env";
import path from "node:path";

const desktopEnv = parseDesktopEnv(process.env);

const config: ForgeConfig = {
  hooks: {
    readPackageJson: async (_forgeConfig, packageJson) => ({
      ...packageJson,
      productName: desktopEnv.DESKTOP_APP_NAME,
    }),
  },
  packagerConfig: {
    appBundleId: desktopEnv.DESKTOP_BUNDLE_ID,
    asar: true,
    extraResource: [path.resolve(__dirname, "assets/icon.png")],
    icon: path.resolve(__dirname, "assets/icon"),
    name: desktopEnv.DESKTOP_APP_NAME,
    protocols: [
      {
        name: desktopEnv.DESKTOP_APP_NAME,
        schemes: [desktopEnv.DESKTOP_PROTOCOL_SCHEME],
      },
    ],
  },
  makers: [new MakerZIP({}, ["darwin"])],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: "src/main.ts",
          config: "vite.main.config.ts",
          target: "main",
        },
        {
          entry: "src/preload.ts",
          config: "vite.preload.config.ts",
          target: "preload",
        },
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.renderer.config.ts",
        },
      ],
    }),
  ],
};

export default config;
