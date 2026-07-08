import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerZIP } from "@electron-forge/maker-zip";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { parseDesktopEnv } from "@remora/env";
import path from "node:path";

const desktopEnv = parseDesktopEnv(process.env);
const releaseVersion = process.env.RELEASE_VERSION?.trim() || null;
const releaseArch = process.env.ARCH?.trim() || process.arch;
const releaseUpdateBaseUrl =
  desktopEnv.DESKTOP_CHANNEL === "local" ||
  !desktopEnv.DESKTOP_RELEASE_PUBLIC_BASE_URL
    ? null
    : [
        desktopEnv.DESKTOP_RELEASE_PUBLIC_BASE_URL,
        desktopEnv.DESKTOP_CHANNEL,
        "darwin",
        releaseArch,
      ].join("/");
const releaseSigningConfig =
  desktopEnv.DESKTOP_CHANNEL !== "local" && process.platform === "darwin"
    ? {
        keychain: requireEnv("APPLE_KEYCHAIN_PATH"),
        identity: requireEnv("APPLE_SIGNING_IDENTITY"),
      }
    : undefined;

function requireEnv(key: string): string {
  const value = process.env[key]?.trim();

  if (!value) {
    throw new Error(`${key} is required for desktop release builds`);
  }

  return value;
}

const config: ForgeConfig = {
  hooks: {
    readPackageJson: async (_forgeConfig, packageJson) => ({
      ...packageJson,
      productName: desktopEnv.DESKTOP_APP_NAME,
      ...(releaseVersion ? { version: releaseVersion } : {}),
    }),
  },
  packagerConfig: {
    appBundleId: desktopEnv.DESKTOP_BUNDLE_ID,
    ...(releaseVersion ? { appVersion: releaseVersion } : {}),
    asar: true,
    extraResource: [path.resolve(__dirname, "assets/icon.png")],
    icon: path.resolve(__dirname, "assets/icon"),
    name: desktopEnv.DESKTOP_APP_NAME,
    ...(releaseSigningConfig ? { osxSign: releaseSigningConfig } : {}),
    protocols: [
      {
        name: desktopEnv.DESKTOP_APP_NAME,
        schemes: [desktopEnv.DESKTOP_PROTOCOL_SCHEME],
      },
    ],
  },
  makers: [
    new MakerZIP(
      releaseUpdateBaseUrl
        ? { macUpdateManifestBaseUrl: releaseUpdateBaseUrl }
        : {},
      ["darwin"],
    ),
  ],
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
