import { and, desc, eq } from 'drizzle-orm'

import { parseBytePlusProviderEnv } from '@remora/env'

import { db, schema } from '../../db/client.ts'
import { buildSeedanceVideoTaskRequest } from './provider-payload.ts'
import { BytePlusSeedanceClient } from './providers/byteplus/seedance.client.ts'

import type { VideoModelSpec } from '../model/types.ts'
import type {
  CreateSeedanceVideoTaskInput,
  CreateSeedanceVideoTaskResult,
  RetrieveSeedanceVideoTaskInput,
  RetrieveSeedanceVideoTaskResult,
} from './generation.types.ts'

const seedanceModelId = 'seedance-2.0-video'

export async function createSeedanceVideoTask(
  input: CreateSeedanceVideoTaskInput,
): Promise<CreateSeedanceVideoTaskResult> {
  const spec = await getPublishedSeedanceSpec()
  const request = buildSeedanceVideoTaskRequest({ spec, input })
  const client = createConfiguredBytePlusClient()

  return client.createSeedanceVideoTask(request)
}

export async function retrieveSeedanceVideoTask({
  providerTaskId,
}: RetrieveSeedanceVideoTaskInput): Promise<RetrieveSeedanceVideoTaskResult> {
  const client = createConfiguredBytePlusClient()

  return client.retrieveSeedanceVideoTask(providerTaskId)
}

async function getPublishedSeedanceSpec(): Promise<VideoModelSpec> {
  const [row] = await db
    .select({
      spec: schema.generationModelSpec.spec,
    })
    .from(schema.generationModelSpec)
    .innerJoin(
      schema.generationModel,
      eq(schema.generationModel.id, schema.generationModelSpec.modelId),
    )
    .where(
      and(
        eq(schema.generationModel.id, seedanceModelId),
        eq(schema.generationModel.status, 'published'),
        eq(schema.generationModelSpec.status, 'published'),
      ),
    )
    .orderBy(desc(schema.generationModelSpec.version))
    .limit(1)

  if (!row) {
    throw new Error('Published Seedance model spec was not found')
  }

  return row.spec as VideoModelSpec
}

function createConfiguredBytePlusClient() {
  const env = parseBytePlusProviderEnv(process.env)

  return new BytePlusSeedanceClient({
    apiKey: env.BYTEPLUS_ARK_API_KEY,
    baseUrl: env.BYTEPLUS_ARK_BASE_URL,
  })
}
