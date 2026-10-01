# First Real Workspace Viewer/Editor App — Design

## Context

Every piece built so far is a library or a single-purpose page:
`annotation_model` (the `generator` repo, Python), `@openfaster-standard/ui`/
`shapes`/`write-client` (the `ui` repo, React components + a framework-agnostic
write client), `workspace-auth` (this repo, a static login page that proves an
admin holds a valid, scoped GitHub token and then does nothing further —
`renderLoggedIn` just prints "Logged in to X"). Nothing wires them into
something a person opens and actually uses.

**Two real gaps found during this task's own investigation, neither visible
from the roadmap task's own original framing:**

1. **No real citation data existed anywhere.** No committed repo had a
   `shapes/` directory; nothing had ever called `annotate_xpath` against the
   real corpus. Resolved as a one-time, human-supervised use of the
   already-built, already-verified `annotate_xpath`/`TargetStore` primitives
   (not new software) to seed three real citations on
   `MiKaDiv_FM/Meldeart23` into the real `OpenFASTER-Standard/ontologies`
   repo — confirmed live end-to-end afterward: fetched from GitHub,
   parsed by `@openfaster-standard/shapes`, resolved against the live
   source, all three correct. (This also found and fixed a real,
   previously-undiscovered bug: `TargetStore.write_shape` produced
   `rdflib`'s auto-generated `ns1:`/`ns2:` prefixes instead of readable
   ones, for every file this library had ever written — every existing
   test checked round-trip structure, never the literal prefix strings.)
2. **There is no way to discover which node shapes exist in a workspace
   repo.** `TargetStore._shape_path`'s own slug embeds a one-way hash
   suffix (`_slugify`), so a file's path alone doesn't reveal its
   human-readable standard/shape name — that only exists inside the file's
   own `sh:NodeShape` triple. Listing a workspace's real contents requires
   enumerating files via GitHub's own Tree API, then fetching and parsing
   each one.

**A third thing, decided rather than found:** `ReCitationPicker`/
`commitReCitation` only ever edit a citation that already exists — task 15's
own spec explicitly deferred "browsing a different source document than the
one already cited," and `commitReCitation` aborts with `resolution-failed`
if `findCitation` doesn't return `"found"`. Creating the *first* citation of
a never-before-cited property needs a corpus-wide document browser that
doesn't exist yet. This app does not build that — it is explicitly a
viewer/editor of citations that already exist, matching task 15/16's own
already-shipped scope exactly.

## Goal

A logged-in admin can see a real list of node shapes committed in their
workspace repo, open one to see its real resolved values, correct a wrong
or outdated citation in place, and commit the change for real via GitHub —
the literal "someone edited a Wikipedia page" moment for this platform.

## Non-Goals

- **Creating a brand-new citation from nothing.** See Context above — a
  real, separate, larger piece of future work (a corpus-wide document
  browser plus a candidate-discovery mechanism, deliberately not resurrected
  from the old, removed `discovery`/`citation_workflow` stack, which was
  never unified with `annotation_model` and has no bearing on its design).
- **SVG/PDF-sourced citations.** Same boundary every prior task in this
  chain has already drawn — XPath/XML citations only.
- **Multi-workspace switching inside the app.** One `window._workspaceRepo`
  per login, matching task 6's own scope exactly.
- **Offline support or any caching layer.** Every view always live-fetches
  from GitHub; staleness is handled the same way `commitReCitation` already
  handles it (re-resolve fresh, abort before writing if it no longer
  resolves) — no additional caching to invalidate.
- **A branch-switcher UI.** The workspace repo's real default branch is
  fetched once via GitHub's own API (`GET /repos/{owner}/{repo}`) rather
  than assuming `main` — a real repo's default branch is itself real,
  discoverable data, not something to hardcode past working examples.
- **Pagination or virtualization of the node-shape list.** The real corpus
  has exactly one real node shape today; even at full scale (13 XSD + 8 PDF
  families) this is a small, flat list.

## Architecture

### Where this lives, and why

Extends `workspace-auth` itself — not a new repo. Task 6's own spec chose
GitHub Pages specifically for "zero server, zero database"; a bundled React
app is still 100% static files once built, so that property is unaffected
either way. The real constraint is the token: `window._workspaceAuthToken`/
`window._workspaceRepo` are page-lifetime JS globals set by `login.js`'s
existing, already-tested decrypt flow — navigating to a *second* HTML page
after login would lose them unless passed through some other channel
(`sessionStorage`, a URL fragment), introducing real handoff complexity for
a live `contents:write` token with no corresponding benefit.

Instead, the new app mounts into the **same page**. `login.js`'s
`renderLoggedIn(workspaceId)` (currently `document.getElementById("app").textContent = "Logged in to " + workspaceId` — a dead end) changes to call
`window.__mountWorkspaceApp(workspaceId)`, a global function the new bundle
defines. This is a one-line change to already-shipped, already-tested code
(`tests/login.spec.mjs`'s existing assertions on `#app`'s text content after
login all change to expect the mounted app's own first real DOM output
instead — not a new testing strategy, the same Playwright pattern already
used throughout that file). Everything new lives in its own bundle
(`app.tsx` → built `app.js`, loaded via a new `<script type="module">` tag
in `index.html` alongside the existing `age.js`/`login.js`), keeping the
already-correct login/decrypt logic untouched and in its original form.

### Build and deployment

`workspace-auth` currently has no build step at all (confirmed live: no
`package.json` at the repo root, and GitHub Pages is configured as
`build_type: "legacy"` — serving `main`'s own root directly, no Actions
deployment). Introduces:

- A root `package.json` + Vite + React + TypeScript, building `app.tsx`
  into `app.js`/`app.css` (ES module output, matching this ecosystem's own
  established convention in the `ui` repo).
- A new `.github/workflows/deploy.yml`: on push to `main`, `npm ci && npm run build`, then `actions/deploy-pages` — switching this repo's Pages
  `build_type` to `"workflow"` so the **built** bundle is what's served,
  never a committed build artifact (matching the `ui` repo's own
  `packages/shapes/dist` being gitignored, not committed).
- The existing `tests/` Playwright suite (its own separate `package.json`,
  already working) is unaffected — it tests the real served page, not the
  build pipeline.

### New library pieces (both already-shipped packages, extended, not new ones)

- **`@openfaster-standard/shapes`**: `getNodeShapes(graph: ShapeGraph): string[]` — enumerates every real `sh:NodeShape` subject (mirrors
  `getPropertyShapes`'s own existing pattern exactly: a plain `store.getQuads`
  call, no new concepts).
- **`@openfaster-standard/write-client`**: `listShapeFiles(owner, repo, branch, token): Promise<{status: "ok", paths: string[]} | {status: "auth-failed"} | {status: "network-error"}>` — GitHub's real Tree API
  (`GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1`, confirmed live
  via `gh api` to return `{tree: [{path, type, ...}, ...]}`), filtered to
  `path.startsWith("shapes/") && path.endsWith(".ttl")`. `getDefaultBranch(owner, repo, token): Promise<{status: "ok", branch: string} | {status: "auth-failed"} | {status: "network-error"}>` — `GET /repos/{owner}/{repo}`,
  confirmed live to return `{default_branch: "main"}` for this org's real
  repos. `parseNodeShapeIri(iri: string): {standard: string, shapeName: string}` — the same per-segment `decodeURIComponent` logic
  `parsePropertyShapeIri` already uses, one segment shorter; both the new
  app and a future caller that only has a discovered `NodeShapeIri` (not a
  full property shape IRI) need this to re-derive the real file path via
  `slugify`.

### App components (new, in `workspace-auth`'s own `app.tsx` + siblings)

1. **`WorkspaceBrowser`** — on mount: `getDefaultBranch`, then
   `listShapeFiles`, then `fetchFile` + `parseShapeGraph` + `getNodeShapes`
   for each path found, building a flat list of `{nodeShapeIri, filePath}`.
   Renders each as a clickable item labeled via `parseNodeShapeIri` (e.g.
   "MiKaDiv_FM / Meldeart23"). A fetch/parse failure for one file surfaces
   inline next to that file's own entry — never blocks the rest of the list
   from rendering (one malformed file must not take down the whole browser).
2. **`NodeShapeView`** — given an already-fetched `ShapeGraph` + its real
   `nodeShapeIri`, renders `@openfaster-standard/shapes`'s own `ShapeForm`
   unchanged (real resolved values, `resolveSourceUri` mapping
   `file:///work/ontologies/` to this org's real
   `raw.githubusercontent.com/OpenFASTER-Standard/ontologies/<branch>/`
   mirror — the exact mapping this session's own live verification already
   proved correct). Each field has an "Edit citation" button.
3. **Re-citation flow** — clicking "Edit citation" opens
   `@openfaster-standard/shapes`'s own `ReCitationPicker` unchanged for that
   property shape. Its `onPendingEdit` payload is held in local state behind
   one more explicit confirm step (showing the pending edit's `previewValue`
   one last time) before calling `@openfaster-standard/write-client`'s
   `commitReCitation` with `{token: window._workspaceAuthToken, owner,
   repo, branch, resolveSourceUri}` (`owner`/`repo` parsed from
   `window._workspaceRepo`'s own `"owner/repo"` string, the same format
   `tests/generate_fixtures.py`'s real fixture payload already establishes).
4. **Commit result handling** — `"committed"` re-fetches and re-renders the
   same node shape fresh (closing the loop with real, post-commit data, not
   an optimistic local patch); `"conflict"`/`"auth-failed"`/`"network-error"`/
   `"resolution-failed"` each show their own distinct message (no shared
   generic "something went wrong" — a `"conflict"` is actionable
   differently than `"auth-failed"`).

## Data Flow

Login (unchanged) → `window.__mountWorkspaceApp` → `WorkspaceBrowser`
(`getDefaultBranch` → `listShapeFiles` → fetch+parse each → `getNodeShapes`)
→ admin picks one → `NodeShapeView` (`ShapeForm`, real resolved values) →
admin clicks a field's "Edit citation" → `ReCitationPicker` (browse the
same already-cited source, click a span, live preview) → admin confirms
twice (once inside `ReCitationPicker` itself, once more in this app's own
confirm step) → `commitReCitation` → real commit or a real, specific
failure → re-fetch and re-render on success.

## Error Handling

- Every GitHub-API-shaped failure (`auth-failed`/`network-error`/
  `"conflict"`) already has a real, established status from `write-client`
  — this app never invents new copy for a fact `write-client` already
  classified, matching how `ReCitationPicker` already reuses `ShapeField`'s
  own vocabulary rather than inventing a second one.
- A single malformed/unparseable `.ttl` file under `shapes/` surfaces its
  own inline error in `WorkspaceBrowser`'s list, never a blank page or a
  crash that hides every other, valid node shape.
- `getDefaultBranch`/`listShapeFiles` failing outright (not just one file)
  shows a real, top-level error state for the whole browser — distinct from
  "the workspace has zero node shapes yet," which is a legitimate, different
  state (an empty list, not an error).

## Testing Strategy

New component tests in `workspace-auth`'s own `app.tsx` test suite
(Vitest + `@testing-library/react`, matching `packages/shapes`' own
established convention) with a mocked `fetch` supplying real XML/Turtle
text (the same real `MiKaDiv_FM_Meldeart23_1.02.xsd` content and the real,
now-committed three-property-shape Turtle fixture this task's own seeding
produced, not synthetic stand-ins): `WorkspaceBrowser` lists a real node
shape correctly; one malformed file among several still renders the valid
ones with its own inline error; the full re-citation flow (pick a node
shape → view real values → edit one → confirm twice → commit) emits exactly
the right `commitReCitation` call and re-renders the updated value
afterward; each `CommitResult` status renders its own distinct message.
`getNodeShapes`/`listShapeFiles`/`getDefaultBranch`/`parseNodeShapeIri` each
get their own direct unit tests in their owning package, matching every
prior task's own convention (e.g. `parsePropertyShapeIri`'s own tests in
`write-client`). The existing `tests/login.spec.mjs` Playwright suite is
updated (not replaced) for the one changed assertion (`renderLoggedIn`'s new
behavior) and otherwise stays green unmodified.

## Review Focus

- **A workspace repo with zero node shapes yet** — must show a real empty
  state, not an error or an infinite loading spinner.
- **One malformed `.ttl` file alongside valid ones** — must not block the
  rest of the browser from rendering.
- **A re-citation whose source no longer resolves by the time the admin
  confirms** (the exact case `commitReCitation`'s own `resolution-failed`
  status exists for) — must show a real, specific message, not a generic
  failure indistinguishable from a conflict or an auth failure.
- **Confirming a `ReCitationPicker` selection, then confirming *again* in
  this app's own confirm step, after the underlying value changed in
  between** (a slow admin, a concurrent editor) — `commitReCitation` itself
  re-resolves fresh regardless of what either confirm step displayed, so
  this can only ever commit what's real at commit time, never a stale
  preview; a test should prove this explicitly, not just assume it from
  `commitReCitation`'s own prior test coverage.
- **Two node shapes in the same repo whose property shapes happen to share
  a citation's real display text** (e.g. two different standards both citing
  the literal word "Ja") — `WorkspaceBrowser`'s own list must key and
  navigate by real IRI/file path, never by display text.
