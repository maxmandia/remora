import { getFileExtension } from "@remora/utils";

type HeicToConverter = (options: {
  blob: Blob;
  quality?: number;
  type: "image/jpeg";
}) => Promise<Blob>;

const heicPreviewQuality = 0.9;

export function isHeicImageFile(file: File) {
  const mimeType = file.type.toLowerCase();
  const extension = getFileExtension(file.name);

  return (
    mimeType === "image/heic" ||
    mimeType === "image/heif" ||
    extension === ".heic" ||
    extension === ".heif"
  );
}

export async function createHeicPreviewObjectUrl(file: File) {
  const convertedBlob = await convertWithHeicTo(file);

  return URL.createObjectURL(convertedBlob);
}

async function convertWithHeicTo(file: File) {
  const heicTo = await importHeicTo();
  const convertedBlob = await heicTo({
    blob: file,
    quality: heicPreviewQuality,
    type: "image/jpeg",
  });

  if (!convertedBlob) {
    throw new Error("HEIC conversion returned no preview blob.");
  }

  return convertedBlob;
}

async function importHeicTo() {
  const { heicTo } = await import("heic-to");

  return heicTo as HeicToConverter;
}
