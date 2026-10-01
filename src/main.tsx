import "@openfaster-standard/ui/style.css"
import "./theme.css"
import { createRoot } from "react-dom/client"
import { App } from "./App"

declare global {
  interface Window {
    __mountWorkspaceApp: (workspaceId: string) => void
    _workspaceAuthToken?: string
    _workspaceRepo?: string
  }
}

window.__mountWorkspaceApp = (workspaceId: string) => {
  const container = document.getElementById("app")!
  createRoot(container).render(<App workspaceId={workspaceId} />)
}
