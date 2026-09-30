import { test, expect } from "@playwright/test";
import path from "node:path";

const FIXTURES = path.resolve(import.meta.dirname, "fixtures");

test("correct passphrase decrypts the roster and shows logged-in state", async ({ page }) => {
  await page.route("**/rosters/test-workspace.age", (route) =>
    route.fulfill({ path: path.join(FIXTURES, "test-workspace.age") })
  );
  await page.goto("/index.html?workspace=test-workspace");

  await page.fill("input[type=password]", "test-fixture-passphrase-not-a-real-secret");
  await page.click("button");

  await expect(page.locator("#app")).toContainText("Logged in to test-workspace");
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
