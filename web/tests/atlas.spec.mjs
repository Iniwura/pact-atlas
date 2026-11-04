import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outputs = path.resolve(projectRoot, "test-results", "screenshots");

test.describe("Coalition Atlas product", () => {
  test.beforeAll(async () => { await mkdir(outputs, { recursive: true }); });

  test("opens directly into the functional funding workspace", async ({ page }) => {
    await page.goto("/console");
    await expect(page).toHaveTitle(/PACT Atlas/);
    await expect(page.getByRole("heading", { name: /Funding Atlas/i })).toBeVisible();
    await expect(page.locator(".map-metrics")).toBeVisible();
    await expect(page.locator("#network-label")).toBeVisible();
    await page.screenshot({ path: path.join(outputs, "pact-atlas-desktop-preview.png"), fullPage: true });
  });

  test("shares the approved black orange and cream palette, without a second landing hero",async({page})=>{
    await page.goto("/console");
    await expect(page.getByRole("heading",{name:/Funding Atlas/i})).toBeVisible();
    await expect(page.locator(".brand-mark b")).toHaveCount(3);
    await expect(page.locator(".wordmark")).toHaveAttribute("href","/");
    await expect(page.locator("body")).toHaveClass(/protocol-app/);
    const styles=await page.evaluate(()=>{
      const hero=document.querySelector("#hero-title");
      const stage=document.querySelector(".evidence-section");
      const graph=document.querySelector(".map-node-b .node-core");
      const css=v=>getComputedStyle(v);
      return {headlineFont:css(hero).fontFamily,headlineWeight:css(hero).fontWeight,
        accent:css(document.querySelector(".title-period")).color,
        modelPanel:css(stage).backgroundColor,
        graphStroke:css(graph).stroke,
        background:css(document.body).backgroundColor}
    });
    expect(styles.headlineFont).not.toMatch(/Georgia|Times New Roman/);
    expect(Number(styles.headlineWeight)).toBeGreaterThanOrEqual(800);
    expect(styles.accent).toBe("rgb(245, 109, 57)");
    expect(styles.modelPanel).toBe("rgb(242, 240, 235)");
    expect(styles.graphStroke).toBe("rgb(239, 148, 94)");
    expect(styles.background).toBe("rgb(11, 12, 11)");
  });

  test("opens the real raw evidence from the console",async({page})=>{
    await page.goto("/console#evidence");
    const a=page.getByRole("link",{name:/Open raw evidence JSON/i});
    await expect(a).toHaveAttribute("href","./data/evidence.json");
    const r=await page.request.get("/data/evidence.json");
    expect(r.ok()).toBe(true);
  });

  test("runs the counterfactual flow without fabricating a transaction", async ({ page }) => {
    await page.goto("/console#counterfactual");
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

  test("makes the two-step funding demonstration work without navigating away",async({page})=>{
    await page.goto("/console");
    await expect(page.locator("#engine-result")).toContainText("viable");
    await page.click("#show-gap");
    await expect(page.locator("#coalition-select")).toHaveValue("abcd");
    await expect(page.locator("#engine-result")).toContainText("blocked");
    await expect(page.locator("#graph-state")).toHaveText("No exact certificate");
    await page.click("#solve-gap");
    await expect(page.locator("#topup-toggle")).toBeChecked();
    await expect(page.locator("#engine-result")).toContainText("exact result");
    await expect(page.locator("#result-indicator")).toHaveText("VIABLE");
    await expect(page.locator(".map-node-d")).toHaveAttribute("data-simulated","added");
    await page.click("#reset-scenario");
    await expect(page.locator("#coalition-select")).toHaveValue("abc");
    await expect(page.locator("#topup-toggle")).not.toBeChecked();
    await expect(page.locator("#result-indicator")).toHaveText("VIABLE");
  });

  test("inspects a donor beside the donor list, and the selected project beside the graph",async({page})=>{
    await page.goto("/console");
    await page.locator(".map-node-b").click();
    await expect(page.locator("#project-inspector")).toContainText("Internet");
    await page.locator(".commitment-row").nth(1).click();
    await expect(page.locator("#commitment-detail")).toContainText("COMMITMENT");
    await expect(page.locator("#project-inspector")).toContainText("Commitment");
    await expect(page.locator(".map-node-b")).not.toHaveClass(/selected/);
  });

  test("moves from a graph selection to an inspectable project proof", async ({ page }) => {
    await page.goto("/console#atlas");
    await page.click("[data-project='d']");
    await expect(page.locator("#project-inspector")).toContainText("Events");
    await expect(page.locator("#project-inspector")).toContainText("3N");
    await expect(page.locator("[data-project='d']")).toHaveClass(/selected/);
    await page.locator("[data-project='b']").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#project-inspector")).toContainText("Internet");
  });

  test("keeps the evidence ledger grounded when switching scenarios", async ({ page }) => {
    await page.goto("/console#evidence");
    await page.selectOption("#evidence-select", "4");
    await expect(page.locator("#receipt-title")).toContainText("Sputnik");
    await expect(page.locator("#receipt-list")).toContainText("PACT funded");
    await expect(page.locator("#receipt-list")).toContainText("liabilities");
  });

  test("loads genuine evidence receipts and separates wallet state", async ({ page }) => {
    await page.goto("/console#evidence");
    await expect(page.locator("#scenario-count")).toHaveText("5");
    await expect(page.locator("#sandbox-version")).toHaveText("2.13.4");
    await expect(page.locator("#receipt-list")).toContainText("PACT address");
    await page.click("#connect-wallet");
    await expect(page.locator("#toast")).toContainText("Read-only evidence mode");
    expect((await page.request.get("/data/evidence.json")).ok()).toBeTruthy();
    expect((await page.request.get("/HACKATHON.md")).ok()).toBeTruthy();
  });

  test("serves the direct preview routes used by a hosted deployment", async ({ request }) => {
    for (const route of ["/console", "/protocol-workspace.css", "/studio.css", "/studio.js", "/styles.css", "/app.js", "/engine.mjs", "/near-workflow.mjs", "/near-adapter.mjs", "/data/evidence.json", "/HACKATHON.md"]) {
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
    await page.goto("/console");
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

  test("desktop presents three actual working panels, not a full-height marketing hero",async({page})=>{
    await page.setViewportSize({width:1440,height:900});
    await page.goto("/console");
    const layout=await page.evaluate(()=>({
      controls:document.querySelector(".controls-panel").getBoundingClientRect().toJSON(),
      map:document.querySelector(".map-panel").getBoundingClientRect().toJSON(),
      outcome:document.querySelector(".result-panel").getBoundingClientRect().toJSON(),
      title:document.querySelector("#hero-title").getBoundingClientRect().toJSON()
    }));
    expect(layout.controls.top).toBe(layout.map.top);
    expect(layout.map.top).toBe(layout.outcome.top);
    expect(layout.map.left).toBeGreaterThan(layout.controls.right-2);
    expect(layout.outcome.left).toBeGreaterThan(layout.map.right-2);
    expect(layout.map.top).toBeLessThan(240);
    expect(layout.title.height).toBeLessThan(85);
  });

  test("has no serious automated accessibility violations", async ({ page }) => {
    await page.goto("/console");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter((violation) => ["critical", "serious"].includes(violation.impact))).toEqual([]);
  });

  test("does not emit browser console or page errors on the primary flow", async ({ page }) => {
    const errors = [];
    page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
    page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
    await page.goto("/console");
    await expect(page.locator("#scenario-count")).toHaveText("5");
    expect(errors).toEqual([]);
  });

  test("reconciles the browser evidence count with the raw JSON", async ({ page, request }) => {
    const response = await request.get("/data/evidence.json");
    expect(response.ok()).toBeTruthy();
    const evidence = await response.json();
    await page.goto("/console");
    await expect(page.locator("#scenario-count")).toHaveText(String(evidence.scenarios.length));
    expect(evidence.scenarios.every((scenario) => scenario.finalStatus?.liabilities === "0" || (scenario.finalStatuses?.funded?.liabilities === "0" && scenario.finalStatuses?.refund?.liabilities === "0"))).toBeTruthy();
  });

  test("renders a narrow mobile layout without horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/console");
    await expect(page.getByRole("heading", { name: /Funding Atlas/i })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBeTruthy();
    await page.screenshot({ path: path.join(outputs, "pact-atlas-mobile-preview.png"), fullPage: true });
  });

  test("mobile shows the usable graph before form controls, without covering node D", async ({ page }) => {
    await page.setViewportSize({width:390,height:844});
    await page.goto("/console");
    const rect=await page.evaluate(()=>({
      project:document.querySelector(".map-node-d").getBoundingClientRect().toJSON(),
      canvas:document.querySelector(".map-canvas").getBoundingClientRect().toJSON(),
      map:document.querySelector(".map-panel").getBoundingClientRect().toJSON(),
      controls:document.querySelector(".controls-panel").getBoundingClientRect().toJSON()
    }));
    expect(rect.project.top).toBeGreaterThan(rect.canvas.top);
    expect(rect.project.bottom).toBeLessThan(rect.canvas.bottom+2);
    expect(rect.map.top).toBeLessThan(rect.controls.top);
    await page.locator(".map-node-d").click();
    await expect(page.locator("#project-inspector")).toContainText("Events");
  });

  test("meets the local preview performance budget", async ({ page }) => {
    await page.goto("/console", { waitUntil: "load" });
    const navigation = await page.evaluate(() => performance.getEntriesByType("navigation")[0].toJSON());
    expect(navigation.domContentLoadedEventEnd - navigation.startTime).toBeLessThan(1500);
    expect(navigation.loadEventEnd - navigation.startTime).toBeLessThan(2500);
    expect(await page.locator("#scenario-count")).toHaveText("5");
  });
});
