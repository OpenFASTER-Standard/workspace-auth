import { useEffect, useState } from "react"
import { getNodeShapes, parseShapeGraph, type ShapeGraph } from "@openfaster-standard/shapes"
import { fetchFile, getDefaultBranch, listShapeFiles, parseNodeShapeIri } from "@openfaster-standard/write-client"

type ShapeEntry =
  | { status: "ok"; filePath: string; nodeShapeIri: string; graph: ShapeGraph }
  | { status: "error"; filePath: string; message: string }

export function WorkspaceBrowser({
  owner,
  repo,
  token,
  onSelect,
}: {
  owner: string
  repo: string
  token: string
  // Carries the real default branch WorkspaceBrowser already discovered,
  // so App/NodeShapeView never call getDefaultBranch a second time for
  // data this component already fetched once.
  onSelect: (graph: ShapeGraph, nodeShapeIri: string, branch: string) => void
}) {
  const [state, setState] = useState<
    { status: "loading" } | { status: "error" } | { status: "ok"; branch: string; entries: ShapeEntry[] }
  >({ status: "loading" })

  useEffect(() => {
    let cancelled = false
    async function load() {
      const branchResult = await getDefaultBranch(owner, repo, token)
      if (branchResult.status !== "ok") {
        if (!cancelled) setState({ status: "error" })
        return
      }
      const listResult = await listShapeFiles(owner, repo, branchResult.branch, token)
      if (listResult.status !== "ok") {
        if (!cancelled) setState({ status: "error" })
        return
      }
      const entries: ShapeEntry[] = []
      for (const filePath of listResult.paths) {
        const file = await fetchFile(owner, repo, filePath, branchResult.branch, token)
        if (file.status !== "ok") {
          entries.push({ status: "error", filePath, message: "Couldn't load this file." })
          continue
        }
        try {
          const graph = parseShapeGraph(file.content)
          for (const nodeShapeIri of getNodeShapes(graph)) entries.push({ status: "ok", filePath, nodeShapeIri, graph })
        } catch {
          entries.push({ status: "error", filePath, message: "Couldn't parse this file." })
        }
      }
      if (!cancelled) setState({ status: "ok", branch: branchResult.branch, entries })
    }
    load()
    return () => {
      cancelled = true
    }
  }, [owner, repo, token])

  if (state.status === "loading") return <div>Loading…</div>
  if (state.status === "error") return <div>Couldn't load this workspace.</div>
  if (state.entries.length === 0) return <div>No node shapes in this workspace yet.</div>

  return (
    <ul>
      {state.entries.map((entry) =>
        entry.status === "error" ? (
          <li key={entry.filePath}>
            {entry.filePath}: {entry.message}
          </li>
        ) : (
          <li key={entry.nodeShapeIri}>
            <button type="button" onClick={() => onSelect(entry.graph, entry.nodeShapeIri, state.branch)}>
              {(() => {
                const { standard, shapeName } = parseNodeShapeIri(entry.nodeShapeIri)
                return `${standard} / ${shapeName}`
              })()}
            </button>
          </li>
        ),
      )}
    </ul>
  )
}
