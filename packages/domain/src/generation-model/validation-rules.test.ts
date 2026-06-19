import { describe, expect, it } from "vitest";

import {
  parseGenerationValidationRules,
  type GenerationValidationRule,
} from "./validation-rules.ts";

describe("generation validation rules", () => {
  it("parses known validation rules", () => {
    expect(
      parseGenerationValidationRules([
        "seedance20ContentRules",
        "klingTextToVideoRules",
      ]),
    ).toEqual([
      "seedance20ContentRules",
      "klingTextToVideoRules",
    ] satisfies GenerationValidationRule[]);
  });

  it("rejects unknown validation rules", () => {
    expect(() =>
      parseGenerationValidationRules(["unknownProviderRules"]),
    ).toThrow();
  });
});
