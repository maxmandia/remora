import type { GenerationProviderModelValidationInput } from "../provider.types.ts";

const bytePlusSeedanceVideoAdapter = "byteplus_seedance_video";

export function validateBytePlusSeedanceVideoModel({
  model,
  spec,
}: GenerationProviderModelValidationInput): string[] {
  const adapter = bytePlusSeedanceVideoAdapter;
  const issues: string[] = [];

  if (model.providerId !== "byteplus" || model.type !== "video") {
    issues.push(
      `Adapter ${adapter} is not compatible with ${model.providerId}/${model.type}`,
    );
  }

  if (!spec.providerModelId) {
    issues.push(`Adapter ${adapter} requires providerModelId`);
  }

  if (spec.endpoint.method !== "POST") {
    issues.push(`Adapter ${adapter} requires a POST endpoint`);
  }

  if (spec.modelParameter.source !== "spec") {
    issues.push(`Adapter ${adapter} requires a spec-sourced model parameter`);
  }

  if (
    !spec.transforms.some(
      (transform) => transform.kind === "seedanceContentArray",
    )
  ) {
    issues.push(`Adapter ${adapter} requires seedanceContentArray transform`);
  }

  for (const fieldId of [
    "prompt",
    "resolution",
    "aspectRatio",
    "duration",
    "generateAudio",
  ]) {
    if (!spec.fields.some((field) => field.id === fieldId)) {
      issues.push(`Adapter ${adapter} requires field ${fieldId}`);
    }
  }

  const requiredFields = new Map([
    ["prompt", ["string"]],
    ["resolution", ["string"]],
    ["aspectRatio", ["string"]],
    ["duration", ["integer", "number"]],
    ["generateAudio", ["boolean"]],
  ]);

  for (const [fieldId, valueKinds] of requiredFields) {
    const field = spec.fields.find((candidate) => candidate.id === fieldId);

    if (field && !valueKinds.includes(field.valueKind)) {
      issues.push(
        `Adapter ${adapter} field ${fieldId} cannot use ${field.valueKind}`,
      );
    }

    if (
      field &&
      (fieldId === "resolution" || fieldId === "aspectRatio") &&
      (!field.options || field.options.length === 0)
    ) {
      issues.push(`Adapter ${adapter} field ${fieldId} must declare options`);
    }
  }

  return issues;
}
