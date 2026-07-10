import { describe, expect, it } from "vitest";

import {
  createProvisionalGenerationThreadName,
  isValidGeneratedGenerationThreadName,
  normalizeGenerationThreadName,
  provisionalGenerationThreadNameMaxLength,
} from "./generation-thread.utils.ts";

describe("generation thread name utilities", () => {
  it("uses short prompts without changing their language, casing, or punctuation", () => {
    expect(
      createProvisionalGenerationThreadName(
        "Crépuscule sur l'océan!",
        "unused",
      ),
    ).toBe("Crépuscule sur l'océan!");
  });

  it("collapses prompt whitespace", () => {
    expect(
      createProvisionalGenerationThreadName(
        "  A quiet\n\t ocean   studio  ",
        "unused",
      ),
    ).toBe("A quiet ocean studio");
    expect(normalizeGenerationThreadName("  A\n  B  ")).toBe("A B");
  });

  it("truncates long prompts at a word boundary with an ellipsis", () => {
    const name = createProvisionalGenerationThreadName(
      "A cinematic portrait of a diver beneath glowing bioluminescent waves at midnight",
      "unused",
    );

    expect(name).toMatch(/…$/u);
    expect(Array.from(name).length).toBeLessThanOrEqual(
      provisionalGenerationThreadNameMaxLength,
    );
    expect(name).not.toContain("bioluminescent");
  });

  it("hard-truncates a single long token without splitting Unicode characters", () => {
    const name = createProvisionalGenerationThreadName(
      "😀".repeat(60),
      "unused",
    );

    expect(name).toBe(`${"😀".repeat(47)}…`);
    expect(Array.from(name)).toHaveLength(48);
  });

  it("falls back to the thread hash when the prompt is unusable", () => {
    expect(createProvisionalGenerationThreadName(" \n\t ", "1a2b3c4d")).toBe(
      "Thread 1a2b3c4d",
    );
  });

  it("validates normalized generated names against the stored limit", () => {
    expect(isValidGeneratedGenerationThreadName("Quiet Ocean Studio")).toBe(
      true,
    );
    expect(isValidGeneratedGenerationThreadName("   ")).toBe(false);
    expect(isValidGeneratedGenerationThreadName("x".repeat(61))).toBe(false);
  });
});
