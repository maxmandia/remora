import { z } from "zod";

const portSchema = z.coerce.number().int().min(1).max(65535);
const originSchema = z.string().url();
const protocolSchemeSchema = z
  .string()
  .regex(/^[a-z][a-z0-9+.-]*$/, "Invalid protocol scheme");
const bundleIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9.-]*$/, "Invalid bundle identifier");
const optionalNonEmptyStringSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : null));

export const desktopChannels = ["local", "nightly", "stable"] as const;
export type DesktopChannel = (typeof desktopChannels)[number];

export type DesktopEnv = {
  DESKTOP_CHANNEL: DesktopChannel;
  DESKTOP_APP_NAME: string;
  DESKTOP_BUNDLE_ID: string;
  DESKTOP_API_ORIGIN: string;
  DESKTOP_DEV_ORIGIN: string;
  DESKTOP_PROTOCOL_SCHEME: string;
  DESKTOP_SENTRY_DSN: string | null;
  SENTRY_ENVIRONMENT: string;
  SENTRY_RELEASE: string | null;
  WEB_ORIGIN: string;
};

export type BackendObservabilityEnv = {
  SENTRY_DSN: string | null;
  SENTRY_ENVIRONMENT: string;
  SENTRY_RELEASE: string | null;
  SENTRY_TRACE_URL_TEMPLATE: string | null;
};

export type DesktopSentryBuildEnv = {
  enabled: boolean;
  org: string | null;
  project: string | null;
  authToken: string | null;
};

const desktopChannelSchema = z.enum(desktopChannels).default("local");
const desktopSentryEnvironmentDefaults = {
  local: "local",
  nightly: "staging",
  stable: "production",
} satisfies Record<DesktopChannel, string>;

type DesktopChannelDefaults = Pick<
  DesktopEnv,
  | "DESKTOP_APP_NAME"
  | "DESKTOP_BUNDLE_ID"
  | "DESKTOP_DEV_ORIGIN"
  | "DESKTOP_PROTOCOL_SCHEME"
> &
  Partial<Pick<DesktopEnv, "DESKTOP_API_ORIGIN" | "WEB_ORIGIN">>;

const desktopChannelDefaults: Record<DesktopChannel, DesktopChannelDefaults> = {
  local: {
    DESKTOP_APP_NAME: "Remora",
    DESKTOP_BUNDLE_ID: "com.electron.remora",
    DESKTOP_API_ORIGIN: "http://localhost:4000",
    DESKTOP_DEV_ORIGIN: "http://localhost:3001",
    DESKTOP_PROTOCOL_SCHEME: "app.remora.desktop",
    WEB_ORIGIN: "http://localhost:3000",
  },
  nightly: {
    DESKTOP_APP_NAME: "Remora Nightly",
    DESKTOP_BUNDLE_ID: "app.remora.desktop.nightly",
    DESKTOP_DEV_ORIGIN: "http://localhost:3001",
    DESKTOP_PROTOCOL_SCHEME: "app.remora.desktop.nightly",
  },
  stable: {
    DESKTOP_APP_NAME: "Remora",
    DESKTOP_BUNDLE_ID: "app.remora.desktop",
    DESKTOP_DEV_ORIGIN: "http://localhost:3001",
    DESKTOP_PROTOCOL_SCHEME: "app.remora.desktop",
  },
};

const requireDesktopValue = (
  channel: DesktopChannel,
  keys: string[],
  value: string | undefined,
) => {
  if (value) {
    return value;
  }

  throw new Error(
    `${keys.join(" or ")} is required for DESKTOP_CHANNEL=${channel}`,
  );
};

const withPortFallback = (
  env: NodeJS.ProcessEnv,
  key: "API_PORT" | "WORKER_HEALTH_PORT",
) => ({
  ...env,
  [key]: env[key] ?? env.PORT,
});

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

const resolveDesktopClientOriginsEnv = (env: NodeJS.ProcessEnv) => {
  const parsed = z
    .object({
      DESKTOP_CHANNEL: desktopChannelSchema,
      WEB_ORIGIN: originSchema.optional(),
      DESKTOP_DEV_ORIGIN: originSchema.optional(),
      DESKTOP_PROTOCOL_SCHEME: protocolSchemeSchema.optional(),
    })
    .parse(env);
  const defaults = desktopChannelDefaults[parsed.DESKTOP_CHANNEL];
  const webOrigin = parsed.WEB_ORIGIN ?? defaults.WEB_ORIGIN;

  return {
    WEB_ORIGIN: requireDesktopValue(
      parsed.DESKTOP_CHANNEL,
      ["WEB_ORIGIN"],
      webOrigin,
    ),
    DESKTOP_DEV_ORIGIN:
      parsed.DESKTOP_DEV_ORIGIN ?? defaults.DESKTOP_DEV_ORIGIN,
    DESKTOP_PROTOCOL_SCHEME:
      parsed.DESKTOP_PROTOCOL_SCHEME ?? defaults.DESKTOP_PROTOCOL_SCHEME,
  };
};

const defaultClientOrigins = (env: ClientOriginEnv) => [
  env.WEB_ORIGIN,
  env.DESKTOP_DEV_ORIGIN,
  desktopOrigin(env.DESKTOP_PROTOCOL_SCHEME),
];

const clientOrigins = (env: ClientOriginEnv, extraOrigins: string[]) => [
  ...new Set([...defaultClientOrigins(env), ...extraOrigins]),
];

export const parseBackendHttpEnv = (env: NodeJS.ProcessEnv) => {
  const desktopDefaults = resolveDesktopClientOriginsEnv(env);

  return z
    .object({
      API_PORT: portSchema.default(4000),
      API_PUBLIC_ORIGIN: originSchema.default("http://localhost:4000"),
      WEB_ORIGIN: originSchema.default(desktopDefaults.WEB_ORIGIN),
      DESKTOP_DEV_ORIGIN: originSchema.default(
        desktopDefaults.DESKTOP_DEV_ORIGIN,
      ),
      DESKTOP_PROTOCOL_SCHEME: protocolSchemeSchema.default(
        desktopDefaults.DESKTOP_PROTOCOL_SCHEME,
      ),
      API_CORS_ORIGINS: csvSchema,
    })
    .transform((parsed) => ({
      ...parsed,
      API_CORS_ORIGINS: clientOrigins(parsed, parsed.API_CORS_ORIGINS),
    }))
    .parse(withPortFallback(env, "API_PORT"));
};

export const parseBackendAuthEnv = (env: NodeJS.ProcessEnv) => {
  const desktopDefaults = resolveDesktopClientOriginsEnv(env);

  return z
    .object({
      BETTER_AUTH_SECRET: z.string().min(32),
      BETTER_AUTH_URL: originSchema.default("http://localhost:4000"),
      WEB_ORIGIN: originSchema.default(desktopDefaults.WEB_ORIGIN),
      DESKTOP_DEV_ORIGIN: originSchema.default(
        desktopDefaults.DESKTOP_DEV_ORIGIN,
      ),
      DESKTOP_PROTOCOL_SCHEME: protocolSchemeSchema.default(
        desktopDefaults.DESKTOP_PROTOCOL_SCHEME,
      ),
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
};

export const parseDesktopEnv = (env: NodeJS.ProcessEnv): DesktopEnv => {
  const parsed = z
    .object({
      DESKTOP_CHANNEL: desktopChannelSchema,
      DESKTOP_APP_NAME: z.string().min(1).optional(),
      DESKTOP_BUNDLE_ID: bundleIdSchema.optional(),
      DESKTOP_API_ORIGIN: originSchema.optional(),
      API_PUBLIC_ORIGIN: originSchema.optional(),
      DESKTOP_DEV_ORIGIN: originSchema.optional(),
      DESKTOP_PROTOCOL_SCHEME: protocolSchemeSchema.optional(),
      DESKTOP_SENTRY_DSN: optionalNonEmptyStringSchema,
      SENTRY_ENVIRONMENT: optionalNonEmptyStringSchema,
      SENTRY_RELEASE: optionalNonEmptyStringSchema,
      WEB_ORIGIN: originSchema.optional(),
    })
    .parse(env);
  const defaults = desktopChannelDefaults[parsed.DESKTOP_CHANNEL];
  const desktopApiOrigin =
    parsed.DESKTOP_API_ORIGIN ??
    parsed.API_PUBLIC_ORIGIN ??
    defaults.DESKTOP_API_ORIGIN;
  const webOrigin = parsed.WEB_ORIGIN ?? defaults.WEB_ORIGIN;

  return {
    DESKTOP_CHANNEL: parsed.DESKTOP_CHANNEL,
    DESKTOP_APP_NAME: parsed.DESKTOP_APP_NAME ?? defaults.DESKTOP_APP_NAME,
    DESKTOP_BUNDLE_ID: parsed.DESKTOP_BUNDLE_ID ?? defaults.DESKTOP_BUNDLE_ID,
    DESKTOP_API_ORIGIN: requireDesktopValue(
      parsed.DESKTOP_CHANNEL,
      ["DESKTOP_API_ORIGIN", "API_PUBLIC_ORIGIN"],
      desktopApiOrigin,
    ),
    DESKTOP_DEV_ORIGIN:
      parsed.DESKTOP_DEV_ORIGIN ?? defaults.DESKTOP_DEV_ORIGIN,
    DESKTOP_PROTOCOL_SCHEME:
      parsed.DESKTOP_PROTOCOL_SCHEME ?? defaults.DESKTOP_PROTOCOL_SCHEME,
    DESKTOP_SENTRY_DSN: parsed.DESKTOP_SENTRY_DSN,
    SENTRY_ENVIRONMENT:
      parsed.SENTRY_ENVIRONMENT ??
      desktopSentryEnvironmentDefaults[parsed.DESKTOP_CHANNEL],
    SENTRY_RELEASE: parsed.SENTRY_RELEASE,
    WEB_ORIGIN: requireDesktopValue(
      parsed.DESKTOP_CHANNEL,
      ["WEB_ORIGIN"],
      webOrigin,
    ),
  };
};

export const parseBackendObservabilityEnv = (
  env: NodeJS.ProcessEnv,
): BackendObservabilityEnv => {
  const parsed = z
    .object({
      RAILWAY_ENVIRONMENT_NAME: optionalNonEmptyStringSchema,
      NODE_ENV: optionalNonEmptyStringSchema,
      SENTRY_DSN: optionalNonEmptyStringSchema,
      SENTRY_ENVIRONMENT: optionalNonEmptyStringSchema,
      SENTRY_RELEASE: optionalNonEmptyStringSchema,
      SENTRY_TRACE_URL_TEMPLATE: optionalNonEmptyStringSchema,
    })
    .parse(env);

  return {
    SENTRY_DSN: parsed.SENTRY_DSN,
    SENTRY_ENVIRONMENT:
      parsed.SENTRY_ENVIRONMENT ??
      parsed.RAILWAY_ENVIRONMENT_NAME ??
      parsed.NODE_ENV ??
      "local",
    SENTRY_RELEASE: parsed.SENTRY_RELEASE,
    SENTRY_TRACE_URL_TEMPLATE: parsed.SENTRY_TRACE_URL_TEMPLATE,
  };
};

export const parseDesktopSentryBuildEnv = (
  env: NodeJS.ProcessEnv,
): DesktopSentryBuildEnv => {
  const parsed = z
    .object({
      DESKTOP_CHANNEL: desktopChannelSchema,
      DESKTOP_SENTRY_DSN: optionalNonEmptyStringSchema,
      SENTRY_AUTH_TOKEN: optionalNonEmptyStringSchema,
      SENTRY_ORG: optionalNonEmptyStringSchema,
      SENTRY_DESKTOP_PROJECT: optionalNonEmptyStringSchema,
    })
    .parse(env);
  const enabled =
    parsed.DESKTOP_CHANNEL !== "local" && Boolean(parsed.DESKTOP_SENTRY_DSN);

  if (!enabled) {
    return {
      enabled: false,
      org: parsed.SENTRY_ORG,
      project: parsed.SENTRY_DESKTOP_PROJECT,
      authToken: parsed.SENTRY_AUTH_TOKEN,
    };
  }

  return {
    enabled: true,
    org: requireDesktopValue(
      parsed.DESKTOP_CHANNEL,
      ["SENTRY_ORG"],
      parsed.SENTRY_ORG ?? undefined,
    ),
    project: requireDesktopValue(
      parsed.DESKTOP_CHANNEL,
      ["SENTRY_DESKTOP_PROJECT"],
      parsed.SENTRY_DESKTOP_PROJECT ?? undefined,
    ),
    authToken: requireDesktopValue(
      parsed.DESKTOP_CHANNEL,
      ["SENTRY_AUTH_TOKEN"],
      parsed.SENTRY_AUTH_TOKEN ?? undefined,
    ),
  };
};

export const parseBackendWorkerEnv = (env: NodeJS.ProcessEnv) =>
  z
    .object({
      API_PUBLIC_ORIGIN: originSchema.default("http://localhost:4000"),
      WORKER_HEALTH_PORT: portSchema.default(4001),
      TEMPORAL_ADDRESS: z.string().default("localhost:7233"),
      TEMPORAL_NAMESPACE: z.string().default("default"),
      TEMPORAL_TASK_QUEUE: z.string().default("remora-backend"),
    })
    .parse(withPortFallback(env, "WORKER_HEALTH_PORT"));

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
      R2_SIGNED_URL_TTL_SECONDS: z.coerce
        .number()
        .int()
        .positive()
        .default(900),
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
