import { defineConfig } from "@playwright/test";

// Port chosen to be unlikely to collide with other work on a shared box;
// if a future run ever fails with a webServer startup timeout rather than
// a test assertion, check `ss -tlnp | grep 47173` for a stale process
// holding this port before assuming the suite itself is broken.
const PORT = 47173;

export default defineConfig({
  testDir: ".",
  webServer: {
    command: `python3 -m http.server ${PORT} --directory ..`,
    url: `http://127.0.0.1:${PORT}/index.html?workspace=nonexistent`,
    reuseExistingServer: false,
  },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
  },
});
