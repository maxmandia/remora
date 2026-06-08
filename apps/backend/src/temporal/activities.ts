import type {
  CreateSeedanceVideoTaskActivityInput,
  CreateSeedanceVideoTaskActivityResult,
  MarkGenerationJobActivityResult,
  MarkGenerationJobCreatingProviderTaskActivityInput,
  MarkGenerationJobFailedActivityInput,
  MarkGenerationJobProviderTaskCreatedActivityInput,
  RetrieveSeedanceVideoTaskActivityInput,
  RetrieveSeedanceVideoTaskActivityResult,
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

export async function markGenerationJobFailedActivity(
  input: MarkGenerationJobFailedActivityInput,
): Promise<MarkGenerationJobActivityResult> {
  const { generationRepository } = await import(
    '../modules/generation/generation.repository.ts'
  )

  return generationRepository.markGenerationJobFailed(input)
}
