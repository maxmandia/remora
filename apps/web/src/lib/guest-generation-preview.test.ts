/** @vitest-environment jsdom */

import type { PublishedGenerationModelSummary } from "@remora/domain/generation-model/dto";
import { describe, expect, it, vi } from "vitest";

import type { GuestGenerationDraftInput } from "./guest-generation-draft";
import type { GuestGenerationDraftRepository } from "./guest-generation-draft-repository";
import {
  GuestGenerationPreviewError,
  GuestGenerationPreviewService,
} from "./guest-generation-preview";

describe("guest generation preview service", () => {
  it("issues a content-free ticket before saving the browser draft", async () => {
    const order: string[] = [];
    const issueTicket = vi.fn(async () => {
      order.push("ticket");
      return { ticket: "promotion-ticket" };
    });
    const repository = createRepository();
    repository.save.mockImplementation(async (input) => {
      order.push("save");
      return {
        draft: {
          attachments: [],
          expiresAt: Date.now() + 60_000,
          modelId: input.model.id,
          modelSpecId: input.model.latestSpecId,
          promotionTicket: input.promotionTicket,
          prompt: input.prompt,
          schemaVersion: 1,
          settings: input.settings,
        },
        status: "saved",
      };
    });
    const service = new GuestGenerationPreviewService({
      issueTicket,
      repository,
    });
    const draft = createDraft();

    await expect(service.prepare(draft)).resolves.toEqual(
      expect.objectContaining({
        promotionTicket: "promotion-ticket",
        prompt: draft.prompt,
      }),
    );

    expect(issueTicket).toHaveBeenCalledWith();
    expect(repository.save).toHaveBeenCalledWith({
      ...draft,
      promotionTicket: "promotion-ticket",
    });
    expect(order).toEqual(["ticket", "save"]);
  });

  it("does not save or promise the promotion when ticket issuance fails", async () => {
    const repository = createRepository();
    const service = new GuestGenerationPreviewService({
      issueTicket: vi.fn().mockRejectedValue(new Error("disabled")),
      repository,
    });

    await expect(service.prepare(createDraft())).rejects.toEqual(
      new GuestGenerationPreviewError(
        "Guest generation is temporarily unavailable. Try again.",
      ),
    );
    expect(repository.save).not.toHaveBeenCalled();
  });

  it.each([
    [
      { reason: "invalid-draft", status: "rejected" },
      "Review your generation settings and try again.",
    ],
    [
      { reason: "quota-exceeded", status: "failed" },
      "Your browser does not have enough storage to save this generation. Remove an attachment or free some space and try again.",
    ],
    [
      { reason: "unavailable", status: "failed" },
      "Unable to save your generation in this browser. Try again.",
    ],
  ] as const)(
    "maps recoverable persistence result %#",
    async (result, message) => {
      const repository = createRepository();
      repository.save.mockResolvedValue(result);
      const service = new GuestGenerationPreviewService({
        issueTicket: vi.fn().mockResolvedValue({ ticket: "promotion-ticket" }),
        repository,
      });

      await expect(service.prepare(createDraft())).rejects.toEqual(
        new GuestGenerationPreviewError(message),
      );
    },
  );
});

function createRepository() {
  return {
    clear: vi.fn(),
    read: vi.fn(),
    save: vi.fn(),
  } as unknown as GuestGenerationDraftRepository & {
    save: ReturnType<typeof vi.fn>;
  };
}

function createDraft(): GuestGenerationDraftInput {
  return {
    attachmentMedia: {
      audios: [],
      images: [],
      videos: [],
    },
    model: {
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
    } as unknown as PublishedGenerationModelSummary,
    prompt: "A glass studio above the ocean",
    settings: {
      aspectRatio: "1:1",
      modelType: "image",
      requestedGenerations: 1,
      resolution: "1024p",
    },
  };
}
