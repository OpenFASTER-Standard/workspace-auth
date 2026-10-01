import { useEffect, useState } from "react"
import { GEN_NS, getNodeShapes, parseShapeGraph, type ShapeGraph } from "@openfaster-standard/shapes"
import { fetchFile, getDefaultBranch, listShapeFiles, parseNodeShapeIri, slugify } from "@openfaster-standard/write-client"
import { Button } from "@openfaster-standard/ui"

type ShapeEntry =
  | { status: "ok"; filePath: string; nodeShapeIri: string; graph: ShapeGraph; standard: string; shapeName: string }
  | { status: "error"; filePath: string; message: string }

// A node shape whose own real citation's canonical path doesn't match the
// file it was actually found in -- a stale copy, a rename left behind, or
// (per the spec's Review Focus) two node shapes whose display label would
// otherwise collide. Since the label is entirely derived from
// standard/shapeName, and so is the canonical path, two entries with an
// identical label can only mean this; surfacing it as its own inline error
// (never a second, indistinguishable selectable button) is the whole fix.
// Also guards against a `sh:NodeShape` outside the real OpenFASTER
// namespace (getNodeShapes matches any vocabulary's NodeShape) and a
// malformed IRI `parseNodeShapeIri` can't destructure -- neither should
// take down the rest of the list.
async function checkCanonicalPath(
  filePath: string,
  nodeShapeIri: string,
): Promise<{ status: "ok"; standard: string; shapeName: string } | { status: "error"; message: string }> {
  if (!nodeShapeIri.startsWith(GEN_NS)) return { status: "error", message: `${nodeShapeIri}: not a real OpenFASTER node shape IRI.` }

  let standard: string
  let shapeName: string
  try {
    ;({ standard, shapeName } = parseNodeShapeIri(nodeShapeIri))
  } catch {
    return { status: "error", message: `${nodeShapeIri}: couldn't parse this node shape IRI.` }
  }
  if (!standard || !shapeName) return { status: "error", message: `${nodeShapeIri}: couldn't parse this node shape IRI.` }

  const canonicalPath = `shapes/${await slugify(standard)}/${await slugify(shapeName)}.ttl`
  if (canonicalPath !== filePath)
    return { status: "error", message: `This file doesn't match ${standard}/${shapeName}'s own canonical path (${canonicalPath}).` }

  return { status: "ok", standard, shapeName }
}

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
      const entriesPerFile = await Promise.all(
        listResult.paths.map(async (filePath): Promise<ShapeEntry[]> => {
          const file = await fetchFile(owner, repo, filePath, branchResult.branch, token)
          if (file.status !== "ok") return [{ status: "error", filePath, message: "Couldn't load this file." }]
          try {
            const graph = parseShapeGraph(file.content)
            const fileEntries: ShapeEntry[] = []
            for (const nodeShapeIri of getNodeShapes(graph)) {
              const checked = await checkCanonicalPath(filePath, nodeShapeIri)
              fileEntries.push(
                checked.status === "ok"
                  ? { status: "ok", filePath, nodeShapeIri, graph, standard: checked.standard, shapeName: checked.shapeName }
                  : { status: "error", filePath, message: checked.message },
              )
            }
            return fileEntries
          } catch {
            return [{ status: "error", filePath, message: "Couldn't parse this file." }]
          }
        }),
      )
      if (!cancelled) setState({ status: "ok", branch: branchResult.branch, entries: entriesPerFile.flat() })
    }
    load()
    return () => {
      cancelled = true
    }
  }, [owner, repo, token])

  if (state.status === "loading") return <p className="text-sm text-muted-foreground">Loading…</p>
  if (state.status === "error") return <p className="text-sm text-destructive">Couldn't load this workspace.</p>
  if (state.entries.length === 0)
    return <p className="text-sm text-muted-foreground">No node shapes in this workspace yet.</p>

  return (
    <div className="space-y-2">
      {state.entries.map((entry, index) =>
        entry.status === "error" ? (
          // Keyed on index, not just filePath -- a single file can yield
          // more than one error entry (one per malformed node shape it
          // declares), which would otherwise collide.
          <p key={`${entry.filePath}#${index}`} className="text-sm text-destructive">
            {entry.filePath}: {entry.message}
          </p>
        ) : (
          // Keyed on filePath + IRI, not IRI alone -- defense in depth
          // against two files ever being listed for the same real node
          // shape (checkCanonicalPath above already prevents this from
          // happening via the normal path, since only one file can match
          // a given node shape's own canonical path).
          <Button
            key={`${entry.filePath}#${entry.nodeShapeIri}`}
            variant="outline"
            className="w-full justify-start"
            onClick={() => onSelect(entry.graph, entry.nodeShapeIri, state.branch)}
          >
            {entry.standard} / {entry.shapeName}
          </Button>
        ),
      )}
    </div>
  )
}
