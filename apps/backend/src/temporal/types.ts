export const temporalSkeletonWorkflowType = 'temporalSkeletonWorkflow'
export const temporalSkeletonActivityType = 'temporalSkeletonActivity'
export const createSeedanceVideoTaskActivityType = 'createSeedanceVideoTaskActivity'
export const retrieveSeedanceVideoTaskActivityType = 'retrieveSeedanceVideoTaskActivity'

export type {
  CreateSeedanceVideoTaskInput as CreateSeedanceVideoTaskActivityInput,
  CreateSeedanceVideoTaskResult as CreateSeedanceVideoTaskActivityResult,
  RetrieveSeedanceVideoTaskInput as RetrieveSeedanceVideoTaskActivityInput,
  RetrieveSeedanceVideoTaskResult as RetrieveSeedanceVideoTaskActivityResult,
} from '../modules/generation/generation.types.ts'

export type TemporalWorkerConfig = {
  address: string
  namespace: string
  taskQueue: string
}

export type TemporalWorkerRuntime = {
  run: () => Promise<void>
}

export type TemporalSkeletonWorkflowInput = {
  note?: string
}

export type TemporalSkeletonActivityResult = {
  ok: true
  activity: typeof temporalSkeletonActivityType
}

export type TemporalSkeletonWorkflowResult = {
  ok: true
  workflow: typeof temporalSkeletonWorkflowType
  activity: TemporalSkeletonActivityResult
  note: string | null
}
