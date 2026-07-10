import { randomBytes } from "node:crypto";

export const provisionalGenerationThreadNameMaxLength = 48;
export const generatedGenerationThreadNameMaxLength = 60;

export function createProvisionalGenerationThreadName(
  prompt: string,
  fallbackSuffix = randomBytes(4).toString("hex"),
): string {
  const normalizedPrompt = normalizeGenerationThreadName(prompt);

  if (!normalizedPrompt) {
    return `Thread ${fallbackSuffix}`;
  }

  const characters = Array.from(normalizedPrompt);

  if (characters.length <= provisionalGenerationThreadNameMaxLength) {
    return normalizedPrompt;
  }

  const prefix = characters
    .slice(0, provisionalGenerationThreadNameMaxLength - 1)
    .join("");
  const lastWordBoundary = prefix.lastIndexOf(" ");
  const truncatedPrefix =
    lastWordBoundary > 0 ? prefix.slice(0, lastWordBoundary) : prefix;

  return `${truncatedPrefix.trimEnd()}…`;
}

export function normalizeGenerationThreadName(name: string): string {
  return name.replace(/\s+/gu, " ").trim();
}

export function isValidGeneratedGenerationThreadName(name: string): boolean {
  const normalizedName = normalizeGenerationThreadName(name);

  return (
    normalizedName.length > 0 &&
    Array.from(normalizedName).length <= generatedGenerationThreadNameMaxLength
  );
}
