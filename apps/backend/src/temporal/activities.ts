import { temporalSkeletonActivityType } from './types.ts'

import type {
  CreateSeedanceVideoTaskActivityInput,
  CreateSeedanceVideoTaskActivityResult,
  RetrieveSeedanceVideoTaskActivityInput,
  RetrieveSeedanceVideoTaskActivityResult,
  TemporalSkeletonActivityResult,
} from './types.ts'

export async function temporalSkeletonActivity(): Promise<TemporalSkeletonActivityResult> {
  return {
    ok: true,
    activity: temporalSkeletonActivityType,
  }
}

export async function createSeedanceVideoTaskActivity(
  input: CreateSeedanceVideoTaskActivityInput,
): Promise<CreateSeedanceVideoTaskActivityResult> {
  const { createSeedanceVideoTask } = await import(
    '../modules/generation/generation.service.ts'
  )

  return createSeedanceVideoTask(input)
}

export async function retrieveSeedanceVideoTaskActivity(
  input: RetrieveSeedanceVideoTaskActivityInput,
): Promise<RetrieveSeedanceVideoTaskActivityResult> {
  const { retrieveSeedanceVideoTask } = await import(
    '../modules/generation/generation.service.ts'
  )

  return retrieveSeedanceVideoTask(input)
}
