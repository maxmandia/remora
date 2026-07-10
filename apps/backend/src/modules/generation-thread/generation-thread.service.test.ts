import { describe, expect, it, vi } from "vitest";

import { GenerationThreadService } from "./generation-thread.service.ts";
import { GenerationThreadNameUnavailableError } from "./generation-thread.types.ts";

describe("GenerationThreadService", () => {
  it("generates a normalized structured name from only the prompt", async () => {
    const parse = vi.fn().mockResolvedValue({
      output_parsed: { name: "  Quiet   Ocean Studio  " },
    });
    const service = createService(parse);

    await expect(
      service.generateName({
        threadId: "thread_1",
        prompt: "A quiet ocean studio with blue light",
      }),
    ).resolves.toBe("Quiet Ocean Studio");

    expect(parse).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-5.4-nano",
        store: false,
        input: [
          expect.objectContaining({ role: "developer" }),
          {
            role: "user",
            content: "A quiet ocean studio with blue light",
          },
        ],
        text: { format: expect.anything() },
      }),
      {
        maxRetries: 0,
        timeout: 10_000,
      },
    );
  });

  it("rejects refusals and malformed structured output", async () => {
    const refusalService = createService(
      vi.fn().mockResolvedValue({ output_parsed: null }),
    );
    const invalidService = createService(
      vi.fn().mockResolvedValue({
        output_parsed: { name: "x".repeat(61) },
      }),
    );

    await expect(
      refusalService.generateName({
        threadId: "thread_1",
        prompt: "Prompt",
      }),
    ).rejects.toBeInstanceOf(GenerationThreadNameUnavailableError);
    await expect(
      invalidService.generateName({
        threadId: "thread_1",
        prompt: "Prompt",
      }),
    ).rejects.toBeInstanceOf(GenerationThreadNameUnavailableError);
  });

  it("propagates provider failures for Temporal to retry", async () => {
    const service = createService(
      vi.fn().mockRejectedValue(new Error("Provider unavailable")),
    );

    await expect(
      service.generateName({
        threadId: "thread_1",
        prompt: "Prompt",
      }),
    ).rejects.toThrow("Provider unavailable");
  });
});

function createService(parse: ReturnType<typeof vi.fn>) {
  return new GenerationThreadService({
    responses: { parse },
  } as unknown as ConstructorParameters<typeof GenerationThreadService>[0]);
}
