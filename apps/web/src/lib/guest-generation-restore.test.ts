/** @vitest-environment jsdom */

import type { PublishedGenerationModelSummary } from "@remora/domain/generation-model/dto";
import { describe, expect, it, vi } from "vitest";

import type { GuestGenerationDraftRepository } from "./guest-generation-draft-repository";
import {
  GuestGenerationRestoreError,
  GuestGenerationRestoreService,
} from "./guest-generation-restore";

describe("guest generation restore service", () => {
  it("restores an existing-account draft without redeeming a promotion", async () => {
    const repository = createRepository();
    repository.read.mockResolvedValue({
      draft: createStoredDraft(),
      status: "found",
    });
    const redeemPromotion = vi.fn();
    const service = new GuestGenerationRestoreService({
      getPromotionStatus: vi.fn().mockResolvedValue({ status: "none" }),
      redeemPromotion,
      repository,
    });

    await expect(service.restore([imageModel])).resolves.toEqual({
      draft: {
        attachmentMedia: {
          audios: [],
          images: [
            expect.objectContaining({
              file: expect.objectContaining({ name: "reference.png" }),
              role: "firstFrame",
            }),
          ],
          videos: [],
        },
        model: imageModel,
        prompt: "A glass studio above the ocean",
        settings: imageSettings,
      },
      promotionStatus: "none",
      status: "restored",
    });
    expect(redeemPromotion).not.toHaveBeenCalled();
  });

  it("restores video settings and local attachment files", async () => {
    const file = new File(["source-video"], "source.mp4", {
      lastModified: 84,
      type: "video/mp4",
    });
    const repository = createRepository();
    repository.read.mockResolvedValue({
      draft: {
        attachments: [
          {
            fieldId: "videos",
            file,
            metadata: {
              lastModified: file.lastModified,
              name: file.name,
              size: file.size,
              type: file.type,
            },
            role: "reference",
          },
        ],
        expiresAt: Date.now() + 60_000,
        modelId: videoModel.id,
        modelSpecId: videoModel.latestSpecId,
        promotionTicket: "promotion-ticket",
        prompt: "A camera passes through a glass studio",
        schemaVersion: 1,
        settings: videoSettings,
      },
      status: "found",
    });
    const service = new GuestGenerationRestoreService({
      getPromotionStatus: vi.fn().mockResolvedValue({ status: "none" }),
      redeemPromotion: vi.fn(),
      repository,
    });

    const result = await service.restore([videoModel]);

    expect(result).toEqual({
      draft: {
        attachmentMedia: {
          audios: [],
          images: [],
          videos: [{ file, role: "reference" }],
        },
        model: videoModel,
        prompt: "A camera passes through a glass studio",
        settings: videoSettings,
      },
      promotionStatus: "none",
      status: "restored",
    });
    expect(
      result.status === "restored"
        ? await result.draft.attachmentMedia.videos[0]?.file.text()
        : null,
    ).toBe("source-video");
  });

  it("redeems an eligible promotion before reading the draft", async () => {
    const order: string[] = [];
    const repository = createRepository();
    repository.read.mockImplementation(async () => {
      order.push("read");
      return { status: "empty" };
    });
    const service = new GuestGenerationRestoreService({
      getPromotionStatus: vi.fn(async () => {
        order.push("status");
        return { status: "eligible" as const };
      }),
      redeemPromotion: vi.fn(async () => {
        order.push("redeem");
        return { status: "redeemed" as const };
      }),
      repository,
    });

    await expect(service.restore([imageModel])).resolves.toEqual({
      promotionStatus: "redeemed",
      status: "empty",
    });
    expect(order).toEqual(["status", "redeem", "read"]);
  });

  it("does not repeat redemption for an already redeemed promotion", async () => {
    const repository = createRepository();
    repository.read.mockResolvedValue({ status: "empty" });
    const redeemPromotion = vi.fn();
    const service = new GuestGenerationRestoreService({
      getPromotionStatus: vi.fn().mockResolvedValue({ status: "redeemed" }),
      redeemPromotion,
      repository,
    });

    await expect(service.restore([imageModel])).resolves.toEqual({
      promotionStatus: "redeemed",
      status: "empty",
    });
    expect(redeemPromotion).not.toHaveBeenCalled();
  });

  it("returns verification-required without reading browser storage", async () => {
    const repository = createRepository();
    const service = new GuestGenerationRestoreService({
      getPromotionStatus: vi
        .fn()
        .mockResolvedValue({ status: "verification_required" }),
      redeemPromotion: vi.fn(),
      repository,
    });

    await expect(service.restore([imageModel])).resolves.toEqual({
      status: "verification-required",
    });
    expect(repository.read).not.toHaveBeenCalled();
  });

  it.each([
    {
      createDependencies: (
        repository: ReturnType<typeof createRepository>,
      ) => ({
        getPromotionStatus: vi.fn().mockRejectedValue(new Error("offline")),
        redeemPromotion: vi.fn(),
        repository,
      }),
      expected: new GuestGenerationRestoreError(
        "promotion",
        "Unable to check your promotional credit. Your saved generation is safe. Try again.",
      ),
    },
    {
      createDependencies: (
        repository: ReturnType<typeof createRepository>,
      ) => ({
        getPromotionStatus: vi.fn().mockResolvedValue({ status: "eligible" }),
        redeemPromotion: vi.fn().mockRejectedValue(new Error("offline")),
        repository,
      }),
      expected: new GuestGenerationRestoreError(
        "promotion",
        "Unable to apply your promotional credit. Your saved generation is safe. Try again.",
      ),
    },
  ])(
    "preserves the draft when promotion resolution fails",
    async (testCase) => {
      const repository = createRepository();
      const service = new GuestGenerationRestoreService(
        testCase.createDependencies(repository),
      );

      await expect(service.restore([imageModel])).rejects.toEqual(
        testCase.expected,
      );
      expect(repository.read).not.toHaveBeenCalled();
      expect(repository.clear).not.toHaveBeenCalled();
    },
  );

  it("surfaces transient storage failures without clearing the draft", async () => {
    const repository = createRepository();
    repository.read.mockResolvedValue({
      reason: "storage-error",
      status: "failed",
    });
    const service = new GuestGenerationRestoreService({
      getPromotionStatus: vi.fn().mockResolvedValue({ status: "none" }),
      redeemPromotion: vi.fn(),
      repository,
    });

    await expect(service.restore([imageModel])).rejects.toEqual(
      new GuestGenerationRestoreError(
        "storage",
        "Unable to restore your saved generation in this browser. Try again or continue without it.",
      ),
    );
    expect(repository.clear).not.toHaveBeenCalled();
  });

  it.each(["expired", "incompatible", "malformed"] as const)(
    "reports an automatically discarded %s draft",
    async (reason) => {
      const repository = createRepository();
      repository.read.mockResolvedValue({ reason, status: "discarded" });
      const service = new GuestGenerationRestoreService({
        getPromotionStatus: vi.fn().mockResolvedValue({ status: "none" }),
        redeemPromotion: vi.fn(),
        repository,
      });

      await expect(service.restore([imageModel])).resolves.toEqual({
        promotionStatus: "none",
        reason,
        status: "discarded",
      });
    },
  );

  it("clears a defensively incompatible draft before continuing", async () => {
    const repository = createRepository();
    repository.read.mockResolvedValue({
      draft: createStoredDraft(),
      status: "found",
    });
    repository.clear.mockResolvedValue({ status: "cleared" });
    const service = new GuestGenerationRestoreService({
      getPromotionStatus: vi.fn().mockResolvedValue({ status: "none" }),
      redeemPromotion: vi.fn(),
      repository,
    });

    await expect(service.restore([])).resolves.toEqual({
      promotionStatus: "none",
      reason: "incompatible",
      status: "discarded",
    });
    expect(repository.clear).toHaveBeenCalledOnce();
  });
});

const imageSettings = {
  aspectRatio: "1:1",
  modelType: "image",
  requestedGenerations: 1,
  resolution: "1024p",
} as const;

const imageModel = {
  id: "image-model",
  displayName: "Image Model",
  latestSpecId: "image-model-spec",
  spec: {
    fields: [],
    id: "image-model-spec",
    modelId: "image-model",
    type: "image",
  },
  type: "image",
} as unknown as PublishedGenerationModelSummary;

const videoSettings = {
  aspectRatio: "16:9",
  duration: 5,
  generateAudio: true,
  modelType: "video",
  requestedGenerations: 1,
  resolution: "720p",
} as const;

const videoModel = {
  id: "video-model",
  displayName: "Video Model",
  latestSpecId: "video-model-spec",
  spec: {
    fields: [],
    id: "video-model-spec",
    modelId: "video-model",
    type: "video",
  },
  type: "video",
} as unknown as PublishedGenerationModelSummary;

function createStoredDraft() {
  const file = new File(["reference"], "reference.png", {
    lastModified: 42,
    type: "image/png",
  });

  return {
    attachments: [
      {
        fieldId: "images" as const,
        file,
        metadata: {
          lastModified: file.lastModified,
          name: file.name,
          size: file.size,
          type: file.type,
        },
        role: "firstFrame" as const,
      },
    ],
    expiresAt: Date.now() + 60_000,
    modelId: imageModel.id,
    modelSpecId: imageModel.latestSpecId,
    promotionTicket: "promotion-ticket",
    prompt: "A glass studio above the ocean",
    schemaVersion: 1 as const,
    settings: imageSettings,
  };
}

function createRepository() {
  return {
    clear: vi.fn(),
    read: vi.fn(),
    save: vi.fn(),
  } as unknown as GuestGenerationDraftRepository & {
    clear: ReturnType<typeof vi.fn>;
    read: ReturnType<typeof vi.fn>;
  };
}
