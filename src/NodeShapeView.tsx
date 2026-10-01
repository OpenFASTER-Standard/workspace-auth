import { useEffect, useState } from "react"
import { Button } from "@openfaster-standard/ui"
import { getPropertyShapes, parseShapeGraph, ReCitationPicker, ShapeField, type ShapeGraph } from "@openfaster-standard/shapes"
import {
  commitReCitation,
  fetchFile,
  getDefaultBranch,
  parseNodeShapeIri,
  slugify,
  type CommitResult,
} from "@openfaster-standard/write-client"

const SOURCES_OWNER = "OpenFASTER-Standard"
const SOURCES_REPO = "ontologies"

function commitResultMessage(result: CommitResult): string {
  switch (result.status) {
    case "committed":
      return "Citation updated."
    case "conflict":
      return "Someone else changed this file — reload and try again."
    case "auth-failed":
      return "Your session may have expired — log in again."
    case "network-error":
      return "Network error — check your connection and try again."
    case "resolution-failed":
      return `Couldn't resolve the new citation (${result.reason}) — it may no longer point to a valid value.`
  }
}

export function NodeShapeView({
  graph: initialGraph,
  nodeShapeIri,
  owner,
  repo,
  branch,
  token,
  onBack,
}: {
  graph: ShapeGraph
  nodeShapeIri: string
  owner: string
  repo: string
  branch: string
  token: string
  onBack: () => void
}) {
  // The sources mirror's own real default branch -- fetched once,
  // independently of `branch` (the *workspace* repo's own default branch,
  // a completely different repo). Using `branch` here would silently
  // break resolution for any workspace whose default branch isn't also
  // the name of ontologies' own default branch.
  const [sourcesBranch, setSourcesBranch] = useState<{ status: "loading" } | { status: "ok"; branch: string } | { status: "error" }>({
    status: "loading",
  })
  useEffect(() => {
    let cancelled = false
    getDefaultBranch(SOURCES_OWNER, SOURCES_REPO, token).then((result) => {
      if (cancelled) return
      setSourcesBranch(result.status === "ok" ? { status: "ok", branch: result.branch } : { status: "error" })
    })
    return () => {
      cancelled = true
    }
  }, [token])

  const resolveSourceUri = (fileUri: string) =>
    fileUri.replace(
      "file:///work/ontologies/",
      `https://raw.githubusercontent.com/${SOURCES_OWNER}/${SOURCES_REPO}/${sourcesBranch.status === "ok" ? sourcesBranch.branch : ""}/`,
    )

  // Holds the graph as real state, not just the initial prop -- a
  // successful commit re-fetches and re-parses the file it was just
  // written to, so every ShapeField resolves against the real, current
  // citations rather than the pre-edit graph this component was first
  // handed (a `key`-based remount alone would re-render the same stale
  // graph object, re-resolving the same old XPath).
  const [graph, setGraph] = useState(initialGraph)
  const [editingPropertyShapeIri, setEditingPropertyShapeIri] = useState<string | null>(null)
  const [pendingEdit, setPendingEdit] = useState<{ propertyShapeIri: string; newXPath: string; previewValue: string } | null>(null)
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null)

  const propertyShapeIris = getPropertyShapes(graph, nodeShapeIri)

  if (sourcesBranch.status === "loading") return <div>Loading…</div>
  if (sourcesBranch.status === "error") return <div>Couldn't load this workspace.</div>

  return (
    <div>
      <Button onClick={onBack}>Back to node shapes</Button>
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
        <div>
          <ReCitationPicker
            graph={graph}
            propertyShapeIri={editingPropertyShapeIri}
            resolveSourceUri={resolveSourceUri}
            onPendingEdit={setPendingEdit}
          />
          <Button onClick={() => setEditingPropertyShapeIri(null)}>Cancel</Button>
        </div>
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
              if (result.status === "committed") {
                const { standard, shapeName } = parseNodeShapeIri(nodeShapeIri)
                const path = `shapes/${await slugify(standard)}/${await slugify(shapeName)}.ttl`
                const file = await fetchFile(owner, repo, path, branch, token)
                if (file.status === "ok") {
                  try {
                    setGraph(parseShapeGraph(file.content))
                  } catch {
                    // The commit itself already succeeded -- a malformed
                    // refetch is a display-only problem, not a reason to
                    // discard the commit result the admin already saw.
                  }
                }
              }
            }}
          >
            Confirm and commit
          </Button>
          <Button
            onClick={() => {
              setPendingEdit(null)
              setEditingPropertyShapeIri(null)
            }}
          >
            Cancel
          </Button>
        </div>
      )}

      {commitResult && <div>{commitResultMessage(commitResult)}</div>}
    </div>
  )
}
