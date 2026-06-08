---
name: service-repository-boundaries
description: Use when designing, reviewing, or refactoring TypeScript backend service and repository files; especially when deciding whether logic belongs in a service or repository, converting loose exported functions into class-based services/repositories, clarifying public versus private methods, or keeping persistence code separate from business rules.
---

# Service Repository Boundaries

## Core Rules

- Prefer class-based services and repositories over loose exported functions.
- Export the class and one singleton instance, for example `GenerationService` and `generationService`.
- Use TypeScript `private` methods for helpers. Do not use ECMAScript `#` private methods unless the local codebase already standardizes on them.
- Keep public methods visible as the class surface. Avoid exporting helper functions only because another file might import them.
- Keep entrypoints thin. Routers, workers, activities, controllers, and handlers should call public service or repository instance methods instead of raw database code or private helpers.

## Repository Responsibilities

- Repositories own persistence reads and writes only.
- Repositories may import database clients, schemas, query builders, transactions, and persistence-only types.
- A repository method can shape database rows into stable records, throw persistence-not-found errors, and set timestamps/status fields.
- A repository should not enforce product rules, provider behavior, orchestration policy, authorization policy, or UI/API semantics.
- If a method only talks to persistence, put it only on the repository.

## Service Responsibilities

- Services own business rules, validation, input normalization, orchestration, provider/client calls, and repository coordination.
- Services may depend on repositories through constructor injection with a default singleton dependency.
- Services should not import database clients or schema modules directly.
- If behavior both makes decisions and persists data, split it: keep the decision in the service and move the persistence operation into a repository method.
- Services should translate domain intent into repository calls, not duplicate query details.

## TypeScript Pattern

```ts
export class ExampleRepository {
  async insertThing(input: InsertThingInput): Promise<ThingRecord> {
    // database-only work
  }

  private async updateThing(...) {
    // shared persistence helper
  }
}

export const exampleRepository = new ExampleRepository()

export class ExampleService {
  constructor(private readonly repository: ExampleRepository = exampleRepository) {}

  async createThing(input: CreateThingInput): Promise<ThingRecord> {
    const normalized = this.normalizeInput(input)
    this.validateBusinessRules(normalized)

    return this.repository.insertThing(normalized)
  }

  private normalizeInput(input: CreateThingInput) {
    // business-level shaping, not SQL
  }
}

export const exampleService = new ExampleService()
```

## Testing Guidance

- Service tests should mock the adjacent repository boundary and assert business decisions, validation, normalization, and orchestration.
- Repository tests should mock or exercise the database boundary and assert query inputs, row shaping, and persistence state changes.
- Entrypoint tests should mock the service or repository instance they call directly.
- Avoid tests that reach through services into repository details unless the task is explicitly integration-level.

## Review Checklist

- Does this service import a DB client, schema, or query builder directly?
- Does this repository contain business decisions or provider/orchestration policy?
- Are public methods obvious from the exported class surface?
- Are helper methods marked `private`?
- Are callers using singleton instances instead of loose helper exports?
- Do tests mock the adjacent boundary rather than reaching through it?
