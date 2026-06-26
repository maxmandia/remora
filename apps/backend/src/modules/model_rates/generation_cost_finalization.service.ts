import { assertNever } from "@remora/utils";

import type { SeedanceVideoGenerationProviderCallback } from "../generation/generation.types.ts";
import {
  modelRatesRepository,
  type ModelRatesRepository,
} from "./model_rates.repository.ts";
import {
  GenerationJobFinalCostCalculationError,
  type GenerationJobFinalCost,
} from "./model_rates.types.ts";
import { calculateGenerationJobFinalCostFromProviderUsage } from "./generation_cost_finalization.utils.ts";

type FinalizeGenerationJobCostInput = {
  jobId: string;
  callback: Extract<
    SeedanceVideoGenerationProviderCallback,
    { kind: "result" }
  >;
};

type GenerationJobCostRecord = NonNullable<
  Awaited<ReturnType<ModelRatesRepository["getGenerationJobCostByJobId"]>>
>;

export class GenerationCostFinalizationService {
  constructor(
    private readonly repository: ModelRatesRepository = modelRatesRepository,
  ) {}

  async finalizeGenerationJobCost(
    input: FinalizeGenerationJobCostInput,
  ): Promise<void> {
    const cost = await this.repository.getGenerationJobCostByJobId(input.jobId);

    if (!cost) {
      throw new GenerationJobFinalCostCalculationError(
        `Generation job cost was not found for job ${input.jobId}`,
      );
    }

    const finalCost = await this.calculateGenerationJobFinalCost({
      ...input,
      cost,
    });

    await this.repository.finalizeGenerationJobCost({
      jobId: input.jobId,
      ...finalCost,
    });
  }

  private async calculateGenerationJobFinalCost(
    input: FinalizeGenerationJobCostInput & {
      cost: GenerationJobCostRecord;
    },
  ): Promise<GenerationJobFinalCost> {
    switch (input.callback.result.provider) {
      case "byteplus":
        return this.calculateBytePlusGenerationJobFinalCost(input);
      default:
        return assertNever(input.callback.result.provider);
    }
  }

  private async calculateBytePlusGenerationJobFinalCost(
    input: FinalizeGenerationJobCostInput & {
      cost: GenerationJobCostRecord;
    },
  ): Promise<GenerationJobFinalCost> {
    return calculateGenerationJobFinalCostFromProviderUsage({
      completionTokens: input.callback.result.usage?.completionTokens,
      estimatedCostSnapshot: input.cost.estimatedCostSnapshot,
    });
  }
}
