import type { ModelDefinitionPlan } from "./model.types.ts";
import { modelRepository, type ModelRepository } from "./model.repository.ts";
import {
  buildModelDefinitionPlan,
  validateModelDefinition,
} from "./model.utils.ts";

export class ModelService {
  constructor(private readonly repository: ModelRepository = modelRepository) {}

  async planDefinition(value: unknown): Promise<ModelDefinitionPlan> {
    const definition = validateModelDefinition(value);
    const current = await this.repository.loadCatalogState({
      modelId: definition.model.id,
      providerId: definition.model.providerId,
    });

    return buildModelDefinitionPlan({ definition, current });
  }
}

export const modelService = new ModelService();
