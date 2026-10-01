import { readFileSync } from "node:fs"
import path from "node:path"
import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { parseShapeGraph } from "@openfaster-standard/shapes"
import { NodeShapeView } from "./NodeShapeView"

const REAL_XSD = readFileSync(path.join(import.meta.dirname, "__fixtures__/MiKaDiv_FM_Meldeart23_1.02.xsd"), "utf8")
const REAL_TURTLE = readFileSync(path.join(import.meta.dirname, "__fixtures__/meldeart23.ttl"), "utf8")
const NODE_SHAPE_IRI = "https://openfaster.org/ns/generator#MiKaDiv_FM/Meldeart23"
const ONTOLOGIES_REPO_URL = "https://api.github.com/repos/OpenFASTER-Standard/ontologies"

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderView(branch = "main", onBack = () => {}) {
  const graph = parseShapeGraph(REAL_TURTLE)
  render(<NodeShapeView graph={graph} nodeShapeIri={NODE_SHAPE_IRI} owner="o" repo="r" branch={branch} token="tok" onBack={onBack} />)
}

function stubOkFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      if (url === ONTOLOGIES_REPO_URL) return Promise.resolve({ status: 200, json: () => Promise.resolve({ default_branch: "main" }) })
      return Promise.resolve({ ok: true, text: () => Promise.resolve(REAL_XSD) })
    }),
  )
}

describe("NodeShapeView", () => {
  it("shows the real resolved value for each property shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url === ONTOLOGIES_REPO_URL) return Promise.resolve({ status: 200, json: () => Promise.resolve({ default_branch: "main" }) })
        return Promise.resolve({ ok: true, text: () => Promise.resolve(REAL_XSD) })
      }),
    )
    renderView()
    await waitFor(() => expect(screen.getByDisplayValue("Meldung nach § 45c Absatz 2 Satz 3 EStG.")).toBeInTheDocument())
  })

  it("resolves source documents using ontologies' own real default branch, not the workspace repo's own branch", async () => {
    // The workspace repo's own default branch is deliberately "develop"
    // here -- a completely different repo (ontologies) must never be
    // fetched at that same branch name just because it happens to share
    // one with the workspace repo in every other test.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url === ONTOLOGIES_REPO_URL) return Promise.resolve({ status: 200, json: () => Promise.resolve({ default_branch: "main" }) })
        if (typeof url === "string" && url.includes("raw.githubusercontent.com/OpenFASTER-Standard/ontologies/develop/"))
          return Promise.resolve({ ok: false, text: () => Promise.resolve("") })
        if (typeof url === "string" && url.includes("raw.githubusercontent.com/OpenFASTER-Standard/ontologies/main/"))
          return Promise.resolve({ ok: true, text: () => Promise.resolve(REAL_XSD) })
        return Promise.resolve({ ok: true, text: () => Promise.resolve(REAL_XSD) })
      }),
    )
    renderView("develop")
    await waitFor(() => expect(screen.getByDisplayValue("Meldung nach § 45c Absatz 2 Satz 3 EStG.")).toBeInTheDocument())
  })

  it("commits a confirmed re-citation and re-renders the updated value", async () => {
    const putCalls: unknown[] = []
    // A mutable "server" so a GET issued AFTER the PUT reflects the edit --
    // proving the view re-fetches post-commit rather than re-displaying the
    // same pre-edit graph it already had in memory (the field under edit,
    // AbgefKapitalertragsteuer, is re-cited to Meldeart23's own top-level
    // documentation node below, a real, different real value).
    let storedTurtle = REAL_TURTLE
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (init?.method === "PUT") {
          const body = JSON.parse(init.body as string)
          putCalls.push(body)
          storedTurtle = Buffer.from(body.content, "base64").toString("utf8")
          return Promise.resolve({ status: 200, json: () => Promise.resolve({ commit: { sha: "newsha" } }) })
        }
        if (url === ONTOLOGIES_REPO_URL) return Promise.resolve({ status: 200, json: () => Promise.resolve({ default_branch: "main" }) })
        if (typeof url === "string" && url.includes("api.github.com"))
          return Promise.resolve({ status: 200, json: () => Promise.resolve({ content: Buffer.from(storedTurtle, "utf8").toString("base64"), sha: "oldsha" }) })
        return Promise.resolve({ ok: true, text: () => Promise.resolve(REAL_XSD) })
      }),
    )
    renderView()
    await waitFor(() => screen.getByDisplayValue("Meldung nach § 45c Absatz 2 Satz 3 EStG."))

    // button[0] edits AbgefKapitalertragsteuer, whose current value is
    // "Abgeführte Kapitalertragsteuer nach § 44 Absatz 1a EStG." -- picking
    // the first xs:documentation node in the tree (Meldeart23's own,
    // "Meldung nach...") re-cites it to a real, different value.
    screen.getAllByRole("button", { name: "Edit citation" })[0].click()
    await waitFor(() => screen.getAllByText(/xs:documentation/).length > 0)
    screen.getAllByText(/xs:documentation/)[0].click()
    await waitFor(() => expect(screen.getByRole("button", { name: "Use this citation" })).toBeEnabled())
    screen.getByRole("button", { name: "Use this citation" }).click()

    await waitFor(() => screen.getByRole("button", { name: "Confirm and commit" }))
    screen.getByRole("button", { name: "Confirm and commit" }).click()

    await waitFor(() => expect(screen.getByText(/updated/i)).toBeInTheDocument())
    expect(putCalls).toHaveLength(1)
    // AbgefKapitalertragsteuer's own field, not a transient absence check --
    // a key-based remount briefly removes every field from the DOM, which
    // would make a "the old value is gone" assertion pass spuriously during
    // that window even if the stale value comes right back afterward.
    await waitFor(() =>
      expect(screen.getByLabelText("AbgefKapitalertragsteuer")).toHaveValue("Meldung nach § 45c Absatz 2 Satz 3 EStG."),
    )
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
        if (url === ONTOLOGIES_REPO_URL) return Promise.resolve({ status: 200, json: () => Promise.resolve({ default_branch: "main" }) })
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

  it("calls onBack when the back button is clicked, so viewing one node shape is never a dead end", async () => {
    stubOkFetch()
    const onBack = vi.fn()
    renderView("main", onBack)
    await waitFor(() => screen.getByDisplayValue("Meldung nach § 45c Absatz 2 Satz 3 EStG."))

    screen.getByRole("button", { name: "Back to node shapes" }).click()

    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it("shows a Cancel button during an edit that returns to the field list without committing anything", async () => {
    stubOkFetch()
    renderView()
    await waitFor(() => screen.getByDisplayValue("Meldung nach § 45c Absatz 2 Satz 3 EStG."))

    screen.getAllByRole("button", { name: "Edit citation" })[0].click()
    await waitFor(() => screen.getAllByText(/xs:documentation/).length > 0)
    screen.getAllByText(/xs:documentation/)[0].click()
    await waitFor(() => expect(screen.getByRole("button", { name: "Use this citation" })).toBeEnabled())
    screen.getByRole("button", { name: "Use this citation" }).click()

    await waitFor(() => screen.getByRole("button", { name: "Confirm and commit" }))
    screen.getByRole("button", { name: "Cancel" }).click()

    await waitFor(() => expect(screen.queryByRole("button", { name: "Confirm and commit" })).not.toBeInTheDocument())
    expect(screen.queryByText(/xs:documentation/)).not.toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "Edit citation" })).toHaveLength(3)
  })
})
