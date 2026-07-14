import { assertNever } from "@remora/utils";

import type { TransactionManager } from "../../db/transaction-manager.ts";
import type { GenerationProviderCallback } from "../generation/generation.types.ts";
import type { ModelRatesRepository } from "./model_rates.repository.ts";
import {
  GenerationJobFinalCostCalculationError,
  type GenerationJobFinalCost,
  type GenerationJobFinalCostBasis,
  type GenerationJobProviderCost,
  type GenerationJobProviderCostSnapshot,
} from "./model_rates.types.ts";
import {
  calculateGenerationJobFinalCostFromProviderUsage,
  calculateGenerationJobProviderCostFromProviderUsage,
} from "./generation_cost_finalization.utils.ts";

type FinalizeGenerationJobCostInput = {
  jobId: string;
  callback: Extract<GenerationProviderCallback, { kind: "result" }>;
};

type GenerationJobCostRecord = NonNullable<
  Awaited<ReturnType<ModelRatesRepository["getGenerationJobCostByJobId"]>>
>;

type FinalizedGenerationJobCostRecord = GenerationJobCostRecord & {
  finalCostUsdMicros: number;
  finalCostBasis: GenerationJobFinalCostBasis;
  finalizedAt: Date;
  providerCostUsdMicros: number;
  providerCostSnapshot: GenerationJobProviderCostSnapshot;
};

export class GenerationCostFinalizationService {
  private readonly transactionManager: TransactionManager;

  constructor(options: { transactionManager: TransactionManager }) {
    this.transactionManager = options.transactionManager;
  }

  async finalizeGenerationJobCost(
    input: FinalizeGenerationJobCostInput,
  ): Promise<FinalizedGenerationJobCostRecord> {
    return this.transactionManager.transaction(async (tx) => {
      const repository = tx.modelRates;
      let cost = await repository.getGenerationJobCostByJobId(input.jobId);

      if (!cost) {
        throw new GenerationJobFinalCostCalculationError(
          `Generation job cost was not found for job ${input.jobId}`,
        );
      }

      const finalCost = await this.calculateGenerationJobFinalCost({
        ...input,
        cost,
      });

      const providerCost = await this.calculateGenerationJobProviderCost({
        ...input,
        cost,
      });

      cost = await this.finalizeCustomerCost({
        cost,
        finalCost,
        jobId: input.jobId,
        repository,
      });
      cost = await this.finalizeProviderCost({
        cost,
        jobId: input.jobId,
        providerCost,
        repository,
      });

      return this.assertFinalizedGenerationJobCost({
        cost,
        jobId: input.jobId,
      });
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

  private async calculateGenerationJobProviderCost(
    input: FinalizeGenerationJobCostInput & {
      cost: GenerationJobCostRecord;
    },
  ): Promise<GenerationJobProviderCost> {
    switch (input.callback.result.provider) {
      case "byteplus":
        if (input.callback.result.status !== "succeeded") {
          throw new GenerationJobFinalCostCalculationError(
            `Generation job provider cost can only be accrued for succeeded jobs: ${input.jobId}`,
          );
        }

        return calculateGenerationJobProviderCostFromProviderUsage({
          completionTokens: input.callback.result.usage?.completionTokens,
          totalTokens: input.callback.result.usage?.totalTokens,
          providerModelId: input.callback.result.providerModelId,
          providerTaskId: input.callback.result.providerTaskId,
          estimatedCostSnapshot: input.cost.estimatedCostSnapshot,
        });
      default:
        return assertNever(input.callback.result.provider);
    }
  }

  private async finalizeCustomerCost({
    cost,
    finalCost,
    jobId,
    repository,
  }: {
    cost: GenerationJobCostRecord;
    finalCost: GenerationJobFinalCost;
    jobId: string;
    repository: ModelRatesRepository;
  }): Promise<GenerationJobCostRecord> {
    if (cost.finalizedAt) {
      if (
        cost.finalCostUsdMicros === finalCost.finalCostUsdMicros &&
        cost.finalCostBasis === finalCost.finalCostBasis
      ) {
        return cost;
      }

      throw new GenerationJobFinalCostCalculationError(
        `Generation job cost was already finalized with conflicting values for job ${jobId}`,
      );
    }

    return repository.finalizeGenerationJobCost({
      jobId,
      ...finalCost,
    });
  }

  private async finalizeProviderCost({
    cost,
    jobId,
    providerCost,
    repository,
  }: {
    cost: GenerationJobCostRecord;
    jobId: string;
    providerCost: GenerationJobProviderCost;
    repository: ModelRatesRepository;
  }): Promise<GenerationJobCostRecord> {
    if (
      cost.providerCostUsdMicros !== null ||
      cost.providerCostSnapshot !== null
    ) {
      if (
        this.matchesExistingGenerationJobProviderCost({
          cost,
          providerCost,
        })
      ) {
        return cost;
      }

      throw new GenerationJobFinalCostCalculationError(
        `Generation job provider cost already exists with conflicting values for job ${jobId}`,
      );
    }

    return repository.setGenerationJobProviderCost({
      jobId,
      providerCostUsdMicros: providerCost.providerCostUsdMicros,
      providerCostSnapshot: providerCost.providerCostSnapshot,
    });
  }

  private assertFinalizedGenerationJobCost({
    cost,
    jobId,
  }: {
    cost: GenerationJobCostRecord;
    jobId: string;
  }): FinalizedGenerationJobCostRecord {
    if (
      cost.finalCostUsdMicros === null ||
      cost.finalCostBasis === null ||
      cost.finalizedAt === null ||
      cost.providerCostUsdMicros === null ||
      cost.providerCostSnapshot === null
    ) {
      throw new GenerationJobFinalCostCalculationError(
        `Generation job cost was not fully finalized for job ${jobId}`,
      );
    }

    return cost as FinalizedGenerationJobCostRecord;
  }

  private matchesExistingGenerationJobProviderCost({
    cost,
    providerCost,
  }: {
    cost: GenerationJobCostRecord;
    providerCost: GenerationJobProviderCost;
  }) {
    return (
      cost.providerCostUsdMicros === providerCost.providerCostUsdMicros &&
      this.matchesProviderCostSnapshot({
        existing: cost.providerCostSnapshot,
        expected: providerCost.providerCostSnapshot,
      })
    );
  }

  private matchesProviderCostSnapshot({
    existing,
    expected,
  }: {
    existing: GenerationJobProviderCostSnapshot | null;
    expected: GenerationJobProviderCostSnapshot;
  }) {
    if (!existing) {
      return false;
    }

    return (
      existing.schemaVersion === expected.schemaVersion &&
      existing.source === expected.source &&
      existing.provider === expected.provider &&
      existing.providerTaskId === expected.providerTaskId &&
      existing.providerModelId === expected.providerModelId &&
      existing.usage.completionTokens === expected.usage.completionTokens &&
      existing.usage.totalTokens === expected.usage.totalTokens &&
      existing.lineItem.rateId === expected.lineItem.rateId &&
      existing.lineItem.component === expected.lineItem.component &&
      existing.lineItem.finalQuantitySource ===
        expected.lineItem.finalQuantitySource &&
      existing.lineItem.quantityUnit === expected.lineItem.quantityUnit &&
      existing.lineItem.unitQuantity === expected.lineItem.unitQuantity &&
      existing.lineItem.unitPriceUsdMicros ===
        expected.lineItem.unitPriceUsdMicros &&
      existing.lineItem.amountUsdMicros === expected.lineItem.amountUsdMicros &&
      existing.amountUsdMicros === expected.amountUsdMicros
    );
  }
}
