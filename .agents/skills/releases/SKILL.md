---
name: releases
description: Use when reasoning about Remora desktop nightly or stable release behavior, Release Please PRs, and production publish triggers.
---

# Releases

## Release Channels

- Nightly builds are created from commits to `staging`.
- Stable production releases are not published directly by merging `staging` into `main`.
- Pushes to `main` run Release Please, which opens or updates a release PR when it sees a releasable conventional commit or `Release-As` footer.
- The stable release component covers the repository root, so releasable commits in the web app, backend, desktop app, or shared packages all advance the same release.
- Merging the Release Please PR creates the `desktop-v<version>` GitHub Release.
- The stable GitHub Release advances the `web-production` branch to the tagged commit.
- Railway production web deploys from `web-production`; staging web continues to deploy from `staging`.
- A successful Railway production deployment for the tagged commit triggers the signed, notarized desktop build and publish flow.
- Backend production deployments and database migrations continue to follow pushes to `main`.

## Stable Release Order

1. Promote `staging` to `main` without squashing.
2. Merge the Release Please PR.
3. Let the `Promote Web Release` workflow advance `web-production`.
4. Wait for Railway production web to deploy the tagged commit successfully.
5. Let the desktop release workflow build and publish the stable desktop artifacts.

Do not commit directly to `web-production`. It is a deployment pointer owned by the stable web promotion workflow.

## Release Please Notes

- Never squash commits when merging `staging` into `main`; it collapses the release history into one commit and can hide releasable `fix:`, `feat:`, or `style:` commits from Release Please.
- Use `fix:`, `feat:`, `style:`, or an explicit `Release-As: x.y.z` footer when the `main` commit should produce a stable release.
- The root `package.json` is the stable release version source; Release Please mirrors that version into `apps/desktop/package.json`.
