import {
  modelRatesRepository,
  type ModelRatesRepository,
} from "./model_rates.repository.ts";
import {
  GenerationModelRatesNotFoundError,
  type EstimateGenerationCostInput,
  type GenerationCostEstimate,
  type GenerationJobCostEstimate,
} from "./model_rates.types.ts";
import { buildGenerationJobCostEstimate } from "./model_rates.utils.ts";

export class ModelRatesService {
  constructor(
    private readonly repository: ModelRatesRepository = modelRatesRepository,
  ) {}

  async estimateGenerationCostForAllJobs(
    input: EstimateGenerationCostInput,
  ): Promise<GenerationCostEstimate> {
    const jobEstimate = await this.estimateGenerationCostForSingleJob(input);

    return {
      estimatedCostUsdMicros:
        jobEstimate.estimatedCostUsdMicros * input.requestedGenerations,
      currencyCode: "USD",
    };
  }

  async estimateGenerationCostForSingleJob(
    input: EstimateGenerationCostInput,
  ): Promise<GenerationJobCostEstimate> {
    const rates = await this.loadActiveModelRates(input);

    return buildGenerationJobCostEstimate({ input, rates });
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
