import type {
  CreateSeedanceVideoTaskActivityInput,
  CreateSeedanceVideoTaskActivityResult,
  MarkGenerationJobActivityResult,
  MarkGenerationJobCancelledActivityInput,
  MarkGenerationJobCreatingProviderTaskActivityInput,
  MarkGenerationJobExpiredActivityInput,
  MarkGenerationJobFailedActivityInput,
  MarkGenerationJobProviderTaskCreatedActivityInput,
  MarkGenerationJobSucceededActivityInput,
  MarkGenerationJobWaitingForProviderCallbackActivityInput,
  RetrieveSeedanceVideoTaskActivityInput,
  RetrieveSeedanceVideoTaskActivityResult,
  UpsertGenerationResultActivityInput,
} from './types.ts'

export async function createSeedanceVideoTaskActivity(
  input: CreateSeedanceVideoTaskActivityInput,
): Promise<CreateSeedanceVideoTaskActivityResult> {
  const { generationService } = await import(
    '../modules/generation/generation.service.ts'
  )

  return generationService.createSeedanceVideoTask(input)
}

export async function retrieveSeedanceVideoTaskActivity(
  input: RetrieveSeedanceVideoTaskActivityInput,
): Promise<RetrieveSeedanceVideoTaskActivityResult> {
  const { generationService } = await import(
    '../modules/generation/generation.service.ts'
  )

  return generationService.retrieveSeedanceVideoTask(input)
}

export async function markGenerationJobCreatingProviderTaskActivity(
  input: MarkGenerationJobCreatingProviderTaskActivityInput,
): Promise<MarkGenerationJobActivityResult> {
  const { generationRepository } = await import(
    '../modules/generation/generation.repository.ts'
  )

  return generationRepository.markGenerationJobCreatingProviderTask(input)
}

export async function markGenerationJobProviderTaskCreatedActivity(
  input: MarkGenerationJobProviderTaskCreatedActivityInput,
): Promise<MarkGenerationJobActivityResult> {
  const { generationRepository } = await import(
    '../modules/generation/generation.repository.ts'
  )

  return generationRepository.markGenerationJobProviderTaskCreated(input)
}

export async function markGenerationJobWaitingForProviderCallbackActivity(
  input: MarkGenerationJobWaitingForProviderCallbackActivityInput,
): Promise<MarkGenerationJobActivityResult> {
  const { generationRepository } = await import(
    '../modules/generation/generation.repository.ts'
  )

  return generationRepository.markGenerationJobWaitingForProviderCallback(input)
}

export async function upsertGenerationResultActivity(
  input: UpsertGenerationResultActivityInput,
) {
  const { generationRepository } = await import(
    '../modules/generation/generation.repository.ts'
  )

  return generationRepository.upsertGenerationResult({
    jobId: input.jobId,
    result: input.callback.result,
    rawPayload: input.callback.rawPayload,
    receivedAt: new Date(input.callback.receivedAt),
  })
}

export async function markGenerationJobSucceededActivity(
  input: MarkGenerationJobSucceededActivityInput,
): Promise<MarkGenerationJobActivityResult> {
  const { generationRepository } = await import(
    '../modules/generation/generation.repository.ts'
  )

  return generationRepository.markGenerationJobSucceeded(input)
}

export async function markGenerationJobCancelledActivity(
  input: MarkGenerationJobCancelledActivityInput,
): Promise<MarkGenerationJobActivityResult> {
  const { generationRepository } = await import(
    '../modules/generation/generation.repository.ts'
  )

  return generationRepository.markGenerationJobCancelled(input)
}

export async function markGenerationJobExpiredActivity(
  input: MarkGenerationJobExpiredActivityInput,
): Promise<MarkGenerationJobActivityResult> {
  const { generationRepository } = await import(
    '../modules/generation/generation.repository.ts'
  )

  return generationRepository.markGenerationJobExpired(input)
}

export async function markGenerationJobFailedActivity(
  input: MarkGenerationJobFailedActivityInput,
): Promise<MarkGenerationJobActivityResult> {
  const { generationRepository } = await import(
    '../modules/generation/generation.repository.ts'
  )

  return generationRepository.markGenerationJobFailed(input)
}
