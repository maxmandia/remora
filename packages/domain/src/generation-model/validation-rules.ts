import { z } from "zod";

export const generationValidationRules = [
  "seedance20ContentRules",
  "klingTextToVideoRules",
] as const;

export type GenerationValidationRule =
  (typeof generationValidationRules)[number];

export const generationValidationRuleSchema = z.enum(
  generationValidationRules,
);

export const generationValidationRulesSchema = z.array(
  generationValidationRuleSchema,
);

export function parseGenerationValidationRules(
  value: unknown,
): GenerationValidationRule[] {
  return generationValidationRulesSchema.parse(value);
}
