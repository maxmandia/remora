# Remora on the Web

## Overview

Remora is well-positioned to become a web application without rebuilding its
core product. The desktop app already behaves like a cloud application wrapped
in Electron: projects, threads, generations, credits, models, uploaded media,
and generated assets are stored and managed by the backend.

The intended architecture should be one shared product application hosted by
two platform clients:

- A web client that removes the download requirement from the acquisition
  funnel.
- The existing desktop client for users who prefer an installed application.

Both hosts should use the same product routes, UI, backend, accounts, and data.
They should differ only where browser and Electron behavior genuinely differs.

## Major Platform Changes

| Desktop today                                         | Web equivalent                                                                    |
| ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| Electron IPC proxies backend requests                 | Direct browser HTTP and tRPC requests                                             |
| Encrypted local session and authentication deep links | Browser session cookies                                                           |
| Node WebSocket with a manually attached cookie        | Browser WebSocket authenticated by a cookie or short-lived ticket                 |
| IPC-based file upload                                 | Browser `FormData`, with direct-to-object-storage uploads as a later optimization |
| Memory history and custom-protocol navigation         | The same `/app/...` route contract using browser history                          |
| Electron titlebar, updater, and Sentry integration    | Browser-specific shell and observability                                          |

### Shared Product Application

Most of the Electron renderer is ordinary React code. The generation workspace,
composer, results, projects, threads, credits, and settings should be treated as
shared product functionality rather than desktop functionality. This shared
surface should live in a product application package rather than under either
platform host.

Both clients use TanStack Router, and the existing desktop paths form a useful
shared product route contract:

- `/app`
- `/app/threads/$threadId`
- `/app/settings`
- `/app/settings/credits`

The shared product layer should own:

- Route screens and their product behavior
- Route params and search validation, such as `projectId`
- Product navigation destinations
- Query and mutation usage
- Shared layouts, loading states, and error states

The web and desktop hosts should continue to own:

- Router construction and history selection
- Route registration and root shells
- Web SSR, metadata, and marketing routes
- Platform-specific authentication entry and redirect behavior
- Electron bootstrap and welcome routes
- Platform adapter implementations
- Desktop updates and window chrome

Initially, each host should register thin routes that render the same shared
screen. Web route files can remain compatible with generated file-based routing,
while the desktop can retain its manually constructed route tree and memory
history. The wrappers should only translate typed params and search state,
perform host-level guards, and supply platform behavior.

Sharing instantiated route objects is not required to get the primary benefit.
Those objects are coupled to a parent route and the host's generated router
types. If the thin registrations later become identical, a shared product-route
factory can be considered without making it a prerequisite for parity.

Platform-specific behavior should stay behind small, focused adapters for:

- Authentication
- API transport
- Realtime events
- File uploads
- Navigation and checkout returns
- Analytics and observability

The shared package should be introduced with the first genuine shared product
unit rather than as an empty route registry. This avoids maintaining separate
desktop and web implementations without requiring a large renderer move.
Desktop updates and window chrome can remain entirely within the desktop host
unless shared product UI needs a narrow optional capability from them.

### Browser Transport

The web app already has Better Auth and a credentialed tRPC client. The web
product can use these directly instead of sending requests through Electron.

The main transport considerations are:

- Authenticated requests should use secure browser cookies.
- The frontend and API should ideally be hosted on the same origin or controlled
  same-site subdomains.
- Browser WebSockets cannot manually set a `Cookie` header. They should rely on
  an automatically sent first-party cookie or a short-lived connection token.
- Attachment files can initially use the existing authenticated multipart
  endpoint.

### Authenticated Application Routes

The existing website currently handles marketing, authentication, pricing, and
checkout-related behavior. It needs an authenticated application route such as
`/app`. This route should be a thin web host registration for the shared product
application, not the start of a separate web workspace implementation.

Marketing pages can remain server-rendered and SEO-oriented. The interactive
workspace can be a client-heavy application route. After sign-in or sign-up,
normal web users should continue into the product rather than returning to the
download-focused landing page.

The first web route should prove the deployed browser session and protected tRPC
path before a substantial UI migration. It should:

- Resolve the Better Auth browser session
- Redirect signed-out users to sign-in while preserving the intended app URL
- Return normal web sign-ins and sign-ups to `/app`
- Execute a protected query such as `credits.getBalance`
- Support a hard refresh on `/app` in the deployed environment
- Preserve the existing Electron authentication-transfer flow

This validates cookies, trusted origins, CORS, and redirects without requiring
backend, database, realtime, upload, or shared-workspace changes.

### Recommended Initial Milestone

The first useful parity milestone should be:

> An authenticated laptop or desktop user can submit a text-only generation and
> view its result in the browser.

This milestone intentionally excludes guest access, mobile-specific refinement,
attachments, billing changes, and complete project-management parity. Those
capabilities can be added without blocking validation of the shared product
architecture.

Work toward the milestone in small, reviewable changes:

1. ~~Add the authenticated web `/app` bootstrap and validate a protected request~~
   ~~in the deployed environment.~~
2. ~~Establish shared product providers while keeping browser and Electron~~
   ~~transport implementations separate.~~
3. ~~Move one real workspace component and its tests into the shared product~~
   ~~package, then render it from both host routes.~~
4. ~~Add text-only generation submission and the shared pending/result surface.~~
5. ~~Add the browser realtime adapter, including query refresh after reconnect,~~
   ~~so completed results appear automatically.~~
6. ~~Add browser attachment uploads and submitted-attachment viewing.~~
7. Add checkout-return handling and further responsive behavior in subsequent
   slices.

### Uploads and Media Delivery

The existing upload endpoint is sufficient for an initial web product. It
authenticates the user, validates and probes the media, and stores it in R2.
The shared product application now owns attachment upload previews and submitted
attachment viewing, including the signed-media side panel used by both hosts.

At higher volume, large browser uploads may justify a direct-to-R2 flow because
the current backend receives the upload, writes a temporary file, and enforces a
60 MB limit. A scalable flow could upload through a presigned URL and then ask
the backend to finalize, probe, and register the media.

Generated assets and previews are already stored centrally and returned using
signed URLs, so users should be able to access the same history from web and
desktop without migrating local data.

### Realtime Updates

The existing realtime model can remain. Generation completions, failures,
thread-name changes, and credit-balance changes already trigger query
invalidation.

The browser client needs its own WebSocket transport and robust reconnect
behavior. Browsers suspend background tabs and terminate connections more
aggressively than a desktop application, so reconnecting should also refresh
queries that may have missed events.

### Responsive Product Experience

The current renderer is designed for a desktop-sized viewport, persistent
sidebar, keyboard shortcuts, and pointer interactions. Publishing it at a URL
would remove download friction for laptop and desktop visitors, but would not
automatically produce a good mobile experience.

If Google Ads sends meaningful mobile traffic, a focused responsive workflow
may be needed for:

- Selecting a model
- Entering a prompt
- Attaching camera-roll media
- Starting a generation
- Viewing and saving results

Full project-management parity does not necessarily need to be part of the
initial mobile experience.

### Authentication, Billing, and Navigation

Browser authentication is simpler than desktop authentication because the web
client can use its Better Auth session directly. Electron deep links, PKCE
exchange, encrypted session storage, and loopback callbacks remain
desktop-only.

Stripe already supports web return URLs. Web checkout should return users to an
application route such as `/app/settings/credits`, refresh their balance, and
preserve relevant workspace context. Custom-protocol and loopback returns
remain specific to desktop.

### Browser Security and Operations

Making the full product available in a browser increases its public attack
surface and expected request volume. Important protections include:

- Secure cookie, `SameSite`, trusted-origin, CORS, and CSRF configuration
- Content Security Policy and XSS review
- Authentication and signup throttling
- Upload size, storage, and media-type abuse controls
- User-level generation quotas and cost protection
- Bot protection around free or promotional credits
- Browser observability and acquisition-funnel analytics

Existing provider and model rate limits protect generation capacity, but they
do not replace public endpoint and signup abuse controls.

## Product Scope Decision

There are two distinct definitions of a frictionless web funnel:

1. **No download:** Visitors create an account and use Remora in the browser.
2. **No account before trying:** Visitors can generate immediately through a
   temporary or anonymous identity.

The first option is web parity and fits the existing authenticated backend. The
second option requires guest identities, trial credits, model and cost
restrictions, abuse prevention, and a way to transfer guest projects and
results into a permanent account. The recommended initial milestone uses the
first definition; guest access can remain a later product decision.

## What Can Remain Unchanged

The following backend capabilities can remain substantially intact:

- Provider integrations
- Temporal generation orchestration
- PostgreSQL data and ownership model
- Projects and generation threads
- Credits and Stripe fulfillment
- Model catalog and pricing
- R2 asset persistence
- Provider callbacks
- Realtime event publication

This makes a web version primarily a frontend and platform adaptation rather
than a new product backend. Mobile scope, guest access, and how much desktop
parity the acquisition funnel needs remain later product decisions, but they do
not block the recommended initial milestone.
