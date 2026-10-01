const WORKSPACE_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

function getWorkspaceId() {
  return new URLSearchParams(window.location.search).get("workspace");
}

function renderNoWorkspace() {
  document.getElementById("app").textContent =
    "Which workspace? Open this page with ?workspace=<workspace-id>.";
}

function renderInvalidWorkspace(workspaceId) {
  document.getElementById("app").textContent =
    "Invalid workspace id: " + workspaceId;
}

function renderNoSuchWorkspace(workspaceId) {
  document.getElementById("app").textContent =
    "No such workspace: " + workspaceId;
}

function renderLoadError() {
  document.getElementById("app").textContent =
    "Couldn't load workspace -- check your connection and try again.";
}

function renderLoginForm(workspaceId, onSubmit) {
  const app = document.getElementById("app");
  app.textContent = "";

  const heading = document.createElement("p");
  heading.textContent = "Log in to " + workspaceId;
  app.appendChild(heading);

  const form = document.createElement("form");

  const label = document.createElement("label");
  label.textContent = "Passphrase";
  label.htmlFor = "passphrase";
  form.appendChild(label);

  const input = document.createElement("input");
  input.type = "password";
  input.id = "passphrase";
  input.name = "passphrase";
  input.autocomplete = "off";
  form.appendChild(input);

  const button = document.createElement("button");
  button.type = "submit";
  button.textContent = "Log in";
  form.appendChild(button);

  app.appendChild(form);

  const error = document.createElement("p");
  error.id = "error";
  app.appendChild(error);

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
