import { useState } from "react"
import type { ShapeGraph } from "@openfaster-standard/shapes"
import { Button } from "@openfaster-standard/ui"
import { NodeShapeView } from "./NodeShapeView"
import { WorkspaceBrowser } from "./WorkspaceBrowser"

export function App({ workspaceId: _workspaceId }: { workspaceId: string }) {
  const owner = (window._workspaceRepo ?? "").split("/")[0]
  const repo = (window._workspaceRepo ?? "").split("/")[1]
  const token = window._workspaceAuthToken ?? ""

  const [selected, setSelected] = useState<{ graph: ShapeGraph; nodeShapeIri: string; branch: string } | null>(null)

  return (
    <div className="space-y-4">
      {/* Always visible, including in an error state -- "Couldn't load
          this workspace." alone doesn't say which workspace, and that's
          exactly the moment knowing matters most. */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{window._workspaceRepo ?? ""}</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            // The token/repo are held only in memory for the page's
            // lifetime (never localStorage/sessionStorage/a cookie) --
            // logging out is exactly: forget them and reload, which
            // naturally re-runs login.js's own main() and re-prompts for
            // the passphrase.
            delete window._workspaceAuthToken
            delete window._workspaceRepo
            window.location.reload()
          }}
        >
          Log out
        </Button>
      </div>
      {!selected ? (
        <WorkspaceBrowser
          owner={owner}
          repo={repo}
          token={token}
          onSelect={(graph, nodeShapeIri, branch) => setSelected({ graph, nodeShapeIri, branch })}
        />
      ) : (
        <NodeShapeView
          graph={selected.graph}
          nodeShapeIri={selected.nodeShapeIri}
          owner={owner}
          repo={repo}
          branch={selected.branch}
          token={token}
          onBack={() => setSelected(null)}
        />
      )}
    </div>
  )
}
