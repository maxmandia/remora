import { z } from "zod";

const portSchema = z.coerce.number().int().min(1).max(65535);
const originSchema = z.string().url();
const protocolSchemeSchema = z
  .string()
  .regex(/^[a-z][a-z0-9+.-]*$/, "Invalid protocol scheme");

const csvSchema = z
  .string()
  .optional()
  .transform((value) =>
    value
      ? value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : [],
  );

const desktopOrigin = (scheme: string) => `${scheme}:/`;

type ClientOriginEnv = {
  WEB_ORIGIN: string;
  DESKTOP_DEV_ORIGIN: string;
  DESKTOP_PROTOCOL_SCHEME: string;
};

const defaultClientOrigins = (env: ClientOriginEnv) => [
  env.WEB_ORIGIN,
  env.DESKTOP_DEV_ORIGIN,
  desktopOrigin(env.DESKTOP_PROTOCOL_SCHEME),
];

const clientOrigins = (env: ClientOriginEnv, extraOrigins: string[]) => [
  ...new Set([...defaultClientOrigins(env), ...extraOrigins]),
];

export const parseBackendHttpEnv = (env: NodeJS.ProcessEnv) =>
  z
    .object({
      API_PORT: portSchema.default(4000),
      API_PUBLIC_ORIGIN: originSchema.default("http://localhost:4000"),
      WEB_ORIGIN: originSchema.default("http://localhost:3000"),
      DESKTOP_DEV_ORIGIN: originSchema.default("http://localhost:3001"),
      DESKTOP_PROTOCOL_SCHEME:
        protocolSchemeSchema.default("app.remora.desktop"),
      API_CORS_ORIGINS: csvSchema,
    })
    .transform((parsed) => ({
      ...parsed,
      API_CORS_ORIGINS: clientOrigins(parsed, parsed.API_CORS_ORIGINS),
    }))
    .parse(env);

export const parseBackendAuthEnv = (env: NodeJS.ProcessEnv) =>
  z
    .object({
      BETTER_AUTH_SECRET: z.string().min(32),
      BETTER_AUTH_URL: originSchema.default("http://localhost:4000"),
      WEB_ORIGIN: originSchema.default("http://localhost:3000"),
      DESKTOP_DEV_ORIGIN: originSchema.default("http://localhost:3001"),
      DESKTOP_PROTOCOL_SCHEME:
        protocolSchemeSchema.default("app.remora.desktop"),
      CLIENT_TRUSTED_ORIGINS: csvSchema,
    })
    .transform((parsed) => ({
      ...parsed,
      CLIENT_TRUSTED_ORIGINS: clientOrigins(
        parsed,
        parsed.CLIENT_TRUSTED_ORIGINS,
      ),
    }))
    .parse(env);

export const parseDesktopEnv = (env: NodeJS.ProcessEnv) =>
  z
    .object({
      DESKTOP_API_ORIGIN: originSchema.default("http://localhost:4000"),
      DESKTOP_DEV_ORIGIN: originSchema.default("http://localhost:3001"),
      DESKTOP_PROTOCOL_SCHEME:
        protocolSchemeSchema.default("app.remora.desktop"),
      WEB_ORIGIN: originSchema.default("http://localhost:3000"),
    })
    .parse(env);

export const parseBackendWorkerEnv = (env: NodeJS.ProcessEnv) =>
  z
    .object({
      API_PUBLIC_ORIGIN: originSchema.default("http://localhost:4000"),
      WORKER_HEALTH_PORT: portSchema.default(4001),
      TEMPORAL_ADDRESS: z.string().default("localhost:7233"),
      TEMPORAL_NAMESPACE: z.string().default("default"),
      TEMPORAL_TASK_QUEUE: z.string().default("remora-backend"),
    })
    .parse(env);

export const parseBytePlusProviderEnv = (env: NodeJS.ProcessEnv) =>
  z
    .object({
      BYTEPLUS_ARK_API_KEY: z.string().min(1),
      BYTEPLUS_ARK_BASE_URL: originSchema.default(
        "https://ark.ap-southeast.bytepluses.com/api/v3",
      ),
    })
    .parse(env);

export const parseR2StorageEnv = (env: NodeJS.ProcessEnv) =>
  z
    .object({
      R2_ACCOUNT_ID: z.string().min(1),
      R2_ACCESS_KEY_ID: z.string().min(1),
      R2_SECRET_ACCESS_KEY: z.string().min(1),
      R2_BUCKET_NAME: z.string().min(1),
      R2_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    })
    .parse(env);

export const parseStripeEnv = (env: NodeJS.ProcessEnv) =>
  z
    .object({
      STRIPE_SECRET_KEY: z.string().min(1),
    })
    .parse(env);

export const parseStripeWebhookEnv = (env: NodeJS.ProcessEnv) =>
  z
    .object({
      STRIPE_WEBHOOK_SECRET: z.string().min(1),
    })
    .parse(env);

export const parseBackendDbEnv = (env: NodeJS.ProcessEnv) =>
  z
    .object({
      DATABASE_URL: z.string().min(1),
    })
    .parse(env);
