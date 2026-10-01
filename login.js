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

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    onSubmit(input.value, error);
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
