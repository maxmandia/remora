export type PrimitiveSelectValue = string | number | boolean;

// Lowercased, dot-prefixed extension (e.g. ".heic"), or "" when the name has none.
export function getFileExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");

  if (dotIndex <= 0 || dotIndex === fileName.length - 1) {
    return "";
  }

  return fileName.slice(dotIndex).toLowerCase();
}

export type PrimitiveSelectItem = {
  label: string;
  value: PrimitiveSelectValue;
};

export function toPrimitiveSelectItems<T extends PrimitiveSelectItem>(
  options: readonly T[] = [],
): PrimitiveSelectItem[] {
  return options.map(({ label, value }) => ({ label, value }));
}

export function isPrimitiveSelectValue(
  value: unknown,
): value is PrimitiveSelectValue {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

export function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${String(value)}`);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
