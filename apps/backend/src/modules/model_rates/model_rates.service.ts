import type {
  EstimateGenerationCostInput,
  GenerationCostEstimate,
} from "./model_rates.types.ts";

export class ModelRatesService {
  estimateGenerationCost(
    _input: EstimateGenerationCostInput,
  ): GenerationCostEstimate {
    return {
      estimatedCostUsdMicros: 0,
      currencyCode: "USD",
    };
  }
}

export const modelRatesService = new ModelRatesService();
