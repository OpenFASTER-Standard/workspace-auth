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
    await waitFor(() => expect(screen.getByDisplayValue("Meldung nach § 45c Absatz 2 Satz 3 EStG.")).toBeInTheDocument())
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
    await waitFor(() => screen.getByDisplayValue("Meldung nach § 45c Absatz 2 Satz 3 EStG."))

    screen.getAllByRole("button", { name: "Edit citation" })[0].click()
    await waitFor(() => screen.getAllByText(/xs:documentation/).length > 0)
    screen.getAllByText(/xs:documentation/)[0].click()
    await waitFor(() => expect(screen.getByRole("button", { name: "Use this citation" })).toBeEnabled())
    screen.getByRole("button", { name: "Use this citation" }).click()

    await waitFor(() => screen.getByRole("button", { name: "Confirm and commit" }))
    screen.getByRole("button", { name: "Confirm and commit" }).click()

    await waitFor(() => expect(screen.getByText(/updated/i)).toBeInTheDocument())
    expect(putCalls).toHaveLength(1)
  })

  it("shows resolution-failed's own message, not a generic one, when the source no longer resolves by commit time", async () => {
    // The initial ShapeField displays (one fetch per property shape) and
    // ReCitationPicker's own preview (its own, separate fetch) must all
    // succeed normally -- only commitReCitation's own fresh re-resolution,
    // which happens strictly after "Use this citation" is clicked, should
    // find the source missing. A fixed call-count wouldn't be robust here
    // (three property shapes each fetch independently on mount, per task
    // 13's own established, already-accepted no-fetch-sharing design), so
    // the mock flips a flag at the one point in the flow that's actually
    // meaningful: right after the picker's own preview has already used
    // the real, successfully-fetched document.
    let shouldFailSourceFetch = false
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (typeof url === "string" && url.includes("api.github.com"))
          return Promise.resolve({ status: 200, json: () => Promise.resolve({ content: Buffer.from(REAL_TURTLE, "utf8").toString("base64"), sha: "oldsha" }) })
        if (shouldFailSourceFetch) return Promise.resolve({ ok: false, text: () => Promise.resolve("") })
        return Promise.resolve({ ok: true, text: () => Promise.resolve(REAL_XSD) })
      }),
    )
    renderView()
    await waitFor(() => screen.getByDisplayValue("Meldung nach § 45c Absatz 2 Satz 3 EStG."))

    screen.getAllByRole("button", { name: "Edit citation" })[0].click()
    await waitFor(() => screen.getAllByText(/xs:documentation/).length > 0)
    screen.getAllByText(/xs:documentation/)[0].click()
    await waitFor(() => expect(screen.getByRole("button", { name: "Use this citation" })).toBeEnabled())
    screen.getByRole("button", { name: "Use this citation" }).click()

    shouldFailSourceFetch = true

    await waitFor(() => screen.getByRole("button", { name: "Confirm and commit" }))
    screen.getByRole("button", { name: "Confirm and commit" }).click()

    await waitFor(() => expect(screen.getByText(/couldn't resolve/i)).toBeInTheDocument())
  })
})
