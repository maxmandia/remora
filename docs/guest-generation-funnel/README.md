# Guest Generation Funnel

## Goal

Let anonymous Google Ads visitors experience Remora's real generation composer
before creating an account, then convert that intent into an authenticated,
email-verified account with $5 in promotional credits and the original draft
restored.

This document is the living product and implementation tracker for that funnel.
It breaks the work into reviewable chunks and records the decisions that should
remain stable as each chunk receives its implementation review.

## Acquisition Boundary

A direct signed-out visit to `/app` is the guest-funnel entrypoint. No UTM
parameter, Google Click ID, referrer, or other attribution proof is required.
The route itself is the product boundary: a signed-out visitor who reaches
`/app` is treated as an ad-funnel visitor.

Marketing and SEO pages should eventually send visitors directly to `/sign-in`
or `/sign-up` instead of the guest funnel. Updating those calls to action is
explicitly deferred from this project.

The initial guest experience targets desktop-class web viewports. Responsive
mobile behavior is a separate project.

## Product Contract

- Guests can choose any published image or video model, enter a prompt, adjust
  settings, and attach supported media.
- Guests do not see generation cost estimates, credit balances, projects,
  account history, or other account-backed controls.
- A valid guest submission starts a simulated loading experience lasting three
  seconds. It does not upload media, reserve credits, create a generation
  submission, or contact a generation provider.
- After the simulated loading state, Remora opens an authentication modal that
  asks the guest to sign up or sign in to continue with their generation.
- Closing the modal returns the visitor to the intact editable draft.
- The modal offers Create account as the primary action and Sign in as the
  secondary action.
- Creating an account through a valid guest handoff makes the account eligible
  for the promotion. Signing in to an existing account restores the draft but
  does not grant promotional credit.
- A qualifying new account must verify its email address before the $5 grant is
  applied.
- After verification, the email-opened tab confirms success and tells the user
  to close it. The original Remora tab detects the completed verification and
  resumes at `/app`; after redemption, the guest prompt, model, settings, and
  attachment files are restored in the command center.
- Remora does not automatically submit the real generation. The authenticated
  user reviews the restored draft and submits it explicitly.

## Funnel State

The complete state machine is:

```text
guest editing
  → simulated loading
  → signup modal
  → account creation
  → check-email gate
  → email verification
  → $5 redemption
  → restored authenticated draft
  → real submission
```

Sign in follows a shorter branch:

```text
guest editing
  → simulated loading
  → signup modal
  → existing-account sign in
  → restored authenticated draft
  → real submission
```

That branch never creates or redeems a promotional claim.

## Architecture and Data Contracts

### Browser Guest Draft

The web host owns a versioned `GuestGenerationDraft` stored in IndexedDB. The
record contains:

- Schema version and a 24-hour expiration timestamp.
- Prompt.
- Selected model ID and model-spec ID.
- Generation settings.
- Attachment field, role, file metadata, and browser-stored `File` objects.
- The opaque promotion ticket associated with the draft.

The draft is a browser- and device-local artifact. Prompt text and attachment
contents must not be sent to the backend during the guest phase. The stored
record is cleared after a successful real submission, an explicit discard, or
expiration.

On load, the web client must reject malformed or expired records. It must also
revalidate the model, spec, settings, attachment roles, file limits, and media
constraints against the current published catalog before restoring them.
Storage quota failures must leave the in-memory draft intact and present a
recoverable message instead of entering the authentication flow.

### Promotion Ticket and Claim

A public promotion operation issues an opaque, server-signed ticket containing
only promotion metadata:

- Unique ticket identifier.
- Offer version.
- Issued-at and 24-hour expiration timestamps.
- Promotional amount of `5_000_000` USD micros.

The ticket contains no prompt, settings, file metadata, or attachment content.
Issuing a ticket does not persist a financial grant.

Protected promotion operations provide the following behavior:

- `claim(ticket)` verifies the signature and expiration, verifies that the
  authenticated account was newly created from the handoff, and associates the
  ticket with that account. A ticket and user can each participate in at most
  one claim.
- `getStatus()` returns one of `none`, `verification_required`, `eligible`, or
  `redeemed` for the authenticated user.
- `redeem()` reloads email-verification state from persistence, requires an
  eligible claim, and applies the promotional grant exactly once.

The client never supplies the grant amount or ledger-entry type.

### Credit Ledger

Promotional credit is represented by a dedicated
`promotional_credit_grant` ledger-entry type. Redemption applies an available
credit delta of `5_000_000` USD micros and a reserved credit delta of zero.

The idempotency key is derived from the immutable user ID and offer version.
The promotion claim and credit mutation complete in one database transaction so
that a claim cannot be marked redeemed without its ledger entry.

Promotion eligibility and redemption orchestration belong in a service.
Balance and claim persistence belong in repositories. The credits service owns
the audited balance mutation; the promotion service must not directly update a
balance.

### Email Verification

Remora will use a provider-neutral backend email service with a Cloudflare Email
Service REST implementation. Production setup requires:

- A Remora sending domain onboarded to Cloudflare Email Service.
- A Cloudflare account ID and API token with Email Sending permission.
- A validated sender address and display name.
- Both plain-text and HTML verification-email bodies.

Better Auth will be configured with:

- A manual verification-email sender.
- A one-hour verification-token lifetime.
- Automatic sign-in after verification.
- No global `requireEmailVerification` option.

Verification is a requirement for redeeming this promotion, not a new global
sign-in requirement. This preserves access for existing users whose accounts
currently have an unverified email state.

The guest signup flow sends a verification email only after the promotion claim
has succeeded. The check-email state supports resend and retry without deleting
the guest draft. Better Auth's production rate limits continue to protect
signup and verification-email endpoints.

Verification links return to `/check-email?verified=true`. That callback mode
uses persisted promotion status to confirm success, shows a close-tab completion
state instead of redirecting automatically, and offers `/app` only as a manual
fallback. When the original check-email tab becomes visible again, it refreshes
the uncached session and promotion status before continuing to `/app`.

References:

- [Better Auth email verification](https://better-auth.com/docs/concepts/email)
- [Cloudflare Email Service setup](https://developers.cloudflare.com/email-service/get-started/send-emails/)

### Feature Controls

Production configuration must include:

- Cloudflare email account, API token, and sender values.
- A dedicated promotion-ticket signing secret.
- A promotion-enabled kill switch.

When the promotion is disabled or its public offer cannot be loaded, the web
client must not promise the $5 grant or issue new promotion tickets. Existing
claimed or redeemed grants remain auditable and are not reversed.

## Status Legend

| Status        | Meaning                                                          |
| ------------- | ---------------------------------------------------------------- |
| `Not started` | The chunk has not entered implementation.                        |
| `In review`   | The implementation exists and is awaiting review or revision.    |
| `Complete`    | The implementation and its acceptance evidence have been merged. |
| `Deferred`    | The work is intentionally outside the current project.           |

## Chunk 1: Establish the Guest Workspace Foundation

**Status:** `Complete`

**Intended outcome:** A signed-out browser visitor can open the clean `/app`
workspace and configure a generation without seeing or invoking account-backed
state.

**Included work:**

- Make published model discovery available without a session.
- Render the workspace for direct signed-out `/app` visits.
- Normalize signed-out thread, settings, and project-specific app locations
  back to clean `/app`.
- Suppress protected project, thread, balance, and cost-estimate queries.
- Prevent cached account projects and threads from appearing after sign-out.
- Disable project creation and hide the credits footer while signed out.

**Explicit exclusions:**

- Guest submission.
- Draft persistence.
- Authentication modal and handoff.
- Promotional credit.
- Email verification.

**Acceptance evidence:**

- A signed-out visitor can load published models and edit the composer.
- No protected account query is made.
- Private app locations normalize to `/app`.
- Cached account data is not rendered after sign-out.
- Signed-in workspace behavior remains unchanged.

## Chunk 2: Persist the Browser Guest Draft

**Status:** `In review`

**Intended outcome:** A complete image or video draft, including attachment
files, can survive the authentication round trip without leaving the browser.

**Included work:**

- Add a web-owned IndexedDB repository for `GuestGenerationDraft`.
- Snapshot a validated draft and promotion ticket before leaving the workspace.
- Store attachment `File` objects with their field and role.
- Enforce the 24-hour expiration policy.
- Revalidate persisted values against the current published model spec.
- Recover safely from malformed records, unavailable IndexedDB, and quota
  errors.

**Explicit exclusions:**

- Uploading guest files.
- Synchronizing drafts across browsers or devices.
- Creating backend guest projects, threads, submissions, or attachment rows.
- Restoring the draft into an authenticated composer.

**Dependencies:** Chunk 1.

**Acceptance evidence:**

- Image and video drafts round-trip through IndexedDB.
- Attachment contents, names, types, and roles survive reconstruction.
- Expired, corrupt, and model-incompatible drafts are discarded safely.
- Storage failures keep the current in-memory draft editable.
- No prompt or attachment data is sent to the backend.

**Implementation evidence:**

- The web-owned repository stores one versioned draft in IndexedDB and exposes
  typed save, read, discard, and failure outcomes without changing workspace
  behavior.
- Image and video repository tests cover file reconstruction, expiration,
  corruption, catalog incompatibility, quota and availability failures, atomic
  replacement, explicit clearing, and the no-network boundary.
- Shared composer tests cover model-driven generation-setting validation and
  attachment cardinality and role enforcement.

## Chunk 3: Add Promotional Entitlement and Ledger Support

**Status:** `In review`

**Intended outcome:** The backend can issue, claim, and exactly-once redeem a
guest-conversion promotion without trusting client-supplied financial data.

**Included work:**

- Add signed 24-hour promotion-ticket issuance.
- Add a promotion-claim table with unique ticket and user ownership.
- Add the `promotional_credit_grant` ledger-entry type and reviewed migration.
- Add claim, status, and redemption service workflows.
- Apply the $5 mutation and mark the claim redeemed in one transaction.
- Add a promotion kill switch and dedicated signing-secret configuration.

**Explicit exclusions:**

- Verification-email delivery.
- Guest UI or modal behavior.
- Google Ads conversion reporting.
- Automated promotion-budget caps.

**Dependencies:** None.

**Acceptance evidence:**

- Invalid, altered, expired, and replayed tickets are rejected.
- Existing accounts cannot claim a new-account promotion.
- A ticket and user can each have at most one claim.
- Unverified users cannot redeem.
- Concurrent redemption produces exactly one $5 ledger entry.
- The ledger contains the offer version and promotion-claim identifier.
- Disabled promotion configuration prevents new ticket issuance.

**Implementation evidence:**

- The public promotion router issues signed, versioned 24-hour tickets and
  exposes protected claim, status, and idempotent redemption operations without
  accepting financial values from the client.
- Promotion claims enforce unique ticket and user ownership, persist the
  server-defined offer, and lock redemption reads so the credit-ledger mutation
  and claim redemption marker commit in one transaction.
- The credits service owns the `promotional_credit_grant` mutation and records
  the promotion claim, offer version, grant amount, and deterministic
  idempotency key in the ledger.
- Backend tests cover ticket integrity and expiration, new-account eligibility,
  claim conflicts, verification state, router error contracts, transaction
  ordering, and concurrent exactly-once redemption.
- The reviewed migration adds the promotion offer enum, promotion-claim table,
  ownership and redemption constraints, and promotional ledger-entry type.

## Chunk 4: Add Verification Email and the Check-Email Gate

**Status:** `In review`

**Intended outcome:** A qualifying guest-created account can prove ownership of
its email without changing authentication requirements for existing accounts.

**Included work:**

- Add the provider-neutral verification-email service.
- Implement Cloudflare Email Service REST delivery and validated environment
  configuration.
- Configure Better Auth manual verification with a one-hour token and automatic
  sign-in after verification.
- Send verification only after a successful guest promotion claim.
- Add a check-email state with resend, retry, and verified-session refresh.
- Show a close-tab completion state in the verification-link tab and
  automatically resume the original check-email tab.

**Explicit exclusions:**

- Requiring verified email for every Remora account.
- Password-reset email.
- Marketing or lifecycle email.
- Redeeming credit before verification.

**Dependencies:** Chunk 3.

**Acceptance evidence:**

- A claimed guest signup receives a verification link with the correct callback.
- Direct non-guest signup behavior remains unchanged.
- Existing unverified accounts can still sign in.
- Resend is rate-limited and reports recoverable delivery failures.
- Expired and invalid links show a recoverable path.
- Verification updates the persisted user state without redirecting the
  email-opened tab; returning to the original tab resumes the funnel at `/app`.

**Implementation evidence:**

- A provider-neutral verification-email service renders matching HTML and
  plain-text messages and delivers them through Cloudflare Email Service's REST
  API with validated configuration, bounded requests, sanitized failures, and
  delivered, queued, and permanent-bounce handling.
- Better Auth uses manual one-hour verification links, automatic sign-in after
  verification, a promotion-claim gate, and a three-per-minute resend limit
  without enabling a global email-verification requirement.
- An explicit guest-generation signup handoff revalidates the IndexedDB draft,
  claims its server-signed ticket after account creation, and enters a
  recoverable check-email route that supports initial delivery, resend,
  invalid or expired links, a dedicated callback completion state, and
  verified-session refresh when the original tab becomes visible.
- Backend integration tests cover direct signup and existing unverified
  sign-in, claim-gated delivery, rate limiting, persisted verification,
  automatic session creation, and invalid or expired callbacks. Web tests
  cover search validation, local draft revalidation, ticket claiming, and
  recoverable handoff failures.

## Chunk 5: Add the Guest Preview and Authentication Handoff

**Status:** `In review`

**Intended outcome:** A guest can submit a valid draft, experience a clear
simulated transition, and choose account creation or sign-in without triggering
real generation work.

**Included work:**

- Separate guest-preview eligibility from authenticated affordability.
- Keep guest cost-estimate and balance UI absent.
- Issue a promotion ticket and persist the draft before starting the preview.
- Add an accessible, cancellable three-second simulated loading state.
- Add authentication modal copy focused on continuing the generation.
- Add Create account, Sign in, and close actions.
- Preserve the auth redirect back to `/app`.

**Explicit exclusions:**

- Creating an optimistic generation-domain submission for a guest.
- Uploading attachments during the preview.
- Automatically submitting after authentication.
- Mobile-specific layout.

**Dependencies:** Chunks 1, 2, 3, and 4.

**Acceptance evidence:**

- Guest submit becomes available for a valid draft without a credit balance.
- No upload, generation, reservation, project, or provider request occurs.
- The modal opens after three seconds and explains how to continue the
  generation.
- Duplicate clicks cannot create overlapping timers or tickets.
- Unmounting cancels pending timers.
- Closing restores the intact editable draft.
- Create account enters the claim and verification flow.
- Sign in preserves the draft without creating a promotion claim.

**Implementation evidence:**

- The shared composer separates draft eligibility from affordability so the
  web guest preview can submit a valid draft without balance or cost-estimate
  queries while authenticated web and desktop submissions retain their
  existing affordability checks.
- Guest submission issues a content-free promotion ticket and persists the
  validated prompt, model, settings, attachment files, and ticket in IndexedDB
  before starting any simulated result state.
- The web workspace renders the real dot-field loading presentation for three
  seconds without uploading media or creating an optimistic generation-domain
  submission, then opens accessible image- or video-aware authentication copy.
- Create account and Sign in preserve the `/app` redirect and guest draft;
  closing the dialog restores the intact composer, while duplicate clicks,
  unmounts, ticket failures, and storage failures remain recoverable.
- Shared and web tests cover affordability isolation, ticket-before-save
  ordering, duplicate protection, timer cleanup, modal timing and copy,
  authentication routing, intact drafts, and the no-real-submission boundary.

## Chunk 6: Redeem, Restore, and Submit for Real

**Status:** `In review`

**Intended outcome:** A verified guest conversion returns with $5 in auditable
credit and the original draft ready for an explicit authenticated submission.

**Included work:**

- Resolve promotion status after authentication and verification.
- Redeem eligible claims before presenting the restored workspace.
- Retry failed idempotent redemption without losing browser state.
- Restore the current published model, compatible settings, prompt, and local
  attachment files into the command center.
- Preserve normal authenticated cost estimation and affordability checks.
- Clear the guest record only after real submission, explicit discard, or
  expiration.

**Explicit exclusions:**

- Automatic generation after verification.
- Cross-device draft transfer.
- Promotional credit for existing-account sign-in.
- Restoring models or settings that are no longer valid.

**Dependencies:** Chunks 2 through 5.

**Acceptance evidence:**

- A verified qualifying account receives exactly $5 before restoration
  completes.
- A retry after a transient redemption failure does not duplicate credit.
- Image and video drafts restore with compatible settings and attachment files.
- Existing users restore the draft without receiving promotional credit.
- The real submit follows the existing authenticated upload, estimate,
  reservation, generation, and navigation paths.
- Successful real submission removes the guest draft.

**Implementation evidence:**

- The signed-in web workspace resolves promotion state behind a blocking gate,
  returns unverified claims to the check-email flow, and idempotently redeems
  eligible claims before account-backed composer queries mount.
- Published-model loading and promotion resolution overlap; the IndexedDB
  record is then revalidated against the current catalog and restored with its
  prompt, compatible settings, and reconstructed image or video attachment
  files.
- Existing-account sign-in restores the local draft without redemption, while
  transient promotion and storage failures retain browser state and expose
  scoped retry or discard recovery.
- Restored drafts use the normal authenticated cost, balance, upload,
  reservation, submission, and navigation paths without automatic submission.
  The browser record is cleared only after a successful real submission or the
  global New Generation discard action.
- Web tests cover promotion-state branches, ambiguous redemption retries,
  restoration gating, image and video reconstruction, authenticated composer
  hydration, explicit discard, clear-after-submit ordering, and recoverable
  storage cleanup failures.

## Chunk 7: Add Measurement, Rollout Controls, and Policy Review

**Status:** `Not started`

**Intended outcome:** The funnel can be enabled deliberately, measured without
capturing creative content, and stopped quickly if cost or abuse exceeds
expectations.

**Included work:**

- Add prompt-free events for guest preview, modal view, auth selection, guest
  account creation, verification, redemption, and first real submission.
- Use verified promotional redemption as the Google Ads conversion milestone.
- Do not include prompts, file names, attachment contents, or verification
  tokens in analytics.
- Verify Cloudflare sending-domain authentication and monitor email delivery.
- Monitor promotional grant volume and redemption-to-generation conversion.
- Document enable/disable deployment sequencing and rollback behavior.
- Review Terms and Privacy language for promotional credits and 24-hour local
  guest-media retention.

**Explicit exclusions:**

- Automated daily or lifetime promotional budget caps.
- Device fingerprinting.
- Disposable-email classification.
- Stronger identity verification.
- Marketing and SEO authentication CTA changes.

**Dependencies:** Chunks 3 through 6.

**Acceptance evidence:**

- Analytics describe each funnel transition without creative or credential
  data.
- Google Ads receives one conversion per redeemed promotion.
- Operators can disable new ticket issuance without changing historical ledger
  data.
- Email failures and promotional grant volume are observable.
- Policy review is complete before broad rollout.

## Cross-Chunk Acceptance Requirements

- Guest flows make no protected balance, pricing, upload, project, generation,
  or provider requests.
- Cost estimates remain visible to authenticated users and absent for guests.
- Both image and video drafts survive the same-browser authentication round trip
  with attachments intact.
- Timers, modal dismissal, refresh, corrupt storage, expiration, and quota
  failures preserve a safe recoverable state.
- Existing accounts and direct non-guest signups cannot redeem the promotion.
- Unverified claims retain zero promotional credit.
- Concurrent and repeated redemption produces one ledger entry and one balance
  increase.
- Verification-email and redemption failures remain retryable without losing
  the draft.
- Existing unverified users retain their current sign-in behavior.
- Relevant web, shared-package, and backend tests pass.
- Migration validation and workspace typechecking pass.

## Deferred Work

- Responsive mobile guest UX.
- Marketing and SEO calls to action that route directly to `/sign-in` or
  `/sign-up`.
- Cross-device or server-backed draft transfer.
- Automatic generation after authentication.
- Automated promotional budget caps.
- Device, network, or disposable-email abuse heuristics.
- Changes to the Electron desktop authentication or generation experience.
