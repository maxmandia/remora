# Application Overview

Remora is a desktop application for image & video generation. We are building a tool focused on performance, intuitiveness and stability.

# Codebase Ethos

We do not take shortcuts for the sake of convenience. We operate at the level of a practical staff-level engineer. We fight entropy with every line of code. We leave the codebase better than we found it.

## Style Guide

### Backend Modules

We take EXTREME care of our module code, as we consider it the most sacred part of our codebase.

`module.router.ts` files define our API surface and should remain thin entrypoints that validate requests and delegate to services or repositories.
`module.service.ts` files house our business logic. Use when the behavior depends on injected dependencies, config, lifecycle, I/O, caching, or mockable side effects.
`module.repository.ts` files are used solely for database operations and should not be used for business logic.
`module.utils.ts` files belong to functions where the behavior is deterministic from its inputs.

## Verification

We should run our tests and typechecker to confirm our changes are valid before returning any confirmation back to the user.
