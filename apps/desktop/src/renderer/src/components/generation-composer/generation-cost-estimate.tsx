import { formatUsdMicrosCurrencyAmount } from "@remora/utils/currency";

export function GenerationCostEstimate({
  estimatedCostUsdMicros,
  isInsufficientCredits,
  isLoading,
}: {
  estimatedCostUsdMicros: number | null;
  isInsufficientCredits: boolean;
  isLoading: boolean;
}) {
  if (isLoading || estimatedCostUsdMicros === null) {
    return null;
  }

  return (
    <div
      className={[
        "mr-2 flex items-center text-sm font-light",
        isInsufficientCredits
          ? "text-destructive"
          : "text-secondary-foreground",
      ].join(" ")}
    >
      <span>~ {formatUsdMicrosCurrencyAmount(estimatedCostUsdMicros)}</span>
    </div>
  );
}
