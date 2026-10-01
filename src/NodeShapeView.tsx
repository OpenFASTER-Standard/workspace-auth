import { useState } from "react"
import { Button } from "@openfaster-standard/ui"
import { getPropertyShapes, ReCitationPicker, ShapeField, type ShapeGraph } from "@openfaster-standard/shapes"
import { commitReCitation, type CommitResult } from "@openfaster-standard/write-client"

function commitResultMessage(result: CommitResult): string {
  switch (result.status) {
    case "committed":
      return "Citation updated."
    case "conflict":
      return "Someone else changed this file -- reload and try again."
    case "auth-failed":
      return "Your session may have expired -- log in again."
    case "network-error":
      return "Network error -- check your connection and try again."
    case "resolution-failed":
      return `Couldn't resolve the new citation (${result.reason}) -- it may no longer point to a valid value.`
  }
}

export function NodeShapeView({
  graph,
  nodeShapeIri,
  owner,
  repo,
  branch,
  token,
}: {
  graph: ShapeGraph
  nodeShapeIri: string
  owner: string
  repo: string
  branch: string
  token: string
}) {
  const resolveSourceUri = (fileUri: string) =>
    fileUri.replace("file:///work/ontologies/", `https://raw.githubusercontent.com/OpenFASTER-Standard/ontologies/${branch}/`)

  const [editingPropertyShapeIri, setEditingPropertyShapeIri] = useState<string | null>(null)
  const [pendingEdit, setPendingEdit] = useState<{ propertyShapeIri: string; newXPath: string; previewValue: string } | null>(null)
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const propertyShapeIris = getPropertyShapes(graph, nodeShapeIri)

  return (
    <div key={refreshKey}>
      {propertyShapeIris.map((iri) => (
        <div key={iri}>
          <ShapeField propertyShapeIri={iri} graph={graph} resolveSourceUri={resolveSourceUri} />
          <Button
            onClick={() => {
              setEditingPropertyShapeIri(iri)
              setPendingEdit(null)
              setCommitResult(null)
            }}
          >
            Edit citation
          </Button>
        </div>
      ))}

      {editingPropertyShapeIri && !pendingEdit && (
        <ReCitationPicker
          graph={graph}
          propertyShapeIri={editingPropertyShapeIri}
          resolveSourceUri={resolveSourceUri}
          onPendingEdit={setPendingEdit}
        />
      )}

      {pendingEdit && (
        <div>
          <p>Set this citation to: {pendingEdit.previewValue}</p>
          <Button
            onClick={async () => {
              const result = await commitReCitation(
                { propertyShapeIri: pendingEdit.propertyShapeIri, newXPath: pendingEdit.newXPath },
                { token, owner, repo, branch, resolveSourceUri },
              )
              setCommitResult(result)
              setPendingEdit(null)
              setEditingPropertyShapeIri(null)
              if (result.status === "committed") setRefreshKey((k) => k + 1)
            }}
          >
            Confirm and commit
          </Button>
        </div>
      )}

      {commitResult && <div>{commitResultMessage(commitResult)}</div>}
    </div>
  )
}
