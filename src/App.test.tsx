import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { App } from "./App"

afterEach(() => {
  vi.unstubAllGlobals()
  delete window._workspaceRepo
  delete window._workspaceAuthToken
})

describe("App", () => {
  it("always shows which workspace repo is being viewed, including in an error state", async () => {
    // "Couldn't load this workspace." alone doesn't say which workspace --
    // the one moment this matters most is exactly when something failed.
    window._workspaceRepo = "OpenFASTER-Standard/test-workspace-real"
    window._workspaceAuthToken = "fake-token"
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 401, json: () => Promise.resolve({}) }))

    render(<App workspaceId="test-workspace-real" />)

    await waitFor(() => expect(screen.getByText("Couldn't load this workspace.")).toBeInTheDocument())
    expect(screen.getByText("OpenFASTER-Standard/test-workspace-real")).toBeInTheDocument()
  })
})
