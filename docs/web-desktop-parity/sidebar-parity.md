# Web Sidebar Parity

## Goal

Bring the desktop sidebar experience to the web application while keeping
product UI and behavior shared and leaving browser- and Electron-specific shell
behavior in their respective hosts.

This document is a living tracker for planning, reviewing, and implementing the
work in small chunks. It complements the broader
[web and desktop parity summary](./summary.md). Each chunk should receive a
decision-complete implementation plan when it is selected rather than expanding
this document into one large implementation plan.

## Current Architecture

- `@remora/ui` already owns the sidebar primitives and `WorkspaceSidebar`
  frame used by the desktop application.
- The product sidebar, including project and thread navigation, account and
  credit UI, and its focused tests, is still owned by the desktop renderer.
- `@remora/app` owns the shared create-project dialog, mutation hook, and
  optimistic cache operations; desktop consumes them, while web does not render
  the dialog yet.
- The web workspace already loads projects, tracks the selected project and
  thread, and navigates between `/app` and `/app/threads/$threadId`.
- The web host does not yet load unprojected threads or render a sidebar shell.
- The web application does not yet have `/app/settings/credits`, checkout-return
  handling, or the account and credit destinations used by the desktop sidebar.
- The existing sidebar primitives support expanded and collapsed state but do
  not provide a responsive or off-canvas browser experience.
- The existing project, thread, credit, and generation APIs are available
  through authenticated tRPC. No backend or database changes are currently
  expected for sidebar parity.

## Status Legend

| Status        | Meaning                                                        |
| ------------- | -------------------------------------------------------------- |
| `Not planned` | The boundary is known, but implementation decisions are open.  |
| `Planning`    | The chunk is being investigated and specified.                 |
| `Ready`       | The implementation plan is decision-complete and can be built. |
| `In progress` | Implementation or review is underway.                          |
| `Complete`    | The chunk is merged and its acceptance evidence is satisfied.  |

## Chunk 1: Make the Shared Sidebar Frame Host-Neutral

**Status:** `Complete`

**Intended outcome:** `WorkspaceSidebar` can be used by web and desktop without
implicitly depending on Electron titlebar variables.

**Included work:**

- Replace the frame's direct dependency on the desktop
  `--remora-titlebar-height` variable with a host-neutral input or CSS custom
  property.
- Preserve the desktop header offset, width, collapsed-state animation, and
  appearance.
- Establish browser-safe defaults for hosts without a titlebar.
- Add or update focused frame tests if behavior is not already covered.

**Explicit exclusions:**

- Moving the product sidebar out of the desktop renderer.
- Adding a sidebar to the web workspace.
- Changing desktop titlebar controls or preference storage.
- Responsive or off-canvas behavior.

**Dependencies:** None.

**Acceptance evidence:**

- Desktop rendering remains visually and behaviorally unchanged.
- The frame renders with a valid zero-offset header when no host override is
  supplied.
- Relevant UI tests and typechecking pass.

**Decisions:**

- Use a host-neutral CSS custom property for the header offset so shell-level
  values can be inherited without adding a component property.
- Keep the existing `--sidebar-width` mechanism unchanged.

**Implementation plan:**

- Use the inheritable `--workspace-sidebar-header-offset` custom property for
  the shared frame's header padding, with a `0px` fallback.
- Map the desktop titlebar height to the shared property once in the desktop
  workspace layout so application and settings sidebars inherit it.
- Keep the existing host-neutral sidebar width mechanism and frame animation
  unchanged.
- Cover the browser-safe default, host override, frame sizing and collapse
  animation, and desktop titlebar mapping with focused tests.

## Chunk 2: Move Project Creation into the Shared Application Package

**Status:** `Complete`

**Intended outcome:** Both hosts can use one create-project workflow, including
validation, optimistic cache updates, rollback, and error recovery.

**Included work:**

- Move the create-project dialog, mutation hook, and deterministic project-cache
  operations into `@remora/app`.
- Add an appropriate shared project export surface.
- Move or add focused tests for optimistic insertion, replacement, rollback,
  dialog reset, and mutation failure behavior.
- Update the desktop route to consume the shared capability without changing
  behavior.

**Explicit exclusions:**

- Rendering the dialog in the web application.
- Changing project validation or API behavior.
- Adding project rename, archive, delete, or reordering behavior.
- Refactoring unrelated generation project-selection behavior.

**Dependencies:** None.

**Acceptance evidence:**

- Desktop project creation behaves as it did before the move.
- Successful creation replaces the optimistic project without duplication.
- Failed creation rolls back the optimistic project and restores the submitted
  name in the reopened dialog.
- Shared package tests, desktop tests, and typechecking pass.

**Decisions:**

- Export the dialog and mutation hook from the singular
  `@remora/app/project` entrypoint while keeping cache operations internal.
- Move the complete dialog into `@remora/app` and make `@remora/form` a direct
  dependency rather than leaving host-specific form composition.
- Keep dialog visibility, sidebar actions, and hotkey registration owned by
  each host.

**Implementation plan:**

- Move the create-project dialog, mutation hook, and deterministic optimistic
  cache operations into the shared project's component, hook, and library
  structure.
- Preserve schema validation, immediate submit-time close and reset, optimistic
  insertion, success reconciliation and deduplication, targeted rollback,
  inline error recovery, global-toast suppression, and settled invalidation.
- Export the host-neutral dialog and mutation hook through
  `@remora/app/project`, with their public prop and option types.
- Update desktop to import the shared dialog while retaining its existing open
  state, sidebar callback, and create-project hotkey.
- Cover cache behavior, mutation lifecycle, dialog state and validation, and
  desktop host wiring with focused tests.

## Chunk 3: Move Product Sidebar Navigation into the Shared Package

**Status:** `Complete`

**Intended outcome:** Project and thread navigation UI is a single shared
product component rendered by both platform hosts.

**Included work:**

- Move the sidebar header, project disclosure behavior, nested project threads,
  unprojected thread list, active-thread state, and accessible navigation
  semantics into `@remora/app`.
- Keep platform navigation behind explicit callbacks while preserving usable
  thread URLs.
- Move the shortcut tooltip needed by shared sidebar actions or replace it with
  an equivalent shared product component.
- Move the existing focused sidebar tests with the component.
- Leave a thin desktop composition for desktop-only controls and destinations.

**Explicit exclusions:**

- Rendering the shared sidebar in the web application.
- Moving Electron titlebar, history, updater, or preference behavior.
- Adding the account and credit footer to web.
- Changing the project or thread information architecture.

**Dependencies:** Chunk 1.

**Acceptance evidence:**

- Desktop project expansion, nested and unprojected thread navigation, active
  state, action visibility, animation, and keyboard accessibility are
  unchanged.
- Shared code does not import Electron APIs or a host router instance.
- Existing sidebar tests pass from their shared package location.
- Shared package tests, desktop tests, and typechecking pass.

**Decisions:**

- Export the shared product component and its public props from the singular
  `@remora/app/sidebar` entrypoint.
- Keep the account and credit footer desktop-owned until Chunk 6, and accept an
  optional footer slot so each host can compose its current destination.
- Render projected and unprojected thread rows as real links. Intercept only
  unmodified primary clicks for host SPA navigation so native modified-click
  behavior remains available.
- Keep thread URL construction and imperative navigation behind explicit host
  callbacks; shared code does not import a host router.
- Move the reusable shortcut tooltip into `@remora/app/hotkeys` so shared
  sidebar actions and desktop-only titlebar actions consume one component.

**Implementation plan:**

- Move the sidebar frame composition, header actions, project disclosure state,
  project threads, unprojected threads, active state, animation, and empty state
  into `@remora/app`.
- Expose projects, threads, the selected thread, reveal requests, action
  callbacks, thread href construction, and an optional footer through the
  shared component's typed props.
- Preserve project action visibility, independent disclosure, delayed
  generation-thread reveal, closed-link tab behavior, reduced motion, and
  keyboard accessibility.
- Replace the desktop implementation with a thin composition that supplies the
  product thread URL, existing route callbacks, and desktop-owned account and
  credit footer.
- Move focused navigation and shortcut tests into the shared package, retain
  desktop footer and route-wiring coverage, and verify both packages plus the
  workspace typecheck.

## Chunk 4: Add the Always-Open Sidebar to the Web Shell

**Status:** `Complete`

**Intended outcome:** An authenticated browser user can see projects and
threads, identify the active thread, and navigate or start generations from an
always-open sidebar.

**Included work:**

- Add a browser-owned workspace shell around the shared product sidebar and
  generation stage.
- Load unprojected threads through the existing protected query.
- Wire new generation, project-targeted generation, thread selection, and
  create-project actions to browser routes and the shared dialog.
- Preserve project-thread reveal behavior after a generation creates a thread
  inside a project.
- Register the existing new-generation and create-project hotkeys in the web
  workspace.
- Ensure loading and authentication states remain coherent when sidebar and
  generation data resolve independently.

**Explicit exclusions:**

- Sidebar collapsing or persistence.
- Account, credits settings, and checkout-return behavior.
- Mobile or off-canvas behavior.
- Full consolidation of the desktop route and web bootstrap.

**Dependencies:** Chunks 1, 2, and 3.

**Acceptance evidence:**

- Projects and unprojected threads render for a signed-in browser user.
- Selecting any thread navigates to its route and marks it active.
- Global and project-targeted new-generation actions preserve the expected
  route search state.
- Project creation updates the sidebar through the shared optimistic workflow.
- A newly created project thread is revealed after project data refreshes.
- Hard refreshes on `/app` and `/app/threads/$threadId` retain the correct
  sidebar state and workspace.
- Web tests, shared package tests, and typechecking pass.

**Decisions:**

- Keep the authenticated shell mounted while generation models load, an
  unauthorized model response redirects to sign-in, or a retryable model error
  is shown in the main workspace.
- Use a fixed `16rem` browser sidebar width and an explicit `0px` shared header
  offset until collapse and responsive behavior are added in later chunks.
- Mount one web bootstrap at the parent `/app` route so browser navigation
  between the index and thread routes preserves local shell state.

**Implementation plan:**

- Move the web bootstrap to the parent `/app` route and derive the active thread
  and project search state there, leaving the index and thread route files as
  URL-matching leaves.
- Add a browser-owned, permanently expanded two-column workspace layout that
  composes the shared sidebar with the generation stage.
- Load unprojected threads in the authenticated workspace and wire the shared
  sidebar to browser thread URLs, route navigation, project creation, and the
  existing new-generation and create-project hotkeys.
- Retain a project-thread reveal request after a project-targeted submission so
  the shared sidebar expands when invalidated project data includes the new
  thread.
- Cover shell lifecycle, sidebar data and actions, route persistence, reveal
  behavior, fixed browser sizing, and direct route inputs with focused web
  tests, then run shared tests and workspace typechecking.

## Chunk 5: Add Browser Collapse Controls and Persistence

**Status:** `Complete`

**Intended outcome:** Browser users can collapse and restore the sidebar without
introducing Electron-only controls into shared product code.

**Included work:**

- Add a compact browser control row above the sidebar that remains reachable
  when the sidebar is collapsed.
- Display the existing Remora wordmark at the left of the expanded control row.
- Register the existing sidebar-toggle hotkey.
- Animate the browser shell between expanded and collapsed states.
- Persist the browser preference in local storage.
- Preserve main-stage sizing and supplemental result-panel behavior in both
  states.

**Explicit exclusions:**

- Reusing Electron drag regions, updater controls, or navigation-history
  controls.
- Intercepting browser-native Back and Forward buttons, gestures, or shortcuts.
- Tracking or persisting a separate Remora-managed browser history.
- Mobile breakpoints or an overlay drawer.
- Synchronizing sidebar preference state between devices.

**Dependencies:** Chunk 4.

**Acceptance evidence:**

- The mouse control and keyboard shortcut both toggle the sidebar.
- The toggle remains accessible in expanded and collapsed states.
- Browser-native Back and Forward navigation continues to use TanStack Router's
  browser history.
- The workspace and result panels resize without overflow or hidden controls.
- The selected sidebar state survives a hard refresh.
- Web tests and typechecking pass.

**Decisions:**

- Use a 44px-high control row with the Remora wordmark on the left and the
  toggle aligned to the sidebar's top-right edge. Hide the wordmark and contract
  the row to the toggle footprint when collapsed so it remains reachable
  without adding a full-width browser titlebar.
- Persist a default-expanded preference under `remora:web-preferences` using
  the same shared, versioned Zustand storage factory as desktop.
- Share the host-neutral sidebar toggle while keeping desktop navigation
  history controls desktop-owned.
- Rely on the browser's native history UI and shortcuts for web navigation.

**Implementation plan:**

- Extract the versioned sidebar-preference store factory and host-neutral
  sidebar toggle into `@remora/app/sidebar`, then configure the existing
  desktop and new web stores with separate keys.
- Convert the web workspace to a controlled, animated sidebar grid and render
  the compact sidebar control above its content with browser-appropriate
  tooltip placement.
- Keep browser routing on TanStack Router's native browser history without
  Remora-specific controls, hotkeys, or session tracking.
- Cover shared persistence and controls, browser layout, native history
  delegation, and desktop regressions before running package tests,
  typechecking, and the web production build.

## Chunk 6: Add the Account Footer, Credits Settings, and Checkout Return

**Status:** `Not planned`

**Intended outcome:** The web sidebar exposes the same account identity and
credit entry points as desktop, backed by a valid browser credits destination.

**Included work:**

- Move the desktop-owned account footer into shared product code and consume it
  from both host sidebars.
- Share the account avatar, display name, credit-balance state, settings menu,
  and conditional get-credits action.
- Add the web `/app/settings/credits` route and the minimum shared credits
  settings surface required by the footer destination.
- Route browser checkout back to the web settings page and refresh balance and
  checkout state appropriately.
- Keep custom-protocol and Electron checkout returns desktop-owned.

**Explicit exclusions:**

- Unrelated settings pages.
- Redesigning credit purchasing or pricing.
- Changing Stripe fulfillment, balance calculations, or database behavior.
- Mobile sidebar treatment.

**Dependencies:** Chunks 3 and 4.

**Acceptance evidence:**

- User identity and avatar fallback render correctly in both hosts.
- Credits and get-credits actions navigate to valid host routes.
- The get-credits action appears only for the existing zero-or-negative balance
  condition.
- Successful and canceled browser checkout returns preserve authentication and
  refresh the relevant credit state.
- Shared, web, and desktop tests and typechecking pass.

**Open decisions:**

- Determine how much of the existing desktop credits settings screen moves into
  `@remora/app`.
- Define the browser checkout return URL and which workspace context, if any,
  must be preserved.
- Decide whether account actions beyond credits belong in this chunk.

**Implementation plan:** To be written when this chunk enters `Planning`.

## Chunk 7: Add Responsive and Off-Canvas Behavior

**Status:** `Not planned`

**Intended outcome:** Smaller browser viewports can access sidebar navigation
without permanently reducing the generation workspace.

**Included work:**

- Define the breakpoint where the persistent sidebar becomes an overlay or
  off-canvas drawer.
- Add touch-friendly open and close controls, focus management, escape behavior,
  and an appropriate backdrop.
- Close or retain the drawer after navigation according to the selected mobile
  interaction model.
- Validate the focused mobile generation workflow alongside sidebar access.

**Explicit exclusions:**

- A general mobile redesign of every workspace control.
- New project-management features.
- Changing desktop sidebar behavior.
- Guest or anonymous generation flows.

**Dependencies:** Chunks 4 and 5. Chunk 6 is required only if its footer is
included in the responsive drawer.

**Acceptance evidence:**

- The drawer can be opened, navigated, and closed with touch and keyboard input.
- Focus is contained while open and restored to the trigger when closed.
- Project and thread navigation remains usable at the supported minimum
  viewport.
- The generation composer and results remain usable while the drawer is closed.
- Responsive web tests, accessibility checks, and typechecking pass.

**Open decisions:**

- Define supported breakpoints and the minimum browser viewport.
- Choose overlay, push, or hybrid behavior.
- Decide whether navigation closes the drawer automatically.

**Implementation plan:** To be written when this chunk enters `Planning`.

## Recommended Smallest Visible Milestone

The first browser-visible milestone should be an authenticated, always-open
sidebar that:

- Lists projects and their threads.
- Lists threads without a project.
- Marks the active thread.
- Navigates to existing threads.
- Starts global and project-targeted generations.
- Creates projects through the shared workflow.

This milestone ends with Chunk 4. Collapse persistence, the account and credits
footer, checkout returns, and responsive behavior remain independently
reviewable follow-up work.
