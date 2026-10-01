const WORKSPACE_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

function getWorkspaceId() {
  return new URLSearchParams(window.location.search).get("workspace");
}

// #app itself keeps the base container classes set in index.html
// (mx-auto max-w-2xl p-6, shared with the React app that later mounts into
// the same element) -- every render* function below only sets classes on
// the elements it creates, never on #app itself.

function renderNoWorkspace() {
  const app = document.getElementById("app");
  app.textContent = "";
  const p = document.createElement("p");
  p.className = "text-sm text-muted-foreground";
  p.textContent =
    "Which workspace? Open this page with ?workspace=<workspace-id>.";
  app.appendChild(p);
}

function renderInvalidWorkspace(workspaceId) {
  const app = document.getElementById("app");
  app.textContent = "";
  const p = document.createElement("p");
  p.className = "text-sm text-destructive";
  p.textContent = "Invalid workspace id: " + workspaceId;
  app.appendChild(p);
}

function renderNoSuchWorkspace(workspaceId) {
  const app = document.getElementById("app");
  app.textContent = "";
  const p = document.createElement("p");
  p.className = "text-sm text-destructive";
  p.textContent = "No such workspace: " + workspaceId;
  app.appendChild(p);
}

function renderLoadError() {
  const app = document.getElementById("app");
  app.textContent = "";
  const p = document.createElement("p");
  p.className = "text-sm text-destructive";
  p.textContent =
    "Couldn't load workspace -- check your connection and try again.";
  app.appendChild(p);
}

function renderLoginForm(workspaceId, onSubmit) {
  const app = document.getElementById("app");
  app.textContent = "";

  const wrapper = document.createElement("div");
  wrapper.className = "space-y-4";

  const heading = document.createElement("p");
  heading.className = "text-sm text-muted-foreground";
  heading.textContent = "Log in to " + workspaceId;
  wrapper.appendChild(heading);

  const form = document.createElement("form");
  form.className = "space-y-2";

  const label = document.createElement("label");
  label.className = "flex items-center gap-2 text-sm leading-none font-medium select-none";
  label.textContent = "Passphrase";
  label.htmlFor = "passphrase";
  form.appendChild(label);

  const input = document.createElement("input");
  input.type = "password";
  input.id = "passphrase";
  input.name = "passphrase";
  input.autocomplete = "off";
  input.className =
    "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";
  form.appendChild(input);

  const button = document.createElement("button");
  button.type = "submit";
  button.textContent = "Log in";
  button.className =
    "inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-primary px-2.5 h-8 text-sm font-medium text-primary-foreground hover:bg-primary/80 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
  form.appendChild(button);

  wrapper.appendChild(form);

  const error = document.createElement("p");
  error.id = "error";
  error.className = "text-sm text-destructive";
  wrapper.appendChild(error);

  app.appendChild(wrapper);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    button.disabled = true;
    button.textContent = "Logging in…";
    error.textContent = "";
    // age.js's own scrypt-based passphrase KDF is a tight, pure-JS
    // synchronous loop -- confirmed live, it blocks the main thread for
    // multiple real seconds with zero yields (a setInterval ticking
    // during a real decrypt call never fires once). Without forcing a
    // real paint here first, the two DOM mutations above are queued but
    // the browser never renders them before that block starts, so the
    // button looks completely frozen for the KDF's entire duration
    // instead of showing "Logging in…". A plain setTimeout(0) yield is
    // NOT enough -- the spec treats a render pass between tasks as
    // optional, so the browser can (and in testing, does) skip straight
    // to running the next task without painting first. The double
    // requestAnimationFrame is the standard, actually-guaranteed way to
    // force a paint to commit before proceeding: the first rAF fires
    // right before the next paint (so this mutation is included in it),
    // and the second rAF only fires after that paint has already
    // happened.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    try {
      await onSubmit(input.value, error);
    } finally {
      // On success this element is already gone (renderLoggedIn replaces
      // #app's whole content via React) -- setting properties on a
      // detached node is a harmless no-op, not an error.
      button.disabled = false;
      button.textContent = "Log in";
    }
  });
}

function renderLoggedIn(workspaceId) {
  window.__mountWorkspaceApp(workspaceId);
}

async function main() {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    renderNoWorkspace();
    return;
  }
  if (!WORKSPACE_ID_PATTERN.test(workspaceId)) {
    renderInvalidWorkspace(workspaceId);
    return;
  }

  let response;
  try {
    response = await fetch("rosters/" + workspaceId + ".age");
  } catch (e) {
    renderLoadError();
    return;
  }
  if (!response.ok) {
    renderNoSuchWorkspace(workspaceId);
    return;
  }
  const ciphertext = new Uint8Array(await response.arrayBuffer());

  renderLoginForm(workspaceId, async (enteredPassphrase, errorEl) => {
    try {
      const d = new age.Decrypter();
      d.addPassphrase(enteredPassphrase);
      const plaintext = await d.decrypt(ciphertext, "text");
      const payload = JSON.parse(plaintext);
      if (typeof payload.github_token !== "string" || typeof payload.workspace_repo !== "string") {
        throw new Error("roster payload has the wrong shape");
      }
      window._workspaceAuthToken = payload.github_token;
      window._workspaceRepo = payload.workspace_repo;
      renderLoggedIn(workspaceId);
    } catch (e) {
      errorEl.textContent = "Incorrect passphrase.";
    }
  });
}

main().catch(renderLoadError);
