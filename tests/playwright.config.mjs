import { defineConfig } from "@playwright/test";

// Port chosen to be unlikely to collide with other work on a shared box;
// if a future run ever fails with a webServer startup timeout rather than
// a test assertion, check `ss -tlnp | grep 47173` for a stale process
// holding this port before assuming the suite itself is broken.
const PORT = 47173;

export default defineConfig({
  testDir: ".",
  webServer: {
    // Serves the BUILT dist/ output, not the repo root -- index.html's
    // real entry point is a bundled, module-compiled script (/src/main.tsx
    // as written in the repo is raw TSX/JSX, which no browser can execute
    // directly; dist/'s own build step already copies age.js/login.js/
    // rosters/ alongside the compiled bundle, so nothing else changes).
    command: `cd .. && npm run build && cd tests && python3 -m http.server ${PORT} --directory ../dist`,
    url: `http://127.0.0.1:${PORT}/index.html?workspace=nonexistent`,
    reuseExistingServer: false,
  },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
  },
});
