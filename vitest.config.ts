import path from "node:path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // tests/ is a separate Playwright suite (its own test runner, its own
    // package.json) for the pre-existing static login page -- vitest's
    // own default discovery would otherwise pick up login.spec.mjs too
    // and fail trying to run Playwright's test() API under vitest.
    exclude: ["node_modules/**", "tests/**"],
  },
})
