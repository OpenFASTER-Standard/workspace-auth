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
