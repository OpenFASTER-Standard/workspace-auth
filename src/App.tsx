import { useState } from "react"
import type { ShapeGraph } from "@openfaster-standard/shapes"
import { NodeShapeView } from "./NodeShapeView"
import { WorkspaceBrowser } from "./WorkspaceBrowser"

export function App({ workspaceId: _workspaceId }: { workspaceId: string }) {
  const owner = (window._workspaceRepo ?? "").split("/")[0]
  const repo = (window._workspaceRepo ?? "").split("/")[1]
  const token = window._workspaceAuthToken ?? ""

  const [selected, setSelected] = useState<{ graph: ShapeGraph; nodeShapeIri: string; branch: string } | null>(null)

  if (!selected) {
    return (
      <WorkspaceBrowser
        owner={owner}
        repo={repo}
        token={token}
        onSelect={(graph, nodeShapeIri, branch) => setSelected({ graph, nodeShapeIri, branch })}
      />
    )
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
}
