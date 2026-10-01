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

  it("shows a Log out button that clears the in-memory credential and reloads the page", async () => {
    // The token/repo are held only in memory for the page's lifetime (the
    // whole point of this app's security model -- never localStorage,
    // sessionStorage, or a cookie), so "log out" is exactly: forget them
    // and reload, which naturally re-runs login.js's own main() and
    // re-prompts for the passphrase.
    window._workspaceRepo = "OpenFASTER-Standard/test-workspace-real"
    window._workspaceAuthToken = "fake-token"
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 401, json: () => Promise.resolve({}) }))
    const reload = vi.fn()
    vi.stubGlobal("location", { ...window.location, reload })

    render(<App workspaceId="test-workspace-real" />)
    await waitFor(() => expect(screen.getByText("Couldn't load this workspace.")).toBeInTheDocument())

    screen.getByRole("button", { name: "Log out" }).click()

    expect(window._workspaceAuthToken).toBeUndefined()
    expect(window._workspaceRepo).toBeUndefined()
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
