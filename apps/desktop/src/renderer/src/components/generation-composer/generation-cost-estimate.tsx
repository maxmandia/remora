import type { PublishedGenerationModelSummary } from "@remora/backend/types";
import { skipToken, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { formatUsdMicrosCurrencyAmount } from "@remora/utils/currency";
import type { GenerationAttachmentMediaValue } from "../../lib/generation/attachment-media.ts";
import type { GenerationSettingsValue } from "../../lib/generation/index.ts";
import { toEstimateGenerationCostInput } from "../../lib/model-rates/generation-cost-estimate.ts";
import { useTRPC } from "../../lib/trpc.ts";

export function GenerationCostEstimate({
  attachmentMediaValue,
  generationSettings,
  selectedModel,
}: {
  attachmentMediaValue: GenerationAttachmentMediaValue;
  generationSettings: GenerationSettingsValue | null;
  selectedModel: PublishedGenerationModelSummary | null;
}) {
  const trpc = useTRPC();
  const generationCostEstimateInput = useMemo(
    () =>
      generationSettings && selectedModel
        ? toEstimateGenerationCostInput({
            attachmentMediaValue,
            generationSettings,
            selectedModel,
          })
        : null,
    [attachmentMediaValue, generationSettings, selectedModel],
  );

  const { data: generationCostEstimate } = useQuery({
    ...trpc.modelRates.estimateGenerationCost.queryOptions(
      generationCostEstimateInput ?? skipToken,
      {
        meta: { suppressErrorToast: true },
      },
    ),
    enabled: generationCostEstimateInput !== null,
  });

  return (
    <div className="text-secondary-foreground mr-2 flex items-center text-sm font-light">
      <span>
        ~{" "}
        {formatUsdMicrosCurrencyAmount(
          generationCostEstimate?.estimatedCostUsdMicros ?? 0,
        )}
      </span>
    </div>
  );
}
