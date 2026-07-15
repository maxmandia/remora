---
name: releases
description: Use when reasoning about Remora desktop nightly or stable release behavior, Release Please PRs, and production publish triggers.
---

# Releases

## Desktop Channels

- Nightly builds are created from commits to `staging`.
- Stable production releases are not published directly by merging `staging` into `main`.
- Pushes to `main` run Release Please, which opens or updates a release PR when it sees a releasable conventional commit or `Release-As` footer.
- Merging the Release Please PR creates the `desktop-v<version>` GitHub Release.
- Publishing that stable GitHub Release triggers the signed, notarized desktop build and publish flow.

## Release Please Notes

- Never squash commits when merging `staging` into `main`; it collapses the release history into one commit and can hide releasable `fix:`, `feat:`, or `style:` commits from Release Please.
- Use `fix:`, `feat:`, `style:`, or an explicit `Release-As: x.y.z` footer when the `main` commit should produce a stable release.
