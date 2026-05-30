import { z } from 'zod'

const portSchema = z.coerce.number().int().min(1).max(65535)

export const parseApiEnv = (env: NodeJS.ProcessEnv) =>
  z
    .object({
      API_PORT: portSchema.default(4000),
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
