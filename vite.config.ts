import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  // Relative, not absolute -- this is a GitHub Pages project site served
  // from a subpath (openfaster-standard.github.io/workspace-auth/), and
  // tests/playwright.config.mjs serves dist/ at its own server root, so
  // the base must work at both.
  base: "./",
  // @tailwindcss/vite scans THIS project's own source for utility classes
  // -- @openfaster-standard/ui/style.css (imported in main.tsx) only ever
  // covers classes used inside that package's own components; any class
  // this app's own JSX writes directly (layout, spacing) needs its own
  // Tailwind build, which is what src/theme.css (importing the shared
  // @openfaster-standard/ui/theme.css design tokens) exists for.
  plugins: [react(), tailwindcss()],
})
