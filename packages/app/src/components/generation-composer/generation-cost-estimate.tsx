import { Button } from "@remora/ui";
import { formatUsdMicrosCurrencyAmount } from "@remora/utils/currency";

export function GenerationCostEstimate({
  estimatedCostUsdMicros,
  isInsufficientCredits,
  isLoading,
  onBuyCredits,
}: {
  estimatedCostUsdMicros: number | null;
  isInsufficientCredits: boolean;
  isLoading: boolean;
  onBuyCredits: () => void;
}) {
  if (isLoading || estimatedCostUsdMicros === null) {
    return null;
  }

  return (
    <div className="text-secondary-foreground mr-2 flex items-center gap-2 text-sm font-light">
      {isInsufficientCredits ? (
        <Button size="xs" type="button" onClick={onBuyCredits}>
          Buy credits
        </Button>
      ) : null}
      <span className={isInsufficientCredits ? "text-destructive" : undefined}>
        ≈ {formatUsdMicrosCurrencyAmount(estimatedCostUsdMicros)}
      </span>
    </div>
  );
}
