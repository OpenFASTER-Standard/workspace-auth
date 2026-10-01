import { useState } from "react"
import type { ShapeGraph } from "@openfaster-standard/shapes"
import { WorkspaceBrowser } from "./WorkspaceBrowser"

export function App({ workspaceId: _workspaceId }: { workspaceId: string }) {
  const owner = (window._workspaceRepo ?? "").split("/")[0]
  const repo = (window._workspaceRepo ?? "").split("/")[1]
  const token = window._workspaceAuthToken ?? ""

  const [selected, setSelected] = useState<{ graph: ShapeGraph; nodeShapeIri: string } | null>(null)

  if (!selected) {
    return (
      <WorkspaceBrowser
        owner={owner}
        repo={repo}
        token={token}
        onSelect={(graph, nodeShapeIri) => setSelected({ graph, nodeShapeIri })}
      />
    )
  }
  return <div>viewing {selected.nodeShapeIri} (Task 4 replaces this with NodeShapeView)</div>
}
