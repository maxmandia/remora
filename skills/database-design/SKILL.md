---
name: database-design
description: Use when designing, reviewing, or editing Remora database schemas, Drizzle migrations, seed data, or typed database fixtures; especially for enum-worthy fields, JSON/JSONB typing, schema scope control, and migration review.
---

# Database Design

## Core Rules

- Use Postgres enums through `pgEnum` when a field is limited to a known set of words, such as status, model type, provider kind, or publication state.
- Keep all `pgEnum` declarations grouped near the top of schema files, immediately after imports and before table declarations.
- Do not add table columns outside the stated plan or product requirement. Prefer omitting speculative fields until a workflow actually needs them.
- Type JSON/JSONB columns with Drizzle `$type<T>()` when a stable TypeScript type exists, for example `jsonb("spec").$type<ModelSpec>().notNull()`.
- Treat `$type<T>()` as compile-time help only. Keep runtime validation with Zod or another parser before inserting or updating structured JSON.
- Keep migrations reviewable: small SQL, clear enum names, explicit foreign keys, and no unrelated table churn.

## Review Checklist

- Are all bounded text fields represented as enums instead of free-form `text`?
- Are enum declarations grouped near the top of the schema file before table declarations?
- Does every column support a current requirement from the task?
- Are JSON blobs typed in Drizzle and validated before writes?
- Are generated migrations inspected for enum creation, column types, indexes, and unnecessary fields?
- Are seed scripts idempotent and validating fixtures before writing to the database?
