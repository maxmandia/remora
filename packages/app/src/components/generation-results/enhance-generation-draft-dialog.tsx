import type { GenerationThreadSubmission } from "@remora/domain/generation-submission/dto";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@remora/ui";
import { useQuery } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";

import { formatUsdMicrosCurrencyAmount } from "@remora/utils/currency";
import { useEnhanceGenerationDraftMutation } from "../../hooks/use-enhance-generation-draft-mutation.ts";
import { useTRPC } from "../../trpc.ts";

export function EnhanceGenerationDraftDialog({
  onOpenChange,
  open,
  submission,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  submission: Extract<GenerationThreadSubmission, { modelType: "video" }>;
}) {
  const trpc = useTRPC();
  const quote = useQuery(
    trpc.generation.getDraftEnhancementQuote.queryOptions(
      { submissionId: submission.id },
      { enabled: open },
    ),
  );
  const balance = useQuery(
    trpc.credits.getBalance.queryOptions(undefined, { enabled: open }),
  );
  const enhancement = useEnhanceGenerationDraftMutation();
  const eligibleDraftCount = quote.data?.eligibleDraftCount ?? 0;
  const hasInsufficientCredits = Boolean(
    quote.data &&
    balance.data &&
    balance.data.availableCreditAmountUsdMicros <
      quote.data.estimatedCostUsdMicros,
  );
  const isQuotePending = quote.isPending || balance.isPending;
  const isConfirmDisabled =
    isQuotePending ||
    enhancement.isPending ||
    !quote.data ||
    !balance.data ||
    hasInsufficientCredits;

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && !enhancement.isPending) {
      enhancement.reset();
    }

    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent aria-label="Enhance draft">
        <DialogHeader>
          <DialogTitle>Enhance draft</DialogTitle>
          <DialogDescription>
            {quote.data
              ? eligibleDraftCount > 1
                ? `All ${eligibleDraftCount} completed drafts will be rendered at full quality using their original settings.`
                : "This draft will be rendered at full quality using its original settings." +
                  ` Estimated cost is ${formatUsdMicrosCurrencyAmount(quote.data.estimatedCostUsdMicros)}.`
              : "Confirming which completed drafts can be rendered at full quality."}
          </DialogDescription>
        </DialogHeader>

        {(hasInsufficientCredits || quote.error || enhancement.error) && (
          <div className="space-y-2 text-sm">
            {hasInsufficientCredits ? (
              <p className="text-destructive">
                Your available credit balance is too low for this enhancement.
              </p>
            ) : null}
            {quote.error ? (
              <p className="text-destructive">{quote.error.message}</p>
            ) : null}
            {enhancement.error ? (
              <p className="text-destructive">{enhancement.error.message}</p>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button
            disabled={enhancement.isPending}
            onClick={() => handleOpenChange(false)}
            type="button"
            variant="ghost"
          >
            Cancel
          </Button>
          <Button
            disabled={isConfirmDisabled}
            onClick={() => {
              if (!quote.data) {
                return;
              }

              void enhancement
                .enhanceDraft(submission, quote.data.eligibleDraftCount)
                .then(() => handleOpenChange(false))
                .catch(() => undefined);
            }}
            type="button"
          >
            {enhancement.isPending ? (
              <Loader2Icon className="animate-spin" />
            ) : null}
            Enhance
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
