declare module "*.webp" {
  const assetUrl: string;

  export default assetUrl;
}

declare module "*.mp4" {
  const assetUrl: string;

  export default assetUrl;
}

declare module "*.glb?url" {
  const assetUrl: string;

  export default assetUrl;
}
