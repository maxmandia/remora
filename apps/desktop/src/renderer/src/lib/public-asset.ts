export function buildPublicAssetUrl(baseUrl: string, assetPath: string) {
  const normalizedAssetPath = assetPath.replace(/^\/+/, "");

  if (!baseUrl) {
    return normalizedAssetPath;
  }

  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

  return `${normalizedBaseUrl}${normalizedAssetPath}`;
}

export function getPublicAssetUrl(assetPath: string) {
  return buildPublicAssetUrl(import.meta.env.BASE_URL, assetPath);
}
