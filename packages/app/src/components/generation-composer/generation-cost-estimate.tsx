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
    <div className="text-secondary-foreground mr-2 text-sm font-light">
      <span className={isInsufficientCredits ? "text-destructive" : undefined}>
        ~ {formatUsdMicrosCurrencyAmount(estimatedCostUsdMicros)}
      </span>
    </div>
  );
}
