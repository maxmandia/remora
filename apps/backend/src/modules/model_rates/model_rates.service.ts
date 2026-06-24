import {
  modelRatesRepository,
  type ModelRatesRepository,
} from "./model_rates.repository.ts";
import {
  GenerationModelRatesNotFoundError,
  type EstimateGenerationCostInput,
  type GenerationCostEstimate,
} from "./model_rates.types.ts";
import {
  buildGenerationCostLineItems,
  buildJobFactsForLineItems,
} from "./model_rates.utils.ts";

export class ModelRatesService {
  constructor(
    private readonly repository: ModelRatesRepository = modelRatesRepository,
  ) {}

  async estimateGenerationCost(
    input: EstimateGenerationCostInput,
  ): Promise<GenerationCostEstimate> {
    const rates = await this.loadActiveModelRates(input);
    const jobFacts = buildJobFactsForLineItems(input);
    const lineItems = buildGenerationCostLineItems({
      rates,
      jobFacts,
    });
    const estimatedCostUsdMicros = lineItems.reduce(
      (totalCostUsdMicros, lineItem) =>
        totalCostUsdMicros + lineItem.estimatedCostUsdMicros,
      0,
    );

    return {
      estimatedCostUsdMicros,
      currencyCode: "USD",
    };
  }

  private async loadActiveModelRates(input: EstimateGenerationCostInput) {
    const rates = await this.repository.listModelRates(input.modelId);

    if (rates.length === 0) {
      throw new GenerationModelRatesNotFoundError(input.modelId);
    }

    return rates;
  }
}

export const modelRatesService = new ModelRatesService();
