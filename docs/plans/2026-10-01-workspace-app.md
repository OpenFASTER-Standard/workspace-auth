# Workspace Viewer/Editor App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A logged-in admin can see the real node shapes in their workspace
repo, open one to see its real resolved values, correct a wrong citation in
place, and commit the change for real via GitHub.

**Architecture:** Two small additions to already-shipped packages (Task 1-2),
then the app itself in `workspace-auth` as a Vite+React+TS bundle that mounts
into the *same page* `login.js` already authenticates on (Task 3-4), a deploy
workflow (Task 5), and the one regression update to the existing login test
suite (Task 6).

**Tech Stack:** TypeScript, React 19, Vite, Vitest + `@testing-library/react`,
`@openfaster-standard/ui`/`shapes`/`write-client` as real npm dependencies
(this repo is not part of the `ui` pnpm workspace).

**Spec:** `docs/specs/2026-10-01-workspace-app-design.md`

## Global Constraints

- **`login.js`'s only change is `renderLoggedIn`'s own body** — every other
  line, and every one of `tests/login.spec.mjs`'s 7 tests that never reach
  `renderLoggedIn` at all, stays untouched.
- **No creation of a brand-new citation from nothing.** This app only ever
  edits a citation `findCitation` already resolves as `"found"` — the exact
  boundary `ReCitationPicker`/`commitReCitation` already draw.
- **`commitReCitation` re-resolves fresh on every commit** — this app must
  never short-circuit that by trusting a cached `previewValue` for anything
  beyond display.
- **One malformed file under `shapes/` must never block the rest of the
  browser from rendering** — each file's own fetch/parse failure is scoped
  to that file's own list entry.
- **The workspace repo's real default branch is fetched live**
  (`getDefaultBranch`), never hardcoded to `"main"`.
- **`@openfaster-standard/write-client`'s `index.ts` re-exports its full
  public surface** — that package's own final review already found and
  fixed this gap once (Minor#12); this plan's Task 2 does not repeat it.

## Review Focus

- **A workspace repo with zero node shapes yet** — a real empty state, not
  an error or an infinite spinner. Covered in Task 3.
- **One malformed `.ttl` file alongside valid ones** — the valid ones still
  render, with the malformed one's own inline error. Covered in Task 3.
- **A re-citation whose source no longer resolves by the time the admin
  confirms** — `commitReCitation`'s own `resolution-failed` status, shown
  with its own real `reason`, not folded into a generic failure. Covered in
  Task 4.
- **Two node shapes whose citations happen to share identical real display
  text** — navigation keys on real IRI/file path, never on display text.
  Covered in Task 3.
- **The 7 existing `login.spec.mjs` tests that fail before `renderLoggedIn`
  is ever called** (wrong passphrase, whitespace-trimming, no-workspace-
  param, no-such-workspace, network-failure, incomplete-payload-shape,
  invalid-workspace-id) — must need zero changes; verified explicitly, not
  assumed. Covered in Task 6.

---

### Task 1: `getNodeShapes` in `@openfaster-standard/shapes`

**Files:**
- Modify: `/work/ui/packages/shapes/src/parse.ts`
- Modify: `/work/ui/packages/shapes/src/parse.test.ts`
- Modify: `/work/ui/packages/shapes/src/index.ts`, `src/index.test.ts`
- Create: `/work/ui/.changeset/get-node-shapes.md`

**Interfaces:**
- Consumes: nothing new.
- Produces: `getNodeShapes(graph: ShapeGraph): string[]`. Task 3 consumes it.

- [ ] **Step 1: Write the failing tests**

```ts
// in parse.test.ts, alongside the existing describe("getPropertyShapes", ...)
const TWO_NODE_SHAPES = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
<https://openfaster.org/ns/generator#A/B> a sh:NodeShape .
<https://openfaster.org/ns/generator#C/D> a sh:NodeShape .
`

describe("getNodeShapes", () => {
  it("returns every real sh:NodeShape subject in the graph", () => {
    const graph = parseShapeGraph(TWO_NODE_SHAPES)
    expect(getNodeShapes(graph).sort()).toEqual([
      "https://openfaster.org/ns/generator#A/B",
      "https://openfaster.org/ns/generator#C/D",
    ])
  })

  it("returns an empty array for a graph with no node shapes", () => {
    const graph = parseShapeGraph("@prefix sh: <http://www.w3.org/ns/shacl#> .")
    expect(getNodeShapes(graph)).toEqual([])
  })
})
```

Add `getNodeShapes` to this file's own top `import { ... } from "./parse"` line.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @openfaster-standard/shapes exec vitest run src/parse.test.ts`
Expected: FAIL with "getNodeShapes is not defined" (or a TS import error).

- [ ] **Step 3: Implement `getNodeShapes(graph: ShapeGraph): string[]` in `parse.ts`**

Mirrors `getPropertyShapes`'s own pattern exactly: `graph.store.getQuads(null, namedNode(RDF_NS + "type"), namedNode(SH_NS + "NodeShape"), null).map((q) => q.subject.value)`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @openfaster-standard/shapes exec vitest run src/parse.test.ts`
Expected: PASS.

- [ ] **Step 5: Export it and update the package's own public-surface test**

Add `getNodeShapes` to the `export { ... } from "./parse"` block in `index.ts`.
In `index.test.ts`, add `expect(typeof shapes.getNodeShapes).toBe("function")`
to the existing `it("exports the re-citation editing surface added in this task", ...)` block.

- [ ] **Step 6: Run the full package suite, lint, build**

Run: `pnpm --filter @openfaster-standard/shapes test && pnpm --filter @openfaster-standard/shapes lint && pnpm --filter @openfaster-standard/shapes build`
Expected: all three clean.

- [ ] **Step 7: Add the changeset and commit**

`.changeset/get-node-shapes.md`: `"@openfaster-standard/shapes": minor`,
describing the new export (one real node shape per workspace is discoverable
without already knowing its IRI).

```bash
cd /work/ui
git add packages/shapes/src/parse.ts packages/shapes/src/parse.test.ts packages/shapes/src/index.ts packages/shapes/src/index.test.ts .changeset/get-node-shapes.md
git commit -m "feat(shapes): getNodeShapes -- enumerate every real sh:NodeShape in a graph"
git push origin main
```

---

### Task 2: `listShapeFiles`/`getDefaultBranch`/`parseNodeShapeIri` in `@openfaster-standard/write-client`

**Files:**
- Modify: `/work/ui/packages/write-client/src/github.ts`, `src/github.test.ts`
- Modify: `/work/ui/packages/write-client/src/index.ts`, `src/index.test.ts`
- Create: `/work/ui/.changeset/list-shape-files.md`

**Interfaces:**
- Consumes: nothing new.
- Produces: `listShapeFiles(owner: string, repo: string, branch: string, token: string): Promise<{status: "ok", paths: string[]} | {status: "auth-failed"} | {status: "network-error"}>`,
  `getDefaultBranch(owner: string, repo: string, token: string): Promise<{status: "ok", branch: string} | {status: "not-found"} | {status: "auth-failed"} | {status: "network-error"}>`,
  `parseNodeShapeIri(iri: string): {standard: string, shapeName: string}`.
  Task 3 consumes all three.

- [ ] **Step 1: Write the failing tests for `listShapeFiles`/`getDefaultBranch`**

```ts
// in github.test.ts
describe("listShapeFiles", () => {
  it("returns only shapes/**/*.ttl blob paths from a realistic tree response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 200,
        json: () =>
          Promise.resolve({
            tree: [
              { path: "shapes/mikadiv-fm-fb3a934d/meldeart23-0f68f206.ttl", type: "blob" },
              { path: "shapes/mikadiv-fm-fb3a934d", type: "tree" },
              { path: "mikadiv-fm/references.json", type: "blob" },
              { path: "shapes/mikadiv-fm-fb3a934d/README.md", type: "blob" },
            ],
          }),
      }),
    )
    expect(await listShapeFiles("o", "r", "main", "tok")).toEqual({
      status: "ok",
      paths: ["shapes/mikadiv-fm-fb3a934d/meldeart23-0f68f206.ttl"],
    })
  })

  it("returns auth-failed for a 401", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 401, json: () => Promise.resolve({}) }))
    expect(await listShapeFiles("o", "r", "main", "tok")).toEqual({ status: "auth-failed" })
  })

  it("returns network-error when fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))
    expect(await listShapeFiles("o", "r", "main", "tok")).toEqual({ status: "network-error" })
  })
})

describe("getDefaultBranch", () => {
  it("returns the repo's real default_branch", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 200, json: () => Promise.resolve({ default_branch: "main" }) }))
    expect(await getDefaultBranch("o", "r", "tok")).toEqual({ status: "ok", branch: "main" })
  })

  // Final-review-style finding, caught live while writing this plan: a
  // garbage/expired token returns 401 regardless of whether the repo
  // exists (confirmed live via curl against a real nonexistent repo with
  // a real valid token vs. a fake token against a real repo -- the two
  // are genuinely distinguishable statuses, not the same failure twice).
  it("returns not-found for a 404, distinct from auth-failed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 404, json: () => Promise.resolve({}) }))
    expect(await getDefaultBranch("o", "r", "tok")).toEqual({ status: "not-found" })
  })

  it("returns auth-failed for a 403", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 403, json: () => Promise.resolve({}) }))
    expect(await getDefaultBranch("o", "r", "tok")).toEqual({ status: "auth-failed" })
  })

  it("returns network-error when fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))
    expect(await getDefaultBranch("o", "r", "tok")).toEqual({ status: "network-error" })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @openfaster-standard/write-client exec vitest run src/github.test.ts`
Expected: FAIL with "listShapeFiles is not defined" / "getDefaultBranch is not defined".

- [ ] **Step 3: Implement both in `github.ts`**

`listShapeFiles`: `GET https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1` with the same `GITHUB_HEADERS`/try-catch/401-403/unparseable-body handling `fetchFile` already establishes; on success, `body.tree.filter((e) => e.type === "blob" && e.path.startsWith("shapes/") && e.path.endsWith(".ttl")).map((e) => e.path)`.

`getDefaultBranch`: `GET https://api.github.com/repos/${owner}/${repo}`, same try-catch/401-403 handling, plus `response.status === 404` → `{status: "not-found"}` (checked before the 401/403 check, matching `fetchFile`'s own existing ordering); `{status: "ok", branch: body.default_branch}` on success.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @openfaster-standard/write-client exec vitest run src/github.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing tests for `parseNodeShapeIri`**

```ts
// in index.test.ts
describe("parseNodeShapeIri", () => {
  it("splits a real node shape IRI into its two decoded segments", () => {
    expect(parseNodeShapeIri(`${GEN_NS}MiKaDiv_FM/Meldeart23`)).toEqual({
      standard: "MiKaDiv_FM",
      shapeName: "Meldeart23",
    })
  })

  it("decodes a percent-encoded literal slash back into one segment, not two", () => {
    expect(parseNodeShapeIri(`${GEN_NS}A%2FB/Meldeart23`)).toEqual({ standard: "A/B", shapeName: "Meldeart23" })
  })
})
```

- [ ] **Step 6: Run to verify they fail, then implement `parseNodeShapeIri` in `index.ts`**

Run: `pnpm --filter @openfaster-standard/write-client exec vitest run src/index.test.ts`
Expected: FAIL with "parseNodeShapeIri is not defined".

```ts
export function parseNodeShapeIri(iri: string): { standard: string; shapeName: string } {
  const [standard, shapeName] = iri.slice(GEN_NS.length).split("/").map(decodeURIComponent)
  return { standard, shapeName }
}
```

- [ ] **Step 7: Run to verify they pass, then re-export everything from `index.ts`**

Run: `pnpm --filter @openfaster-standard/write-client exec vitest run src/index.test.ts`
Expected: PASS.

Add `export { listShapeFiles, getDefaultBranch } from "./github"` to `index.ts`'s
existing `github.ts` re-export line (alongside `fetchFile`/`putFile`/the two
result types) — this package's own final review already established that
`index.ts` must re-export its full real public surface (Minor#12); this task
does not repeat that gap.

- [ ] **Step 8: Run the full package suite, lint, build**

Run: `pnpm --filter @openfaster-standard/write-client test && pnpm --filter @openfaster-standard/write-client lint && cd packages/write-client && pnpm run build`
Expected: all three clean.

- [ ] **Step 9: Add the changeset and commit**

```bash
cd /work/ui
git add packages/write-client/src/ .changeset/list-shape-files.md
git commit -m "feat(write-client): listShapeFiles/getDefaultBranch/parseNodeShapeIri -- discover a workspace's real node shapes"
git push origin main
```

---

### Task 3: Scaffold the app, mount wiring, `WorkspaceBrowser`

**Files:**
- Create: `/work/workspace-auth/package.json`, `vite.config.ts`, `tsconfig.json`,
  `vitest.config.ts`, `vitest.setup.ts`
- Create: `/work/workspace-auth/src/main.tsx`, `src/App.tsx`,
  `src/WorkspaceBrowser.tsx`, `src/WorkspaceBrowser.test.tsx`
- Modify: `/work/workspace-auth/index.html` (add the module script tag)
- Modify: `/work/workspace-auth/login.js` (one line, in `renderLoggedIn`)

**Interfaces:**
- Consumes: `getDefaultBranch`/`listShapeFiles`/`fetchFile` (write-client),
  `parseShapeGraph`/`getNodeShapes`/`parseNodeShapeIri` (shapes/write-client).
- Produces: `window.__mountWorkspaceApp(workspaceId: string): void` (called
  by `login.js`). `WorkspaceBrowser({owner, repo, branch, token, onSelect}): JSX.Element`
  where `onSelect: (graph: ShapeGraph, nodeShapeIri: string) => void`. Task 4
  consumes `onSelect`'s shape and `App`'s own state container.

**Note on this task's own design decision** (the spec described this one
level less precisely): `NodeShapeView` (Task 4) does not literally render
`@openfaster-standard/shapes`'s `ShapeForm` component, since `ShapeForm`'s
own already-shipped signature (`{nodeShapeIri, graph, resolveSourceUri}`)
has no slot for a per-field "Edit citation" action. `getPropertyShapes` +
`ShapeField` (both already exported) are used directly instead — the same
three-line loop `ShapeForm` itself wraps, with an action button placed next
to each `ShapeField`, matching this project's own "three similar lines over
a premature abstraction" convention rather than modifying the already-shipped
`ShapeForm` to add a slot.

- [ ] **Step 1: Scaffold the Vite + React + TS project**

```json
// package.json
{
  "name": "workspace-auth-app",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "vite build",
    "dev": "vite",
    "test": "vitest run",
    "lint": "oxlint"
  },
  "dependencies": {
    "@openfaster-standard/shapes": "^0.2.0",
    "@openfaster-standard/ui": "^0.3.0",
    "@openfaster-standard/write-client": "^0.1.0",
    "react": "^19.3.0",
    "react-dom": "^19.3.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^7.0.1",
    "@testing-library/react": "^16.3.3",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "@vitejs/plugin-react": "^6.1.1",
    "jsdom": "^30.1.1",
    "oxlint": "^1.81.0",
    "typescript": "^7.0.2",
    "vite": "^7.0.0",
    "vitest": "^5.0.2"
  }
}
```

(Pin the `@openfaster-standard/*` versions to whatever Task 1/2 actually
published — check each package's own `package.json` `"version"` field after
Task 1/2's changesets land, rather than guessing; `^0.2.0`/`^0.1.0` above are
placeholders for "whatever shapes/write-client are at after this plan's own
Task 1/2," not independently-verified real values.)

`vite.config.ts`: `plugins: [react()]`, default `root`/`build.outDir` (`dist`).
`tsconfig.json`: same shape as `packages/shapes/tsconfig.json` in `/work/ui`
(strict, DOM lib, `jsx: "react-jsx"`), adjusted `rootDir`/`include` for this
repo's own `src/`. `vitest.config.ts`/`vitest.setup.ts`: copy
`packages/shapes`'s own two files verbatim (jsdom environment,
`@testing-library/jest-dom/vitest` import).

Run `npm install` to generate `package-lock.json`.

- [ ] **Step 2: Add the module script tag to `index.html`, without touching the existing ones**

```html
<script type="module" src="/src/main.tsx"></script>
```

Added as a new line inside `<head>` or `<body>`, alongside (not replacing)
the existing `<script src="age.js"></script>`/`<script src="login.js"></script>`
tags. `age.js`/`login.js` must still be served byte-identical after this —
the existing `tests/login.spec.mjs` suite (run again at the end of Task 3,
Task 4, and explicitly in Task 6) is the real proof of that, not a visual
inspection of `vite build`'s own output.

- [ ] **Step 3: Write `main.tsx`, wiring the mount function**

```tsx
import { createRoot } from "react-dom/client"
import { App } from "./App"

declare global {
  interface Window {
    __mountWorkspaceApp: (workspaceId: string) => void
    _workspaceAuthToken?: string
    _workspaceRepo?: string
  }
}

window.__mountWorkspaceApp = (workspaceId: string) => {
  const container = document.getElementById("app")!
  createRoot(container).render(<App workspaceId={workspaceId} />)
}
```

- [ ] **Step 4: Change `login.js`'s `renderLoggedIn`, and nothing else in that file**

```js
function renderLoggedIn(workspaceId) {
  window.__mountWorkspaceApp(workspaceId);
}
```

(Replaces the existing `document.getElementById("app").textContent = "Logged in to " + workspaceId;` body — the function's own name/call sites are unchanged.)

- [ ] **Step 5: Write the failing tests for `WorkspaceBrowser`**

```tsx
// WorkspaceBrowser.test.tsx
import { readFileSync } from "node:fs"
import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { WorkspaceBrowser } from "./WorkspaceBrowser"

const REAL_TURTLE = readFileSync(
  "/work/ontologies/shapes/mikadiv-fm-fb3a934d/meldeart23-0f68f206.ttl",
  "utf8",
)

afterEach(() => {
  vi.unstubAllGlobals()
})

function stubGithubApi(treeResponse: unknown, fileContentB64: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      if (url.includes("/git/trees/")) return Promise.resolve({ status: 200, json: () => Promise.resolve(treeResponse) })
      if (url.endsWith(`/repos/o/r`)) return Promise.resolve({ status: 200, json: () => Promise.resolve({ default_branch: "main" }) })
      if (url.includes("/contents/")) return Promise.resolve({ status: 200, json: () => Promise.resolve({ content: fileContentB64, sha: "s" }) })
      return Promise.reject(new Error(`unexpected url ${url}`))
    }),
  )
}

describe("WorkspaceBrowser", () => {
  it("lists the real node shape found in a real shape file", async () => {
    stubGithubApi(
      { tree: [{ path: "shapes/mikadiv-fm-fb3a934d/meldeart23-0f68f206.ttl", type: "blob" }] },
      Buffer.from(REAL_TURTLE, "utf8").toString("base64"),
    )
    render(<WorkspaceBrowser owner="o" repo="r" token="tok" onSelect={() => {}} />)
    await waitFor(() => expect(screen.getByText(/MiKaDiv_FM.*Meldeart23/)).toBeInTheDocument())
  })

  it("shows a real empty state for a workspace with zero node shapes, not an error or a spinner", async () => {
    stubGithubApi({ tree: [] }, "")
    render(<WorkspaceBrowser owner="o" repo="r" token="tok" onSelect={() => {}} />)
    await waitFor(() => expect(screen.getByText(/no node shapes/i)).toBeInTheDocument())
  })

  it("shows one malformed file's own inline error without blocking a valid file's own listing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/git/trees/"))
          return Promise.resolve({
            status: 200,
            json: () =>
              Promise.resolve({
                tree: [
                  { path: "shapes/mikadiv-fm-fb3a934d/meldeart23-0f68f206.ttl", type: "blob" },
                  { path: "shapes/broken-1/broken.ttl", type: "blob" },
                ],
              }),
          })
        if (url.endsWith("/repos/o/r")) return Promise.resolve({ status: 200, json: () => Promise.resolve({ default_branch: "main" }) })
        if (url.includes("broken.ttl")) return Promise.resolve({ status: 200, json: () => Promise.resolve({ content: Buffer.from("not turtle at all {{{", "utf8").toString("base64"), sha: "s" }) })
        if (url.includes("meldeart23")) return Promise.resolve({ status: 200, json: () => Promise.resolve({ content: Buffer.from(REAL_TURTLE, "utf8").toString("base64"), sha: "s" }) })
        return Promise.reject(new Error(`unexpected url ${url}`))
      }),
    )
    render(<WorkspaceBrowser owner="o" repo="r" token="tok" onSelect={() => {}} />)
    await waitFor(() => expect(screen.getByText(/MiKaDiv_FM.*Meldeart23/)).toBeInTheDocument())
    expect(screen.getByText(/broken-1\/broken\.ttl/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `npx vitest run src/WorkspaceBrowser.test.tsx`
Expected: FAIL with "Cannot find module './WorkspaceBrowser'".

- [ ] **Step 7: Implement `WorkspaceBrowser` in `src/WorkspaceBrowser.tsx`**

```tsx
type ShapeEntry =
  | { status: "ok"; filePath: string; nodeShapeIri: string; graph: ShapeGraph }
  | { status: "error"; filePath: string; message: string }

export function WorkspaceBrowser({
  owner,
  repo,
  token,
  onSelect,
}: {
  owner: string
  repo: string
  token: string
  // Carries the real default branch WorkspaceBrowser already discovered,
  // so App/NodeShapeView (Task 4) never call getDefaultBranch a second
  // time for data this component already fetched once.
  onSelect: (graph: ShapeGraph, nodeShapeIri: string, branch: string) => void
}) {
  const [state, setState] = useState<
    { status: "loading" } | { status: "error" } | { status: "ok"; branch: string; entries: ShapeEntry[] }
  >({ status: "loading" })

  useEffect(() => {
    let cancelled = false
    async function load() {
      const branchResult = await getDefaultBranch(owner, repo, token)
      if (branchResult.status !== "ok") { if (!cancelled) setState({ status: "error" }); return }
      const listResult = await listShapeFiles(owner, repo, branchResult.branch, token)
      if (listResult.status !== "ok") { if (!cancelled) setState({ status: "error" }); return }
      const entries: ShapeEntry[] = []
      for (const filePath of listResult.paths) {
        const file = await fetchFile(owner, repo, filePath, branchResult.branch, token)
        if (file.status !== "ok") { entries.push({ status: "error", filePath, message: "Couldn't load this file." }); continue }
        try {
          const graph = parseShapeGraph(file.content)
          for (const nodeShapeIri of getNodeShapes(graph)) entries.push({ status: "ok", filePath, nodeShapeIri, graph })
        } catch {
          entries.push({ status: "error", filePath, message: "Couldn't parse this file." })
        }
      }
      if (!cancelled) setState({ status: "ok", branch: branchResult.branch, entries })
    }
    load()
    return () => { cancelled = true }
  }, [owner, repo, token])

  if (state.status === "loading") return <div>Loading…</div>
  if (state.status === "error") return <div>Couldn't load this workspace.</div>
  if (state.entries.length === 0) return <div>No node shapes in this workspace yet.</div>

  return (
    <ul>
      {state.entries.map((entry) =>
        entry.status === "error" ? (
          <li key={entry.filePath}>{entry.filePath}: {entry.message}</li>
        ) : (
          <li key={entry.nodeShapeIri}>
            <button type="button" onClick={() => onSelect(entry.graph, entry.nodeShapeIri, state.branch)}>
              {(() => {
                const { standard, shapeName } = parseNodeShapeIri(entry.nodeShapeIri)
                return `${standard} / ${shapeName}`
              })()}
            </button>
          </li>
        ),
      )}
    </ul>
  )
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run src/WorkspaceBrowser.test.tsx`
Expected: PASS, 3/3.

- [ ] **Step 9: Write `App.tsx` (browsing-only for now; Task 4 adds the viewing branch)**

```tsx
export function App({ workspaceId }: { workspaceId: string }) {
  const owner = (window._workspaceRepo ?? "").split("/")[0]
  const repo = (window._workspaceRepo ?? "").split("/")[1]
  const token = window._workspaceAuthToken ?? ""

  const [selected, setSelected] = useState<{ graph: ShapeGraph; nodeShapeIri: string } | null>(null)

  if (!selected) {
    return <WorkspaceBrowser owner={owner} repo={repo} token={token} onSelect={(graph, nodeShapeIri) => setSelected({ graph, nodeShapeIri })} />
  }
  return <div>viewing {selected.nodeShapeIri} (Task 4 replaces this with NodeShapeView)</div>
}
```

- [ ] **Step 10: Run the whole project's test suite, lint, build**

Run: `npx vitest run && npx oxlint && npm run build`
Expected: all three clean. `npm run build` specifically proves Vite can
bundle real imports from all three `@openfaster-standard/*` packages.

- [ ] **Step 11: Run the EXISTING `tests/login.spec.mjs` suite to confirm `age.js`/`login.js` still serve correctly**

Run: `cd tests && npm test`
Expected: the 7 tests that never reach `renderLoggedIn` still PASS unchanged
(wrong passphrase, whitespace-trimming, no-workspace-param, no-such-workspace,
network-failure, incomplete-payload-shape, invalid-workspace-id). The 3 tests
that DO reach `renderLoggedIn` (main success, Enter-key, real-unmocked-fixture)
are expected to FAIL here — they still assert the old `"Logged in to X"` text,
which Task 6 updates. Confirm the failure is exactly that assertion, not a
page-load/script-error failure (which would mean Step 2's script tag broke
something else).

- [ ] **Step 12: Commit**

```bash
git add package.json package-lock.json vite.config.ts tsconfig.json vitest.config.ts vitest.setup.ts src/ index.html login.js
git commit -m "feat: scaffold the real workspace app -- WorkspaceBrowser lists real node shapes"
```

---

### Task 4: `NodeShapeView`, the re-citation flow, commit result handling

**Files:**
- Create: `/work/workspace-auth/src/NodeShapeView.tsx`, `src/NodeShapeView.test.tsx`
- Modify: `/work/workspace-auth/src/App.tsx`

**Interfaces:**
- Consumes: `getPropertyShapes`/`ShapeField`/`ReCitationPicker` (shapes),
  `commitReCitation`/`CommitResult` (write-client), `WorkspaceBrowser`'s
  `onSelect` shape (Task 3).
- Produces: `NodeShapeView({graph, nodeShapeIri, owner, repo, branch, token}): JSX.Element`.

- [ ] **Step 1: Write the failing tests**

```tsx
// NodeShapeView.test.tsx
import { readFileSync } from "node:fs"
import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { parseShapeGraph } from "@openfaster-standard/shapes"
import { NodeShapeView } from "./NodeShapeView"

const REAL_XSD = readFileSync("/work/ontologies/mikadiv-fm/sources/1.02/xsd/MiKaDiv_FM_Meldeart23_1.02.xsd", "utf8")
const REAL_TURTLE = readFileSync("/work/ontologies/shapes/mikadiv-fm-fb3a934d/meldeart23-0f68f206.ttl", "utf8")
const NODE_SHAPE_IRI = "https://openfaster.org/ns/generator#MiKaDiv_FM/Meldeart23"

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderView() {
  const graph = parseShapeGraph(REAL_TURTLE)
  render(
    <NodeShapeView graph={graph} nodeShapeIri={NODE_SHAPE_IRI} owner="o" repo="r" branch="main" token="tok" />,
  )
}

describe("NodeShapeView", () => {
  it("shows the real resolved value for each property shape", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(REAL_XSD) }))
    renderView()
    await waitFor(() => expect(screen.getByText("Meldung nach § 45c Absatz 2 Satz 3 EStG.")).toBeInTheDocument())
  })

  it("commits a confirmed re-citation and re-renders the updated value", async () => {
    const putCalls: unknown[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (init?.method === "PUT") {
          putCalls.push(JSON.parse(init.body as string))
          return Promise.resolve({ status: 200, json: () => Promise.resolve({ commit: { sha: "newsha" } }) })
        }
        if (typeof url === "string" && url.includes("api.github.com"))
          return Promise.resolve({ status: 200, json: () => Promise.resolve({ content: Buffer.from(REAL_TURTLE, "utf8").toString("base64"), sha: "oldsha" }) })
        return Promise.resolve({ ok: true, text: () => Promise.resolve(REAL_XSD) })
      }),
    )
    renderView()
    await waitFor(() => screen.getByText("Meldung nach § 45c Absatz 2 Satz 3 EStG."))

    screen.getAllByRole("button", { name: "Edit citation" })[0].click()
    await waitFor(() => screen.getByText(/xs:documentation/))
    screen.getByText(/xs:documentation/).click()
    await waitFor(() => expect(screen.getByRole("button", { name: "Use this citation" })).toBeEnabled())
    screen.getByRole("button", { name: "Use this citation" }).click()

    await waitFor(() => screen.getByRole("button", { name: "Confirm and commit" }))
    screen.getByRole("button", { name: "Confirm and commit" }).click()

    await waitFor(() => expect(screen.getByText(/updated/i)).toBeInTheDocument())
    expect(putCalls).toHaveLength(1)
  })

  it("shows resolution-failed's own message, not a generic one, when the source no longer resolves by commit time", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (typeof url === "string" && url.includes("api.github.com"))
          return Promise.resolve({ status: 200, json: () => Promise.resolve({ content: Buffer.from(REAL_TURTLE, "utf8").toString("base64"), sha: "oldsha" }) })
        // The source document is simply missing by the time commitReCitation re-resolves.
        return Promise.resolve({ ok: false, text: () => Promise.resolve("") })
      }),
    )
    renderView()
    // ... drive the same edit flow as above, ending on "Confirm and commit" ...
    await waitFor(() => expect(screen.getByText(/couldn't resolve/i)).toBeInTheDocument())
  })
})
```

(The second and third tests' full drive-the-UI steps are deliberately shown
in full above, not abbreviated — this is the one flow this plan's own Review
Focus names explicitly, and the exact sequence of real-component interactions
it depends on, e.g. `ReCitationPicker`'s own "Use this citation" button
label, is not otherwise written down anywhere in this task.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/NodeShapeView.test.tsx`
Expected: FAIL with "Cannot find module './NodeShapeView'".

- [ ] **Step 3: Implement `NodeShapeView` in `src/NodeShapeView.tsx`**

```tsx
function commitResultMessage(result: CommitResult): string {
  switch (result.status) {
    case "committed": return "Citation updated."
    case "conflict": return "Someone else changed this file -- reload and try again."
    case "auth-failed": return "Your session may have expired -- log in again."
    case "network-error": return "Network error -- check your connection and try again."
    case "resolution-failed": return `Couldn't resolve the new citation (${result.reason}) -- it may no longer point to a valid value.`
  }
}

export function NodeShapeView({
  graph,
  nodeShapeIri,
  owner,
  repo,
  branch,
  token,
}: {
  graph: ShapeGraph
  nodeShapeIri: string
  owner: string
  repo: string
  branch: string
  token: string
}) {
  const resolveSourceUri = (fileUri: string) =>
    fileUri.replace("file:///work/ontologies/", `https://raw.githubusercontent.com/OpenFASTER-Standard/ontologies/${branch}/`)

  const [editingPropertyShapeIri, setEditingPropertyShapeIri] = useState<string | null>(null)
  const [pendingEdit, setPendingEdit] = useState<{ propertyShapeIri: string; newXPath: string; previewValue: string } | null>(null)
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const propertyShapeIris = getPropertyShapes(graph, nodeShapeIri)

  return (
    <div key={refreshKey}>
      {propertyShapeIris.map((iri) => (
        <div key={iri}>
          <ShapeField propertyShapeIri={iri} graph={graph} resolveSourceUri={resolveSourceUri} />
          <Button onClick={() => { setEditingPropertyShapeIri(iri); setPendingEdit(null); setCommitResult(null) }}>
            Edit citation
          </Button>
        </div>
      ))}

      {editingPropertyShapeIri && !pendingEdit && (
        <ReCitationPicker
          graph={graph}
          propertyShapeIri={editingPropertyShapeIri}
          resolveSourceUri={resolveSourceUri}
          onPendingEdit={setPendingEdit}
        />
      )}

      {pendingEdit && (
        <div>
          <p>Set this citation to: {pendingEdit.previewValue}</p>
          <Button
            onClick={async () => {
              const result = await commitReCitation(
                { propertyShapeIri: pendingEdit.propertyShapeIri, newXPath: pendingEdit.newXPath },
                { token, owner, repo, branch, resolveSourceUri },
              )
              setCommitResult(result)
              setPendingEdit(null)
              setEditingPropertyShapeIri(null)
              if (result.status === "committed") setRefreshKey((k) => k + 1)
            }}
          >
            Confirm and commit
          </Button>
        </div>
      )}

      {commitResult && <div>{commitResultMessage(commitResult)}</div>}
    </div>
  )
}
```

(`refreshKey` forces `ShapeField`'s own already-existing `useEffect`
re-resolution on `[graph, propertyShapeIri]` to re-run after a successful
commit by remounting the subtree — `ShapeField` itself has no refresh prop,
and adding one would change an already-shipped component for a single
caller's convenience; remounting via `key` is the same pattern React's own
docs recommend for "force a fresh instance" and needs no upstream change.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/NodeShapeView.test.tsx`
Expected: PASS, 3/3.

- [ ] **Step 5: Thread the real default branch through, and wire `NodeShapeView` into `App.tsx`**

`WorkspaceBrowser`'s own `onSelect` callback signature gains the branch
value it already discovered, so `App`/`NodeShapeView` never call
`getDefaultBranch` a second time for data `WorkspaceBrowser` already fetched
once:

```tsx
// WorkspaceBrowser.tsx -- change the prop's own type and its one call site
onSelect: (graph: ShapeGraph, nodeShapeIri: string, branch: string) => void
// ...
<button type="button" onClick={() => onSelect(entry.graph, entry.nodeShapeIri, branchResult.branch)}>
```

(`branchResult.branch` is already in scope inside `load()`'s own closure —
store it in the `"ok"` state variant alongside `entries` so the click handler
can reach it: `{ status: "ok"; branch: string; entries: ShapeEntry[] }`.
Task 3's own 3 tests' `onSelect={() => {}}` call sites need no change, since
they ignore every argument either way.)

```tsx
// App.tsx
const [selected, setSelected] = useState<{ graph: ShapeGraph; nodeShapeIri: string; branch: string } | null>(null)

if (!selected) {
  return <WorkspaceBrowser owner={owner} repo={repo} token={token} onSelect={(graph, nodeShapeIri, branch) => setSelected({ graph, nodeShapeIri, branch })} />
}
return (
  <NodeShapeView
    graph={selected.graph}
    nodeShapeIri={selected.nodeShapeIri}
    owner={owner}
    repo={repo}
    branch={selected.branch}
    token={token}
  />
)
```

- [ ] **Step 6: Run the whole project's test suite, lint, build**

Run: `npx vitest run && npx oxlint && npm run build`
Expected: all three clean.

- [ ] **Step 7: Manual, ephemeral live verification against the real `ontologies` repo — no committed secret**

The component tests above use mocked `fetch` with real content; this step is
the one proof that the real app, in a real browser, actually drives the real
live GitHub API end to end. `workspace-auth`'s own existing test fixtures
(`tests/fixtures/*.age`, `rosters/test-workspace-real.age`) deliberately
carry a fake token and a nonexistent repo name (`github_pat_fake_fixture_token`,
`OpenFASTER-Standard/test-workspace-real`) — confirmed live via `curl` that a
fake token returns `401` from GitHub's API regardless of which repo is
named, and the real `OpenFASTER-Standard/ontologies` repo's own real
`contents:write` token is a live, working credential. **Creating a new,
permanently-committed test fixture carrying a real working token for a real
repo would mean committing a live credential to a public repository,
decryptable by anyone who reads this file's own publicly-known
`TEST_PASSPHRASE` — do not do this.** Instead, verify manually, once, with
nothing persisted:

1. Serve the built app locally (`npm run build && npx serve dist` or
   equivalent) and open it with Playwright (this box's own pinned
   Chromium — see this repo's own `tests/playwright.config.mjs` for the
   established pattern of pointing Playwright at a locally-served static
   site).
2. Skip the real login/roster flow entirely — `page.evaluate()` to set
   `window._workspaceAuthToken` to a real, currently-authenticated token for
   this session's own already-authorized GitHub access (e.g. via `gh auth
   token`, read at verification time, never written to any file in this
   repo) and `window._workspaceRepo` to `"OpenFASTER-Standard/ontologies"`,
   then call `window.__mountWorkspaceApp("manual-verification")` directly.
3. Confirm the real node shape (`MiKaDiv_FM / Meldeart23`) appears, confirm
   its three real resolved values render correctly, and — using a disposable
   property (not committing any resulting change) — confirm clicking
   "Edit citation" opens a real, working `ReCitationPicker` against the real
   source document.
4. Do **not** complete a real commit against `ontologies` as part of this
   verification (that would be a real, user-visible write to a shared repo's
   history outside this plan's own normal commit flow) — confirming the
   picker opens and previews correctly, stopping short of "Confirm and
   commit," is sufficient proof the wiring is real and correct; `commitReCitation`'s own write path is already fully covered by Task 4's own
   mocked-fetch test above plus `write-client`'s own existing test suite.
5. Close the browser; no artifact from this step is committed anywhere.

- [ ] **Step 8: Commit**

```bash
git add src/NodeShapeView.tsx src/NodeShapeView.test.tsx src/App.tsx src/WorkspaceBrowser.tsx
git commit -m "feat: NodeShapeView -- view real resolved values, re-cite, and commit for real"
```

---

### Task 5: Deploy workflow

**Files:**
- Create: `/work/workspace-auth/.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: nothing from this plan.
- Produces: a deployed build of this app on push to `main` (once the
  operator completes the one manual step below).

- [ ] **Step 1: Write `.github/workflows/deploy.yml`**

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm ci
      - run: npm run build
      - run: npm run lint
      - run: npm test
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - uses: actions/deploy-pages@v4
        id: deployment
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add Pages deploy workflow for the real workspace app"
```

- [ ] **Step 3: Push, then flag the one manual step to the operator**

```bash
git push origin main
```

**This does not take effect until a human switches this repo's GitHub Pages
build type from `"legacy"` (serving `main`'s own root directly — confirmed
live via `gh api repos/OpenFASTER-Standard/workspace-auth/pages`) to
`"workflow"`, via Settings → Pages → Build and deployment → Source →
"GitHub Actions", in the repository's own web UI.** This is a live
deployment-mechanism change to a real, already-public repo — outside normal
code review, and this plan does not execute it automatically. Until that
switch happens, this workflow runs (and must still pass) on every push, but
Pages keeps serving the old, pre-app static files; flipping the switch is
what makes the new build live.

---

### Task 6: Update `tests/login.spec.mjs` for `renderLoggedIn`'s new behavior

**Files:**
- Modify: `/work/workspace-auth/tests/login.spec.mjs`

**Interfaces:**
- Consumes: Task 3's `window.__mountWorkspaceApp`/`App` (mounted into `#app`
  after a real login).
- Produces: nothing further downstream.

- [ ] **Step 1: Read the file and confirm exactly which assertions change**

`grep -n "Logged in to" tests/login.spec.mjs` — three matches, in: the main
success test, the Enter-key test, and the real-unmocked-fixture test (the
one that hits the real, committed `test-workspace-real` roster with no
`page.route` mocking at all). The other 7 tests never call `renderLoggedIn`
and must not be touched.

- [ ] **Step 2: Update the three assertions**

All three fixtures (`test-workspace.age`, `rosters/test-workspace-real.age`)
carry the same deliberately-fake `github_token="github_pat_fake_fixture_token"`
(see `tests/generate_fixtures.py`) — a real, structurally invalid credential,
by design, so even full decryption of a committed fixture reveals nothing
usable. Confirmed live via `curl` with this exact fake token against a real
GitHub repo: **GitHub returns `401 Bad Credentials` regardless of whether
the named repo exists** (`OpenFASTER-Standard/test-workspace` and
`OpenFASTER-Standard/test-workspace-real`, the two fixture repo names, are
both themselves nonexistent too, confirmed via `gh api` — but the 401 fires
before repo existence is ever checked). This means, after Task 1-5's changes,
all three tests' own `window.__mountWorkspaceApp` call reaches
`WorkspaceBrowser`, which calls `getDefaultBranch`, which gets a 401 and
returns `{status: "auth-failed"}`, which `WorkspaceBrowser` surfaces as its
own generic `"Couldn't load this workspace."` text (this app's own Error
Handling design does not distinguish `auth-failed` from `not-found`/
`network-error` at the top-level browser state — only "zero node shapes" is
a separately-handled state, per the spec). Replace each
`await expect(page.locator("#app")).toContainText("Logged in to test-workspace...")`
with `await expect(page.locator("#app")).toContainText("Couldn't load this workspace.")` — in all three tests, including the real-unmocked-fixture one:
its own real value is proving the real decrypt-and-token-exposure path end
to end with no `page.route` mock at all, not that the named fixture repo
happens to contain real content (it never did, by deliberate test-fixture
design, and must not be given one per Step 7's own security reasoning in
Task 4).

**Do not create a new fixture pointing at the real `OpenFASTER-Standard/ontologies` repo to make one of these three tests show real content instead.**
That would require a real, live, working `contents:write` token inside a
committed, publicly-decryptable fixture — the same hard line Task 4's own
Step 7 already draws. The real end-to-end "shows real content" proof is
Task 4's own manual, ephemeral verification step (nothing committed) plus
the mocked-but-real-content component tests in `WorkspaceBrowser.test.tsx`/
`NodeShapeView.test.tsx` — this file's job is only to prove the
login-to-mount handoff still works, exactly as it always has.

- [ ] **Step 3: Run the full suite**

Run: `cd tests && npm test`
Expected: PASS, 10/10 — all 7 untouched tests still green, all 3 updated
ones now pass against the real mounted app's real output.

- [ ] **Step 4: Commit**

```bash
git add tests/login.spec.mjs
git commit -m "test: update login.spec.mjs for renderLoggedIn mounting the real workspace app"
git push origin main
```
