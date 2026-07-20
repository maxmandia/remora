# Image Model Support Readiness

This document records the application changes required before Remora can support image-generation models alongside its existing video-generation models. It is a pre-implementation assessment, not the official implementation plan.

Adding an image-model catalog definition alone is not sufficient. The catalog, generation request contract, workflow, pricing, persistence, analytics, and desktop result renderer currently contain explicit video-only assumptions.

## Required Changes

### 1. Model Catalog and Schema

- Extend `GenerationModelType` and the `generation_model_type` PostgreSQL enum from `"video"` to `"video" | "image"`.
- Introduce an `ImageModelSpec`, preferably as part of a discriminated union with `VideoModelSpec`.
- Extract the mostly generic field and specification primitives currently named `Video*` instead of duplicating them for images.
- Add the first image provider when necessary.
- Register an executable image adapter and its validator before publishing an image model.

The current type, validators, adapter registry, and persisted model specification are explicitly video-only:

- [`apps/backend/src/modules/model/model.types.ts`](../../apps/backend/src/modules/model/model.types.ts)
- [`apps/backend/src/modules/model/model.utils.ts`](../../apps/backend/src/modules/model/model.utils.ts)
- [`apps/backend/src/modules/model/schema/table.ts`](../../apps/backend/src/modules/model/schema/table.ts)
- [`apps/backend/src/modules/generation/providers/provider.utils.ts`](../../apps/backend/src/modules/generation/providers/provider.utils.ts)

### 2. Submission and API Contracts

The current generation input always requires:

- `resolution`
- `aspectRatio`
- `duration`
- `generateAudio`

The only creation mutation is `generation.createVideo`.

Image support should use either:

1. Separate discriminated `createImage` and `createVideo` inputs over shared orchestration, or
2. A generic `createGeneration` input discriminated by model type.

The persisted `submitted_input` JSON must remain backward-compatible with existing video submissions. The thread response should expose `modelType` so consumers can render the correct modality without inferring it from the submitted fields.

Relevant code:

- [`apps/backend/src/modules/generation/generation.types.ts`](../../apps/backend/src/modules/generation/generation.types.ts)
- [`apps/backend/src/modules/generation/generation.router.ts`](../../apps/backend/src/modules/generation/generation.router.ts)
- [`apps/backend/src/modules/generation/generation.repository.ts`](../../apps/backend/src/modules/generation/generation.repository.ts)

### 3. Provider Adapter and Execution Lifecycle

Task creation and callback normalization currently switch only over registered video adapters. The first image provider needs:

- An adapter identifier and catalog validation.
- A request payload builder and provider client.
- Provider response normalization.
- A modality-tagged output contract, such as `assets: [{ kind: "image", url }]`, instead of the singular `videoUrl`.
- Support for the provider's actual execution lifecycle: synchronous response, polling, or callback.

The existing Temporal workflow always creates a video task, waits up to 24 hours for a provider callback, saves a video, and optionally extracts a preview frame. Image generation should not be forced through those assumptions.

Existing video workflows can remain active for 24 hours. The implementation plan must therefore account for Temporal replay and deployment compatibility, likely through a new workflow or activity contract instead of an unversioned rewrite of the running video workflow.

Relevant code:

- [`apps/backend/src/modules/generation/generation.service.ts`](../../apps/backend/src/modules/generation/generation.service.ts)
- [`apps/backend/src/temporal/workflows.ts`](../../apps/backend/src/temporal/workflows.ts)
- [`apps/backend/src/temporal/activities.ts`](../../apps/backend/src/temporal/activities.ts)
- [`apps/backend/src/temporal/types.ts`](../../apps/backend/src/temporal/types.ts)

### 4. Output Persistence and Storage

The `generation_result_asset` table is a useful generic foundation, but its kind enum currently accepts only `"video"`. The `generation_result` table also retains a dedicated `video_url` column.

Recommended direction:

- Add `"image"` to `generation_result_asset_kind`.
- Make stored result assets the authoritative output representation.
- Keep `video_url` temporarily for backward compatibility instead of adding an `image_url` sibling.
- Generalize generated-media object-key creation and import activities; the current implementation hardcodes `video.mp4`.
- Use the stored image itself as its initial preview. A separate thumbnail pipeline can be added later if performance requirements justify it.

One product decision affects the asset schema: whether a job is guaranteed to produce exactly one image. The current unique constraint permits only one asset of each kind per result. If one provider task may return several images, assets need an ordinal and uniqueness such as `(result_id, kind, position)`.

Relevant code:

- [`apps/backend/src/modules/generation/schema/table.ts`](../../apps/backend/src/modules/generation/schema/table.ts)
- [`apps/backend/src/modules/generation/generation.utils.ts`](../../apps/backend/src/modules/generation/generation.utils.ts)
- [`apps/backend/src/modules/storage/object-storage.service.ts`](../../apps/backend/src/modules/storage/object-storage.service.ts)

### 5. Pricing and Rate Limits

The current pricing system can represent input images, but it cannot describe an output image. Output billing is based on video duration or video tokens.

Likely additions include:

- An `output_image` rate component.
- An image-appropriate quantity source, such as output image count, pixels, megapixels, or provider tokens.
- Conditions for size, quality, resolution, or other provider-specific pricing dimensions.
- Modality-aware job facts instead of mandatory video duration and audio facts.
- Rate-limit facts that do not require a video output resolution.

Final cost calculation currently selects its strategy by provider. That may need to dispatch by adapter or pricing configuration if the same provider bills image and video models differently.

Relevant code:

- [`apps/backend/src/modules/model_rates/model_rates.types.ts`](../../apps/backend/src/modules/model_rates/model_rates.types.ts)
- [`apps/backend/src/modules/model_rates/model_rates.utils.ts`](../../apps/backend/src/modules/model_rates/model_rates.utils.ts)
- [`apps/backend/src/modules/model_rates/generation_cost_finalization.service.ts`](../../apps/backend/src/modules/model_rates/generation_cost_finalization.service.ts)
- [`apps/backend/src/modules/model_rate_limits/model_rate_limits.types.ts`](../../apps/backend/src/modules/model_rate_limits/model_rate_limits.types.ts)

### 6. Desktop Composer and Result Rendering

The desktop cannot initialize a model unless resolution, aspect ratio, duration, and audio defaults all exist. An image model without video-only fields would leave generation disabled.

Required UI changes include:

- Modality-aware settings state and defaults.
- Rendering only the settings supported by the selected model specification.
- Submitting through the appropriate mutation.
- Updating optimistic submissions to retain the correct input shape and model type.
- Adding image output tiles and full-screen image viewing instead of video playback.
- Rendering submitted metadata based on the fields that are present.
- Dispatching result rendering by `modelType` or a tagged output asset.

The model selector itself can already list image models because it does not filter by modality. The video-specific assumptions begin in settings initialization, submission, and output rendering.

Relevant code:

- [`apps/desktop/src/renderer/src/lib/generation/index.ts`](../../apps/desktop/src/renderer/src/lib/generation/index.ts)
- [`apps/desktop/src/renderer/src/modules/generation/use-create-generation-submission-mutation.ts`](../../apps/desktop/src/renderer/src/modules/generation/use-create-generation-submission-mutation.ts)
- [`apps/desktop/src/renderer/src/components/generation-composer/generation-settings.tsx`](../../apps/desktop/src/renderer/src/components/generation-composer/generation-settings.tsx)
- [`apps/desktop/src/renderer/src/components/generation-submission/generation-submission-outputs.tsx`](../../apps/desktop/src/renderer/src/components/generation-submission/generation-submission-outputs.tsx)
- [`apps/desktop/src/renderer/src/components/generation-submission/generation-preview-tile.tsx`](../../apps/desktop/src/renderer/src/components/generation-submission/generation-preview-tile.tsx)

### 7. Analytics and Observability

Generation analytics currently require video duration and audio fields. They should become modality-aware while preserving the meaning of existing event properties.

Recommended additions include:

- A `model_type` property on generation events.
- Image-specific properties where they are useful.
- Optional or modality-discriminated video properties rather than fabricated values for image generations.

Relevant code:

- [`apps/backend/src/modules/analytics/analytics.types.ts`](../../apps/backend/src/modules/analytics/analytics.types.ts)
- [`apps/backend/src/modules/analytics/analytics.service.ts`](../../apps/backend/src/modules/analytics/analytics.service.ts)

## Existing Foundations That Can Be Reused

Image-model support does not require rewriting the entire generation system. The following foundations are already generic or close to generic:

- Projects and generation threads.
- Submissions, jobs, terminal statuses, and requested-output fan-out.
- Credit reservations and settlement orchestration, once pricing facts support images.
- Realtime generation invalidation.
- The published-model list and desktop model selector.
- Attachment upload and validation, which already support image inputs.
- Remote-object download, R2 storage, and signed URLs.
- Versioned catalog definitions and the adapter publication gate.
- Pricing records and rate-limit buckets.
- The multi-output job model, provided one job continues to represent one generated output.

The clean architectural boundary is to generalize the generation domain around modality-tagged inputs and result assets while retaining provider-specific request, response, and lifecycle behavior inside registered adapters.

## Decisions Required Before the Official Plan

The following decisions materially affect the implementation shape:

1. Which image provider and model will be implemented first?
2. Does one generation job always correspond to exactly one output image?
3. Does the provider return synchronously, require polling, or support callbacks?
4. What is the provider's billable unit and final-cost source?
5. Which image-specific controls are required for the first release, such as size, aspect ratio, quality, format, seed, masks, or reference images?

Once these are known, the official implementation plan can separate the modality-generalization work from the provider-specific adapter and catalog migration.
