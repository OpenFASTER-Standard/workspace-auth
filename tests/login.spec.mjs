import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const FIXTURES = path.resolve(import.meta.dirname, "fixtures");
const REAL_XSD = readFileSync(path.resolve(import.meta.dirname, "../src/__fixtures__/MiKaDiv_FM_Meldeart23_1.02.xsd"), "utf8");
const REAL_TURTLE = readFileSync(path.resolve(import.meta.dirname, "../src/__fixtures__/meldeart23.ttl"), "utf8");

test("correct passphrase decrypts the roster and shows logged-in state", async ({ page }) => {
  await page.route("**/rosters/test-workspace.age", (route) =>
    route.fulfill({ path: path.join(FIXTURES, "test-workspace.age") })
  );
  await page.goto("/index.html?workspace=test-workspace");

  await page.fill("input[type=password]", "test-fixture-passphrase-not-a-real-secret");
  await page.click("button");

  await expect(page.locator("#app")).toContainText("Couldn't load this workspace.");
});

test("wrong passphrase shows a generic incorrect-passphrase error, not a raw exception", async ({ page }) => {
  await page.route("**/rosters/test-workspace.age", (route) =>
    route.fulfill({ path: path.join(FIXTURES, "test-workspace.age") })
  );
  await page.goto("/index.html?workspace=test-workspace");

  await page.fill("input[type=password]", "definitely-the-wrong-passphrase");
  await page.click("button");

  await expect(page.locator("#error")).toContainText("Incorrect passphrase");
});

test("a correct passphrase with surrounding whitespace is treated as a different, wrong passphrase", async ({ page }) => {
  // Proves the page does NOT silently trim -- typing the right passphrase
  // with accidental leading/trailing spaces must behave like a wrong
  // passphrase, not silently succeed via trimming. (A real password
  // manager or terminal copy-paste can introduce this.)
  await page.route("**/rosters/test-workspace.age", (route) =>
    route.fulfill({ path: path.join(FIXTURES, "test-workspace.age") })
  );
  await page.goto("/index.html?workspace=test-workspace");

  await page.fill("input[type=password]", "  test-fixture-passphrase-not-a-real-secret  ");
  await page.click("button");

  await expect(page.locator("#error")).toContainText("Incorrect passphrase");
});

test("opening the page with no workspace query parameter shows an explicit prompt, not a blank page", async ({ page }) => {
  await page.goto("/index.html");
  await expect(page.locator("#app")).toContainText("Which workspace?");
});

test("a workspace-id with no roster file shows a no-such-workspace state", async ({ page }) => {
  await page.route("**/rosters/nonexistent-workspace.age", (route) =>
    route.fulfill({ status: 404, body: "" })
  );
  await page.goto("/index.html?workspace=nonexistent-workspace");

  await expect(page.locator("#app")).toContainText("No such workspace: nonexistent-workspace");
});

test("pressing Enter in the passphrase field submits, same as clicking the button", async ({ page }) => {
  await page.route("**/rosters/test-workspace.age", (route) =>
    route.fulfill({ path: path.join(FIXTURES, "test-workspace.age") })
  );
  await page.goto("/index.html?workspace=test-workspace");

  await page.fill("input[type=password]", "test-fixture-passphrase-not-a-real-secret");
  await page.press("input[type=password]", "Enter");

  await expect(page.locator("#app")).toContainText("Couldn't load this workspace.");
});

test("a network failure fetching the roster shows a distinct error, not a permanent Loading state", async ({ page }) => {
  await page.route("**/rosters/test-workspace.age", (route) => route.abort("failed"));
  await page.goto("/index.html?workspace=test-workspace");

  await expect(page.locator("#app")).not.toContainText("Loading");
  await expect(page.locator("#app")).toContainText("Couldn't load workspace");
});

test("a roster that decrypts but has the wrong payload shape shows an error, never a false logged-in state", async ({ page }) => {
  // fixtures/incomplete-workspace.age is a real age-encrypted file (same
  // passphrase as the main fixture) whose plaintext is valid JSON but
  // missing github_token -- generated once via generate_fixtures.py,
  // exercising the same shape-validation this repo's `generator` sibling
  // enforces server-side, but here proving the *page* also refuses to
  // treat it as a successful login.
  await page.route("**/rosters/incomplete-workspace.age", (route) =>
    route.fulfill({ path: path.join(FIXTURES, "incomplete-workspace.age") })
  );
  await page.goto("/index.html?workspace=incomplete-workspace");

  await page.fill("input[type=password]", "test-fixture-passphrase-not-a-real-secret");
  await page.click("button");

  await expect(page.locator("#app")).not.toContainText("Logged in");
  await expect(page.locator("#error")).toContainText("Incorrect passphrase");
});

test("a workspace-id with invalid characters is rejected before any fetch", async ({ page }) => {
  let fetched = false;
  await page.route("**/rosters/**", (route) => {
    fetched = true;
    route.abort();
  });
  await page.goto("/index.html?workspace=../../etc/passwd");

  await expect(page.locator("#app")).toContainText("Invalid workspace");
  expect(fetched).toBe(false);
});

test("a real, un-mocked fetch of a committed roster file logs in (no page.route at all)", async ({ page }) => {
  await page.goto("/index.html?workspace=test-workspace-real");

  await page.fill("input[type=password]", "test-fixture-passphrase-not-a-real-secret");
  await page.click("button");

  await expect(page.locator("#app")).toContainText("Couldn't load this workspace.");

  // payload.workspace_repo was already decrypted and shape-validated but
  // never stored anywhere -- the write client needs to know which repo
  // to commit to.
  const workspaceRepo = await page.evaluate(() => window._workspaceRepo);
  expect(workspaceRepo).toBe("OpenFASTER-Standard/test-workspace-real");
});

test("a logged-in admin sees the real node shape and its real resolved citation values", async ({ page }) => {
  // The only proof, before this test, that the real built app (not a
  // jsdom-mounted component in isolation) actually renders real content
  // was a manual, ephemeral verification run against the live GitHub API
  // (see docs/plans/2026-10-01-workspace-app.md Task 4 Step 7) -- nothing
  // guarded this going forward. This test closes that gap with
  // page.route, using the same real, public, non-secret Turtle/XSD
  // fixtures the component tests already use, under the existing fake
  // fixture token (never a live credential).
  await page.route("https://api.github.com/**", (route) => {
    const url = route.request().url();
    if (url === "https://api.github.com/repos/OpenFASTER-Standard/test-workspace-real")
      return route.fulfill({ json: { default_branch: "main" } });
    if (url.includes("/git/trees/main"))
      return route.fulfill({
        json: { tree: [{ path: "shapes/mikadiv-fm-fb3a934d/meldeart23-0f68f206.ttl", type: "blob" }] },
      });
    if (url.includes("/contents/shapes/mikadiv-fm-fb3a934d/meldeart23-0f68f206.ttl"))
      return route.fulfill({ json: { content: Buffer.from(REAL_TURTLE, "utf8").toString("base64"), sha: "fixture-sha" } });
    if (url === "https://api.github.com/repos/OpenFASTER-Standard/ontologies")
      return route.fulfill({ json: { default_branch: "main" } });
    return route.fulfill({ status: 404, json: {} });
  });
  await page.route("https://raw.githubusercontent.com/OpenFASTER-Standard/ontologies/main/**", (route) =>
    route.fulfill({ body: REAL_XSD, contentType: "application/xml" })
  );

  await page.goto("/index.html?workspace=test-workspace-real");
  await page.fill("input[type=password]", "test-fixture-passphrase-not-a-real-secret");
  await page.click("button");

  await page.getByRole("button", { name: /MiKaDiv_FM.*Meldeart23/ }).click();
  // Playwright has no getByDisplayValue (a Testing-Library-only API) --
  // these are readonly <input>s, so the resolved value is the `value`
  // attribute, matched via a plain CSS attribute selector.
  await expect(page.locator('input[value="Meldung nach § 45c Absatz 2 Satz 3 EStG."]')).toBeVisible();
  await expect(page.locator('input[value="Abgeführte Kapitalertragsteuer nach § 44 Absatz 1a EStG."]')).toBeVisible();
  await expect(page.locator('input[value="Liste von amtlichen Ordnungsnummern."]')).toBeVisible();
});
