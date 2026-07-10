export type GenerationThreadRecord = {
  id: string;
  projectId: string | null;
  userId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
};

export class GenerationThreadNotFoundError extends Error {
  readonly code = "GENERATION_THREAD_NOT_FOUND";

  constructor(threadId: string) {
    super(`Generation thread was not found: ${threadId}`);
    this.name = "GenerationThreadNotFoundError";
  }
}

export class GenerationProjectNotFoundError extends Error {
  readonly code = "GENERATION_PROJECT_NOT_FOUND";

  constructor(projectId: string) {
    super(`Generation project was not found: ${projectId}`);
    this.name = "GenerationProjectNotFoundError";
  }
}

export class GenerationThreadNameUnavailableError extends Error {
  readonly code = "GENERATION_THREAD_NAME_UNAVAILABLE";

  constructor(message: string) {
    super(message);
    this.name = "GenerationThreadNameUnavailableError";
  }
}
