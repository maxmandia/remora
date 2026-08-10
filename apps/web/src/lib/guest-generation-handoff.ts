import type { PublishedGenerationModelSummary } from "@remora/domain/generation-model/dto";

import { trpcClient } from "../clients/trpc";
import {
  guestGenerationDraftRepository,
  type GuestGenerationDraftRepository,
} from "./guest-generation-draft-repository";

type GuestGenerationHandoffDependencies = {
  claim: (ticket: string) => Promise<void>;
  listPublishedModels: () => Promise<PublishedGenerationModelSummary[]>;
  repository: GuestGenerationDraftRepository;
};

const defaultDependencies: GuestGenerationHandoffDependencies = {
  claim: async (ticket) => {
    await trpcClient.promotion.claim.mutate({ ticket });
  },
  listPublishedModels: () => trpcClient.model.listPublished.query(),
  repository: guestGenerationDraftRepository,
};

export class GuestGenerationHandoffService {
  constructor(
    private readonly dependencies: GuestGenerationHandoffDependencies = defaultDependencies,
  ) {}

  async resolveTicket() {
    let models: PublishedGenerationModelSummary[];

    try {
      models = await this.dependencies.listPublishedModels();
    } catch {
      throw new GuestGenerationHandoffError(
        "Unable to validate your saved generation. Try again.",
      );
    }

    const result = await this.dependencies.repository.read(models);

    if (result.status === "found") {
      return result.draft.promotionTicket;
    }

    if (result.status === "failed") {
      throw new GuestGenerationHandoffError(
        "Unable to read your saved generation. Try again.",
      );
    }

    throw new GuestGenerationHandoffError(
      "Your saved generation is no longer available. Return to Remora to create it again.",
    );
  }

  async claim(ticket: string) {
    try {
      await this.dependencies.claim(ticket);
    } catch {
      throw new GuestGenerationHandoffError(
        "Your account was created, but setup could not be completed. Try again.",
      );
    }
  }
}

export class GuestGenerationHandoffError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GuestGenerationHandoffError";
  }
}

export async function runSignupWithGuestGeneration<AccountResult>({
  claim,
  createAccount,
  isAccountCreated,
  isGuestGeneration,
  onAccountCreated,
  onClaimed,
  onReadyWithoutPromotion,
  onTicketResolved,
  resolveTicket,
}: {
  claim: (ticket: string) => Promise<void>;
  createAccount: () => Promise<AccountResult>;
  isAccountCreated: (result: AccountResult) => boolean;
  isGuestGeneration: boolean;
  onAccountCreated?: (result: AccountResult) => Promise<void> | void;
  onClaimed: () => void;
  onReadyWithoutPromotion: () => void;
  onTicketResolved: (ticket: string) => void;
  resolveTicket: () => Promise<string | null>;
}) {
  const ticket = isGuestGeneration ? await resolveTicket() : null;

  if (ticket) {
    onTicketResolved(ticket);
  }

  const accountResult = await createAccount();

  if (!isGuestGeneration || !isAccountCreated(accountResult)) {
    return accountResult;
  }

  await onAccountCreated?.(accountResult);

  if (!ticket) {
    onReadyWithoutPromotion();
    return accountResult;
  }

  await claim(ticket);
  onClaimed();

  return accountResult;
}

export const guestGenerationHandoffService =
  new GuestGenerationHandoffService();
