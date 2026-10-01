import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  // Relative, not absolute -- this is a GitHub Pages project site served
  // from a subpath (openfaster-standard.github.io/workspace-auth/), and
  // tests/playwright.config.mjs serves dist/ at its own server root, so
  // the base must work at both.
  base: "./",
  plugins: [react()],
})
