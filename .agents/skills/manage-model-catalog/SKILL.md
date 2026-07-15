---
name: manage-model-catalog
description: Manage Remora generation models through canonical definitions and reviewed migrations. Use when adding, versioning, repricing, publishing, archiving, or reviewing a model, its pricing, or its rate limits.
---

# Manage Model Catalog

## Workflow

1. Ask the user to provide or confirm links supporting model capabilities, pricing, and rate limits. Inspect those links before editing, record the verified URLs in `sourceUrls`, and ask about unsupported or conflicting facts.
2. Inspect `apps/backend/catalog/models`, the model types and adapter registry, and the closest compatible definition. Treat the application validator and existing definitions as the schema reference; do not duplicate them here.
3. Confirm the provider/type uses a registered executable adapter. If not, stop and report the separate adapter implementation prerequisite.
4. Create or update `apps/backend/catalog/models/<model-id>.json`. Keep released spec configuration immutable; add a new spec version for configuration changes. Keep pricing and limits spec-scoped, and require published specs to use `enforced` or explicit `unlimited` limits.
5. Run `pnpm model:validate <path>`, update only a loopback-hosted local database to the current migration baseline, then run `pnpm model:plan <path>`.
6. After a clean plan, run `pnpm model:generate-migration <path> --name <action>_<model-id>`, normalizing the name to lowercase letters, numbers, hyphens, and underscores. Show removals and obtain explicit approval before adding `--allow-removals`.
7. Apply the generated migration only to a local or disposable database. Run `pnpm db:check`, `pnpm model:verify`, relevant tests, and `pnpm typecheck`.

## Guardrails

- Never migrate, mutate, or publish directly to a production database.
- Never add a direct apply command or publishing API.
- Never invent provider facts or silently ignore validator or planner issues.
- Report the definition, migration, verified sources, plan summary, and verification results when finished.
