import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outputs = path.resolve(projectRoot, "test-results", "screenshots");

test.describe("Coalition Atlas product", () => {
  test.beforeAll(async () => { await mkdir(outputs, { recursive: true }); });

  test("explains the verified coalition within the first viewport", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/PACT Atlas/);
    await expect(page.getByRole("heading", { name: /Fund the impossible/i })).toBeVisible();
    await expect(page.getByText("12N", { exact: true })).toBeVisible();
    await expect(page.getByText("Sandbox evidence", { exact: true })).toBeVisible();
    await page.screenshot({ path: path.join(outputs, "pact-atlas-desktop-preview.png"), fullPage: true });
  });

  test("runs the counterfactual flow without fabricating a transaction", async ({ page }) => {
    await page.goto("/#counterfactual");
    await page.selectOption("#coalition-select", "abcd");
    await expect(page.locator("#engine-result")).toContainText("blocked");
    await expect(page.locator("#engine-result")).toContainText("1N");
    await page.check("#topup-toggle");
    await expect(page.locator("#engine-result")).toContainText("viable");
    await expect(page.locator("#engine-result")).toContainText("exact result");
    await page.selectOption("#condition-select", "donor5");
    await expect(page.locator("#engine-result")).toContainText("model-only change");
    await page.click("[data-action='activate']");
    await expect(page.locator("#toast")).toContainText("not submitted");
  });

  test("moves from a graph selection to an inspectable project proof", async ({ page }) => {
    await page.goto("/#atlas");
    await page.click("[data-project='d']");
    await expect(page.locator("#project-inspector")).toContainText("Events");
    await expect(page.locator("#project-inspector")).toContainText("3N");
    await expect(page.locator("[data-project='d']")).toHaveClass(/selected/);
    await page.locator("[data-project='b']").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#project-inspector")).toContainText("Internet");
  });

  test("keeps the evidence ledger grounded when switching scenarios", async ({ page }) => {
    await page.goto("/#evidence");
    await page.selectOption("#evidence-select", "4");
    await expect(page.locator("#receipt-title")).toContainText("Sputnik");
    await expect(page.locator("#receipt-list")).toContainText("PACT funded");
    await expect(page.locator("#receipt-list")).toContainText("liabilities");
  });

  test("loads genuine evidence receipts and separates wallet state", async ({ page }) => {
    await page.goto("/#evidence");
    await expect(page.locator("#scenario-count")).toHaveText("5");
    await expect(page.locator("#sandbox-version")).toHaveText("2.13.4");
    await expect(page.locator("#receipt-list")).toContainText("PACT address");
    await page.click("#connect-wallet");
    await expect(page.locator("#toast")).toContainText("Read-only evidence mode");
    expect((await page.request.get("/data/evidence.json")).ok()).toBeTruthy();
    expect((await page.request.get("/HACKATHON.md")).ok()).toBeTruthy();
  });

  test("serves the direct preview routes used by a hosted deployment", async ({ request }) => {
    for (const route of ["/styles.css", "/styles-lurais.css", "/app.js", "/engine.mjs", "/near-workflow.mjs", "/near-adapter.mjs", "/data/evidence.json", "/HACKATHON.md"]) {
      const response = await request.get(route);
      expect(response.ok(), `${route} should return a successful response`).toBeTruthy();
    }
  });

  test("keeps signing behind an explicit wallet adapter boundary", async ({ page }) => {
    await page.addInitScript(() => {
      window.PACT_NEAR_ADAPTER = {
        connect: async () => "coalition-demo.testnet",
        call: async (request) => { window.__lastRequest = request; return { transactionHash: "sandbox-ui-stub-receipt" }; },
      };
      window.PACT_NEAR_CONFIG = { network: "testnet", contractId: "pact-demo.testnet", daoId: "dao-demo.testnet" };
    });
    await page.goto("/");
    await page.click("#connect-wallet");
    await expect(page.locator("#connect-wallet")).toContainText("coalit");
    await expect(page.locator("#wallet-status")).toContainText("Wallet connected");
    expect(await page.evaluate(() => Boolean(window.__lastRequest))).toBeFalsy();
    await page.click("[data-action='activate']");
    await expect(page.locator("#toast")).toContainText("explicit wallet approval");
    await expect(page.locator("#workflow-result")).toContainText("sandbox-ui-stub-receipt");
    expect(await page.evaluate(() => window.__lastRequest.methodName)).toBe("activate");
    expect(await page.evaluate(() => window.__lastRequest.args.allocations.length)).toBeGreaterThan(0);
  });

  test("has no serious automated accessibility violations", async ({ page }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter((violation) => ["critical", "serious"].includes(violation.impact))).toEqual([]);
  });

  test("does not emit browser console or page errors on the primary flow", async ({ page }) => {
    const errors = [];
    page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
    page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
    await page.goto("/");
    await expect(page.locator("#scenario-count")).toHaveText("5");
    expect(errors).toEqual([]);
  });

  test("reconciles the browser evidence count with the raw JSON", async ({ page, request }) => {
    const response = await request.get("/data/evidence.json");
    expect(response.ok()).toBeTruthy();
    const evidence = await response.json();
    await page.goto("/");
    await expect(page.locator("#scenario-count")).toHaveText(String(evidence.scenarios.length));
    expect(evidence.scenarios.every((scenario) => scenario.finalStatus?.liabilities === "0" || (scenario.finalStatuses?.funded?.liabilities === "0" && scenario.finalStatuses?.refund?.liabilities === "0"))).toBeTruthy();
  });

  test("renders a narrow mobile layout without horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Fund the impossible/i })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBeTruthy();
    await page.screenshot({ path: path.join(outputs, "pact-atlas-mobile-preview.png"), fullPage: true });
  });

  test("meets the local preview performance budget", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    const navigation = await page.evaluate(() => performance.getEntriesByType("navigation")[0].toJSON());
    expect(navigation.domContentLoadedEventEnd - navigation.startTime).toBeLessThan(1500);
    expect(navigation.loadEventEnd - navigation.startTime).toBeLessThan(2500);
    expect(await page.locator("#scenario-count")).toHaveText("5");
  });
});
