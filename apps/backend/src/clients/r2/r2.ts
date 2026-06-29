import { S3Client } from "@aws-sdk/client-s3";
import { parseR2StorageEnv } from "@remora/env";

export type R2StorageEnv = ReturnType<typeof parseR2StorageEnv>;

export function getR2StorageEnv() {
  return parseR2StorageEnv(process.env);
}

export function createR2S3Client(
  env: R2StorageEnv = getR2StorageEnv(),
) {
  return new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
}
