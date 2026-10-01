import { useState } from "react"
import type { ShapeGraph } from "@openfaster-standard/shapes"
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
      <p className="text-sm text-muted-foreground">{window._workspaceRepo ?? ""}</p>
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
