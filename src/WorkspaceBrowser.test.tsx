import { readFileSync } from "node:fs"
import path from "node:path"
import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { WorkspaceBrowser } from "./WorkspaceBrowser"

const REAL_TURTLE = readFileSync(path.join(import.meta.dirname, "__fixtures__/meldeart23.ttl"), "utf8")

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

  it("shows a heading explaining what the list is, so a first-time admin knows these are clickable", async () => {
    // Confirmed live (a real screenshot of a logged-in session): a bare
    // list of outline-variant buttons with no caption looks exactly like
    // a list of disabled text fields, not navigation -- nothing on the
    // page said what this was or that clicking an entry does anything.
    stubGithubApi(
      { tree: [{ path: "shapes/mikadiv-fm-fb3a934d/meldeart23-0f68f206.ttl", type: "blob" }] },
      Buffer.from(REAL_TURTLE, "utf8").toString("base64"),
    )
    render(<WorkspaceBrowser owner="o" repo="r" token="tok" onSelect={() => {}} />)
    await waitFor(() => expect(screen.getByText(/MiKaDiv_FM.*Meldeart23/)).toBeInTheDocument())
    expect(screen.getByText(/node shapes/i)).toBeInTheDocument()
  })

  it("shows a real empty state for a workspace with zero node shapes, not an error or a spinner", async () => {
    stubGithubApi({ tree: [] }, "")
    render(<WorkspaceBrowser owner="o" repo="r" token="tok" onSelect={() => {}} />)
    await waitFor(() => expect(screen.getByText(/no node shapes/i)).toBeInTheDocument())
  })

  it("flags a file at the wrong path for its own node shape instead of silently offering it alongside the real one", async () => {
    // Review Focus 4 (two node shapes whose citations happen to share
    // identical real display text) resolves, in this system, to this
    // exact scenario: the display label is entirely derived from
    // standard/shapeName, and so is the canonical file path -- so two
    // entries with an identical label can only mean one of them lives at
    // the wrong path (a stale copy, a rename left behind). Rather than
    // ever rendering two indistinguishable "MiKaDiv_FM / Meldeart23"
    // buttons (where picking the wrong one would quietly commit to the
    // wrong file), the one that doesn't match its own real citation's
    // canonical path is flagged, not hidden and not duplicated.
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
                  { path: "shapes/some-other-fake/duplicate.ttl", type: "blob" },
                ],
              }),
          })
        if (url.endsWith("/repos/o/r")) return Promise.resolve({ status: 200, json: () => Promise.resolve({ default_branch: "main" }) })
        if (url.includes("/contents/"))
          return Promise.resolve({ status: 200, json: () => Promise.resolve({ content: Buffer.from(REAL_TURTLE, "utf8").toString("base64"), sha: "s" }) })
        return Promise.reject(new Error(`unexpected url ${url}`))
      }),
    )
    render(<WorkspaceBrowser owner="o" repo="r" token="tok" onSelect={() => {}} />)
    await waitFor(() => expect(screen.getAllByText(/MiKaDiv_FM.*Meldeart23/).length).toBeGreaterThan(0))
    expect(screen.getAllByRole("button", { name: /MiKaDiv_FM.*Meldeart23/ })).toHaveLength(1)
    expect(screen.getByText(/some-other-fake\/duplicate\.ttl/)).toBeInTheDocument()
  })

  it("flags a node shape IRI outside the real OpenFASTER namespace instead of crashing the whole list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/git/trees/"))
          return Promise.resolve({
            status: 200,
            json: () => Promise.resolve({ tree: [{ path: "shapes/foreign/foreign.ttl", type: "blob" }] }),
          })
        if (url.endsWith("/repos/o/r")) return Promise.resolve({ status: 200, json: () => Promise.resolve({ default_branch: "main" }) })
        if (url.includes("/contents/")) {
          const foreignTurtle = `
            @prefix sh: <http://www.w3.org/ns/shacl#> .
            <https://example.org/not-openfaster#Thing> a sh:NodeShape .
          `
          return Promise.resolve({ status: 200, json: () => Promise.resolve({ content: Buffer.from(foreignTurtle, "utf8").toString("base64"), sha: "s" }) })
        }
        return Promise.reject(new Error(`unexpected url ${url}`))
      }),
    )
    render(<WorkspaceBrowser owner="o" repo="r" token="tok" onSelect={() => {}} />)
    await waitFor(() => expect(screen.getByText(/foreign\.ttl/)).toBeInTheDocument())
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
