export const createSeedanceVideoGenerationWorkflowType =
  'createSeedanceVideoGenerationWorkflow'
export const createSeedanceVideoTaskActivityType = 'createSeedanceVideoTaskActivity'
export const retrieveSeedanceVideoTaskActivityType = 'retrieveSeedanceVideoTaskActivity'
export const markGenerationJobCreatingProviderTaskActivityType =
  'markGenerationJobCreatingProviderTaskActivity'
export const markGenerationJobProviderTaskCreatedActivityType =
  'markGenerationJobProviderTaskCreatedActivity'
export const markGenerationJobFailedActivityType = 'markGenerationJobFailedActivity'

export type {
  CreateSeedanceVideoTaskInput as CreateSeedanceVideoTaskActivityInput,
  CreateSeedanceVideoTaskResult as CreateSeedanceVideoTaskActivityResult,
  GenerationJobTerminalError,
  GenerationJobRecord,
  GenerationJobStatus,
  RetrieveSeedanceVideoTaskInput as RetrieveSeedanceVideoTaskActivityInput,
  RetrieveSeedanceVideoTaskResult as RetrieveSeedanceVideoTaskActivityResult,
} from '../modules/generation/generation.types.ts'

import type {
  GenerationJobTerminalError,
  GenerationJobRecord,
  GenerationJobStatus,
} from '../modules/generation/generation.types.ts'

export type TemporalWorkerConfig = {
  address: string
  namespace: string
  taskQueue: string
}

export type TemporalWorkerRuntime = {
  run: () => Promise<void>
}

export type CreateSeedanceVideoGenerationWorkflowInput = {
  jobId: string
  prompt: string
  aspectRatio: string
  duration: number
  generateAudio: boolean
}

export type CreateSeedanceVideoGenerationWorkflowResult = {
  jobId: string
  status: GenerationJobStatus
  providerTaskId: string | null
}

export type MarkGenerationJobCreatingProviderTaskActivityInput = {
  jobId: string
  workflowId: string
  runId: string
}

export type MarkGenerationJobProviderTaskCreatedActivityInput = {
  jobId: string
  providerId: string
  providerTaskId: string
  providerModelId: string
}

export type MarkGenerationJobFailedActivityInput = {
  jobId: string
  terminalError: GenerationJobTerminalError
}

export type MarkGenerationJobActivityResult = GenerationJobRecord
