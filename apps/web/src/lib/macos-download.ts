export type MacosDownload = {
  fileName: string;
  url: string;
};

export function createMacosDownload(
  value: string | undefined = import.meta.env.VITE_MACOS_DOWNLOAD_URL,
): MacosDownload {
  const configuredUrl = value?.trim();

  if (!configuredUrl) {
    throw new Error("VITE_MACOS_DOWNLOAD_URL is required.");
  }

  let url: URL;

  try {
    url = new URL(configuredUrl);
  } catch {
    throw new Error("VITE_MACOS_DOWNLOAD_URL must be a valid URL.");
  }

  if (url.protocol !== "https:") {
    throw new Error("VITE_MACOS_DOWNLOAD_URL must use HTTPS.");
  }

  const fileName = url.pathname.split("/").at(-1);

  if (!fileName?.toLowerCase().endsWith(".dmg")) {
    throw new Error("VITE_MACOS_DOWNLOAD_URL must point to a DMG file.");
  }

  return {
    fileName,
    url: url.toString(),
  };
}
