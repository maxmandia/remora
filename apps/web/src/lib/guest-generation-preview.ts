import { trpcClient } from "../clients/trpc";
import type { GuestGenerationDraftInput } from "./guest-generation-draft";
import {
  guestGenerationDraftRepository,
  type GuestGenerationDraftRepository,
} from "./guest-generation-draft-repository";

type GuestGenerationPreviewDependencies = {
  issueTicket: () => Promise<
    { status: "disabled" } | { status: "issued"; ticket: string }
  >;
  repository: GuestGenerationDraftRepository;
};

const defaultDependencies: GuestGenerationPreviewDependencies = {
  issueTicket: () => trpcClient.promotion.issueTicket.mutate(),
  repository: guestGenerationDraftRepository,
};

export class GuestGenerationPreviewService {
  constructor(
    private readonly dependencies: GuestGenerationPreviewDependencies = defaultDependencies,
  ) {}

  async prepare(input: GuestGenerationDraftInput) {
    let promotionTicket: string | null;

    try {
      const result = await this.dependencies.issueTicket();
      promotionTicket = result.status === "issued" ? result.ticket : null;
    } catch {
      throw new GuestGenerationPreviewError(
        "Guest generation is temporarily unavailable. Try again.",
      );
    }

    const result = await this.dependencies.repository.save({
      ...input,
      promotionTicket,
    });

    if (result.status === "saved") {
      return result.draft;
    }

    if (result.status === "rejected") {
      throw new GuestGenerationPreviewError(
        "Review your generation settings and try again.",
      );
    }

    if (result.reason === "quota-exceeded") {
      throw new GuestGenerationPreviewError(
        "Your browser does not have enough storage to save this generation. Remove an attachment or free some space and try again.",
      );
    }

    throw new GuestGenerationPreviewError(
      "Unable to save your generation in this browser. Try again.",
    );
  }
}

export class GuestGenerationPreviewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GuestGenerationPreviewError";
  }
}

export const guestGenerationPreviewService =
  new GuestGenerationPreviewService();
