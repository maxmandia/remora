import type { TransactionManager } from "../../db/transaction-manager.ts";
import type { SeedanceVideoGenerationProviderCallback } from "../generation/generation.types.ts";
import {
  modelRatesRepository,
  type ModelRatesRepository,
} from "./model_rates.repository.ts";
import {
  GenerationJobFinalCostCalculationError,
  GenerationModelRatesNotFoundError,
  GenerationPricingPolicyNotFoundError,
  type EstimateGenerationCostInput,
  type GenerationCostEstimate,
  type GenerationJobCost,
} from "./model_rates.types.ts";
import { buildGenerationJobCostEstimate } from "./model_rates.utils.ts";

export class ModelRatesService {
  private readonly transactionManager: TransactionManager;

  constructor(
    private readonly repository: ModelRatesRepository = modelRatesRepository,
    options: {
      transactionManager: TransactionManager;
    },
  ) {
    this.transactionManager = options.transactionManager;
  }

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
  ): Promise<GenerationJobCost> {
    const rates = await this.loadModelSpecRates(input);
    const pricingPolicy = await this.loadCurrentGenerationPricingPolicy();

    return buildGenerationJobCostEstimate({ input, pricingPolicy, rates });
  }

  async settleGenerationJobCost(input: {
    jobId: string;
    callback: Extract<
      SeedanceVideoGenerationProviderCallback,
      { kind: "result" }
    >;
  }): Promise<void> {
    await this.transactionManager.transaction(async (tx) => {
      const job = await tx.generation.getGenerationJobById(input.jobId);

      if (!job) {
        throw new GenerationJobFinalCostCalculationError(
          `Generation job was not found for job ${input.jobId}`,
        );
      }

      const finalizedCost =
        await tx.services.generationCostFinalization.finalizeGenerationJobCost(
          input,
        );

      await tx.services.credits.settleGenerationJobCost({
        userId: job.userId,
        generationJobId: input.jobId,
        generationJobCostId: finalizedCost.id,
        estimatedCostUsdMicros: finalizedCost.estimatedCostUsdMicros,
        finalCostUsdMicros: finalizedCost.finalCostUsdMicros,
      });
    });
  }

  private async loadModelSpecRates(input: EstimateGenerationCostInput) {
    const rates = await this.repository.listModelRates(input.modelSpecId);

    if (rates.length === 0) {
      throw new GenerationModelRatesNotFoundError(input.modelSpecId);
    }

    return rates;
  }

  private async loadCurrentGenerationPricingPolicy() {
    const pricingPolicy =
      await this.repository.getCurrentGenerationPricingPolicy();

    if (!pricingPolicy) {
      throw new GenerationPricingPolicyNotFoundError();
    }

    return pricingPolicy;
  }
}
