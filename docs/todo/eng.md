# Engineering follow-ups

## Co-locate one-off web route implementations

TanStack file routes should own route-specific guards, layout composition, and
rendering. Do not extract a separate `Web*Route` component when it is referenced
only by its corresponding file route. Extract components when they are reused
across routes or hosts, or when they represent independently meaningful product
UI. The thin-router rule for backend `module.router.ts` files does not apply to
frontend file routes.

- [ ] Fold `components/web-app-route.tsx` and its test into `routes/app.tsx`.
- [ ] Fold `components/web-settings-route.tsx` and its test into
      `routes/app.settings.tsx`.
- [ ] Fold the thin `components/web-generation-route.tsx` adapter and its test
      into `routes/app._workspace.tsx`; keep the generation workspace component
      separate.
- [ ] Fold the route-specific `components/web-credits-settings-route.tsx`
      adapter and its test into `routes/app.settings.credits.tsx`; keep the
      shared credits settings page separate.

## Make sure we scroll to latest generation in thread

When a new generation is submitted, we should scroll to the latest generation in the thread.

## Bug when deleting model name as it doesn't fully delete it so you can't type in anything else unless you commmand a + del it
