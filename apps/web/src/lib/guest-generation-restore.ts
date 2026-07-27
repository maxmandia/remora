import type { PublishedGenerationModelSummary } from "@remora/domain/generation-model/dto";

import { trpcClient } from "../clients/trpc";
import {
  toGuestGenerationDraftInput,
  type GuestGenerationDraftInput,
} from "./guest-generation-draft";
import {
  guestGenerationDraftRepository,
  type GuestGenerationDraftRepository,
} from "./guest-generation-draft-repository";

type PromotionStatus =
  | "eligible"
  | "none"
  | "redeemed"
  | "verification_required";

type GuestGenerationRestoreDependencies = {
  getPromotionStatus: () => Promise<{ status: PromotionStatus }>;
  redeemPromotion: () => Promise<{ status: "redeemed" }>;
  repository: GuestGenerationDraftRepository;
};

export type ReadyGuestGenerationPromotionStatus = "none" | "redeemed";

type GuestGenerationReadyResult =
  | {
      draft: GuestGenerationDraftInput;
      promotionStatus: ReadyGuestGenerationPromotionStatus;
      status: "restored";
    }
  | {
      promotionStatus: ReadyGuestGenerationPromotionStatus;
      status: "empty";
    }
  | {
      promotionStatus: ReadyGuestGenerationPromotionStatus;
      reason: "expired" | "incompatible" | "malformed";
      status: "discarded";
    };

export type GuestGenerationRestoreResult =
  | GuestGenerationReadyResult
  | {
      status: "verification-required";
    };

export type GuestGenerationRestoreErrorKind = "promotion" | "storage";

const defaultDependencies: GuestGenerationRestoreDependencies = {
  getPromotionStatus: () => trpcClient.promotion.getStatus.query(),
  redeemPromotion: () => trpcClient.promotion.redeem.mutate(),
  repository: guestGenerationDraftRepository,
};

export class GuestGenerationRestoreService {
  constructor(
    private readonly dependencies: GuestGenerationRestoreDependencies = defaultDependencies,
  ) {}

  async restore(
    models: PublishedGenerationModelSummary[],
  ): Promise<GuestGenerationRestoreResult> {
    const promotionStatus = await this.resolvePromotion();

    if (promotionStatus === "verification_required") {
      return { status: "verification-required" };
    }

    return this.restoreDraft(models, promotionStatus);
  }

  async restoreDraft(
    models: PublishedGenerationModelSummary[],
    promotionStatus: ReadyGuestGenerationPromotionStatus,
  ): Promise<GuestGenerationReadyResult> {
    const readResult = await this.dependencies.repository.read(models);

    if (readResult.status === "empty") {
      return {
        promotionStatus,
        status: "empty",
      };
    }

    if (readResult.status === "discarded") {
      return {
        promotionStatus,
        reason: readResult.reason,
        status: "discarded",
      };
    }

    if (readResult.status === "failed") {
      throw new GuestGenerationRestoreError(
        "storage",
        "Unable to restore your saved generation in this browser. Try again or continue without it.",
      );
    }

    const draft = toGuestGenerationDraftInput({
      draft: readResult.draft,
      models,
    });

    if (draft) {
      return {
        draft,
        promotionStatus,
        status: "restored",
      };
    }

    const clearResult = await this.dependencies.repository.clear();

    if (clearResult.status === "failed") {
      throw new GuestGenerationRestoreError(
        "storage",
        "Unable to restore your saved generation in this browser. Try again or continue without it.",
      );
    }

    return {
      promotionStatus,
      reason: "incompatible",
      status: "discarded",
    };
  }

  clear() {
    return this.dependencies.repository.clear();
  }

  async resolvePromotion(): Promise<
    ReadyGuestGenerationPromotionStatus | "verification_required"
  > {
    let status: PromotionStatus;

    try {
      ({ status } = await this.dependencies.getPromotionStatus());
    } catch {
      throw new GuestGenerationRestoreError(
        "promotion",
        "Unable to check your $5 credit. Your saved generation is safe. Try again.",
      );
    }

    if (status === "verification_required") {
      return status;
    }

    if (status === "eligible") {
      try {
        await this.dependencies.redeemPromotion();
      } catch {
        throw new GuestGenerationRestoreError(
          "promotion",
          "Unable to apply your $5 credit. Your saved generation is safe. Try again.",
        );
      }

      return "redeemed";
    }

    return status;
  }
}

export class GuestGenerationRestoreError extends Error {
  constructor(
    readonly kind: GuestGenerationRestoreErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "GuestGenerationRestoreError";
  }
}

export const guestGenerationRestoreService =
  new GuestGenerationRestoreService();
