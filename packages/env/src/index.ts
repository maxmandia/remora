import { z } from 'zod'

const portSchema = z.coerce.number().int().min(1).max(65535)
const originSchema = z.string().url()
const protocolSchemeSchema = z
  .string()
  .regex(/^[a-z][a-z0-9+.-]*$/, 'Invalid protocol scheme')

const csvSchema = z
  .string()
  .optional()
  .transform((value) =>
    value
      ? value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      : [],
  )

const desktopOrigin = (scheme: string) => `${scheme}:/`

type ClientOriginEnv = {
  WEB_ORIGIN: string
  DESKTOP_DEV_ORIGIN: string
  DESKTOP_PROTOCOL_SCHEME: string
}

const defaultClientOrigins = (env: ClientOriginEnv) => [
  env.WEB_ORIGIN,
  env.DESKTOP_DEV_ORIGIN,
  desktopOrigin(env.DESKTOP_PROTOCOL_SCHEME),
]

const clientOrigins = (env: ClientOriginEnv, extraOrigins: string[]) => [
  ...new Set([...defaultClientOrigins(env), ...extraOrigins]),
]

export const parseApiEnv = (env: NodeJS.ProcessEnv) =>
  z
    .object({
      API_PORT: portSchema.default(4000),
      WEB_ORIGIN: originSchema.default('http://localhost:3000'),
      DESKTOP_DEV_ORIGIN: originSchema.default('http://localhost:3001'),
      DESKTOP_PROTOCOL_SCHEME: protocolSchemeSchema.default('app.remora.desktop'),
      API_CORS_ORIGINS: csvSchema,
    })
    .transform((parsed) => ({
      ...parsed,
      API_CORS_ORIGINS: clientOrigins(parsed, parsed.API_CORS_ORIGINS),
    }))
    .parse(env)

export const parseAuthEnv = (env: NodeJS.ProcessEnv) =>
  z
    .object({
      BETTER_AUTH_SECRET: z.string().min(32),
      BETTER_AUTH_URL: originSchema.default('http://localhost:4000'),
      WEB_ORIGIN: originSchema.default('http://localhost:3000'),
      DESKTOP_DEV_ORIGIN: originSchema.default('http://localhost:3001'),
      DESKTOP_PROTOCOL_SCHEME: protocolSchemeSchema.default('app.remora.desktop'),
      CLIENT_TRUSTED_ORIGINS: csvSchema,
    })
    .transform((parsed) => ({
      ...parsed,
      CLIENT_TRUSTED_ORIGINS: clientOrigins(
        parsed,
        parsed.CLIENT_TRUSTED_ORIGINS,
      ),
    }))
    .parse(env)

export const parseDesktopEnv = (env: NodeJS.ProcessEnv) =>
  z
    .object({
      DESKTOP_API_ORIGIN: originSchema.default('http://localhost:4000'),
      DESKTOP_DEV_ORIGIN: originSchema.default('http://localhost:3001'),
      DESKTOP_PROTOCOL_SCHEME: protocolSchemeSchema.default('app.remora.desktop'),
      WEB_ORIGIN: originSchema.default('http://localhost:3000'),
    })
    .parse(env)

export const parseWorkerEnv = (env: NodeJS.ProcessEnv) =>
  z
    .object({
      WORKER_HEALTH_PORT: portSchema.default(4001),
      TEMPORAL_ADDRESS: z.string().default('localhost:7233'),
    })
    .parse(env)

export const parseDbEnv = (env: NodeJS.ProcessEnv) =>
  z
    .object({
      DATABASE_URL: z.string().min(1),
    })
    .parse(env)
