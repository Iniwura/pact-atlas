import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const screenshots = path.join(root, "test-results", "screenshots");
test.beforeAll(async () => { await mkdir(screenshots, { recursive: true }); });

test.describe("PACT Atlas — one-task funding console", () => {
  test("shows a usable funding decision on the first screen", async ({page}) => {
    await page.setViewportSize({width:1440,height:900});
    await page.goto("/console");
    await expect(page).toHaveTitle(/Atlas — PACT/);
    await expect(page.getByRole("heading",{name:/Make the coalition fundable/i})).toBeVisible();
    await expect(page.locator("#coalition-select")).toHaveValue("abcd");
    await expect(page.locator("#graph-state")).toHaveText("Blocked");
    await expect(page.locator("#engine-result")).toContainText("1 NEAR is missing");
    await expect(page.getByRole("button",{name:/Add 1 NEAR/i})).toBeVisible();
    const layout = await page.evaluate(() => ({
      map:document.querySelector(".map-panel").getBoundingClientRect().toJSON(),
      decision:document.querySelector(".decision-panel").getBoundingClientRect().toJSON(),
      heading:document.querySelector("#hero-title").getBoundingClientRect().toJSON()
    }));
    expect(layout.map.top).toBe(layout.decision.top);
    expect(layout.map.right).toBeLessThanOrEqual(layout.decision.left + 2);
    expect(layout.heading.height).toBeLessThan(75);
    expect(layout.map.top).toBeLessThan(245);
    await page.screenshot({path:path.join(screenshots,"pact-console-simple-desktop.png"),fullPage:true});
  });

  test("one action turns the blocked coalition into an exact allocation", async ({page}) => {
    await page.goto("/console");
    await expect(page.locator("#engine-result")).toContainText("1 NEAR is missing");
    await page.locator("#solve-gap").click();
    await expect(page.locator("#graph-state")).toHaveText("Fundable");
    await expect(page.locator(".map-panel")).toHaveAttribute("data-state","viable");
    await expect(page.locator(".map-node-d")).toHaveAttribute("data-simulated","added");
    await expect(page.locator("#engine-result")).toContainText("All four projects can activate");
    await expect(page.locator("#topup-toggle")).toBeChecked();
    await expect(page.locator("#allocation-proof")).toBeVisible();
    await page.locator("#allocation-proof summary").click();
    await expect(page.locator("#allocation-proof li").first()).toContainText("N");
    expect(await page.locator("#allocation-proof li").count()).toBeGreaterThanOrEqual(5);
    await expect(page.locator("#allocation-proof")).toContainText("No transaction submitted");
    await page.locator("#solve-gap").click();
    await expect(page.locator("#graph-state")).toHaveText("Blocked");
    await expect(page.locator("#allocation-proof")).toHaveCount(0);
  });

  test("reset works and advanced scenarios preserve exact model results", async ({page}) => {
    await page.goto("/console");
    await page.locator(".advanced-controls summary").click();
    await page.selectOption("#coalition-select","abc");
    await expect(page.locator("#graph-state")).toHaveText("Fundable");
    await page.selectOption("#coalition-select","d");
    await expect(page.locator("#graph-state")).toHaveText("Blocked");
    await page.selectOption("#coalition-select","abcd");
    await page.selectOption("#condition-select","donor5");
    await expect(page.locator("#graph-state")).toHaveText("Fundable");
    await expect(page.locator("#topup-toggle")).not.toBeChecked();
    await page.locator("#solve-gap").click();
    await expect(page.locator("#graph-state")).toHaveText("Blocked");
    await expect(page.locator("#condition-select")).toHaveValue("none");
  });

  test("graph selection is immediately readable and keyboard accessible", async ({page}) => {
    await page.goto("/console");
    await page.locator(".map-node-b").click();
    await expect(page.locator("#project-inspector")).toContainText("Internet");
    await expect(page.locator("#project-inspector")).toContainText("3N required");
    await page.locator(".map-node-c").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#project-inspector")).toContainText("Equipment");
    await expect(page.locator(".map-node-c")).toHaveAttribute("aria-pressed","true");
  });

  test("pledge selection changes the pledge details, not the selected graph project", async ({page}) => {
    await page.goto("/console#commitments");
    await page.locator(".map-node-b").click();
    await page.locator(".commitment-row").nth(1).click();
    await expect(page.locator("#commitment-detail")).toContainText("Donor 02");
    await expect(page.locator("#commitment-detail")).toContainText("Training");
    await expect(page.locator("#project-inspector")).toContainText("Internet");
    await expect(page.locator(".map-node-b")).toHaveAttribute("aria-pressed","true");
  });

  test("shows only truthful local NEAR evidence", async ({page,request}) => {
    const response=await request.get("/data/evidence.json");
    expect(response.ok()).toBeTruthy();
    const evidence=await response.json();
    await page.goto("/console#evidence");
    await expect(page.locator("#scenario-count")).toHaveText(String(evidence.scenarios.length));
    await expect(page.locator("#sandbox-version")).toHaveText("2.13.4");
    await page.selectOption("#evidence-select","4");
    await expect(page.locator("#receipt-list")).toContainText("PACT funded");
    await expect(page.locator("#receipt-list")).toContainText("liabilities");
    await expect(page.locator(".evidence-footnote")).toContainText("not live transactions");
    await expect(page.getByRole("link",{name:/Open raw evidence JSON/i})).toHaveAttribute("href","./data/evidence.json");
  });

  test("keeps wallet actions behind explicit approval", async ({page}) => {
    await page.goto("/console");
    await page.locator("#connect-wallet").click();
    await expect(page.locator("#toast")).toContainText("Read-only evidence mode");
    await page.locator("#workflow > summary").click();
    await page.locator("[data-action='activate']").click();
    await expect(page.locator("#workflow-result")).toContainText("not submitted");
  });

  test("allows a wallet test stub without auto-submitting funds", async ({page}) => {
    await page.addInitScript(() => {
      window.PACT_NEAR_ADAPTER = {
        connect:async()=>"coalition-demo.testnet",
        call:async(request)=>{window.__lastRequest=request;return {transactionHash:"sandbox-ui-stub-receipt"};}
      };
      window.PACT_NEAR_CONFIG = {network:"testnet",contractId:"pact-demo.testnet",daoId:"dao-demo.testnet"};
    });
    await page.goto("/console");
    await page.locator("#connect-wallet").click();
    expect(await page.evaluate(()=>Boolean(window.__lastRequest))).toBeFalsy();
    await page.locator("#workflow > summary").click();
    await page.locator("[data-action='activate']").click();
    await expect(page.locator("#workflow-result")).toContainText("No exact allocation certificate");
    expect(await page.evaluate(()=>Boolean(window.__lastRequest))).toBeFalsy();
    await page.locator(".advanced-controls summary").click();
    await page.selectOption("#coalition-select","abc");
    await page.locator("[data-action='activate']").click();
    await expect(page.locator("#workflow-result")).toContainText("sandbox-ui-stub-receipt");
    expect(await page.evaluate(()=>window.__lastRequest.methodName)).toBe("activate");
    expect(await page.evaluate(()=>window.__lastRequest.args.allocations.length)).toBeGreaterThan(0);
  });

  test("preserves the approved landing page", async ({page}) => {
    await page.goto("/");
    await expect(page.locator("#hero-title")).toContainText("FUND THE");
    await expect(page.locator("#hero-title")).toContainText("IMPOSSIBLE");
    await expect(page.locator(".hero-art")).toBeVisible();
  });

  test("has no serious or critical accessibility violations", async ({page}) => {
    await page.goto("/console");
    const audit=await new AxeBuilder({page}).analyze();
    expect(audit.violations.filter(x=>["serious","critical"].includes(x.impact))).toEqual([]);
  });

  test("has no console or page errors during interaction", async ({page}) => {
    const errors=[];
    page.on("pageerror",error=>errors.push(error.message));
    page.on("console",message=>{if(message.type()==="error")errors.push(message.text());});
    await page.goto("/console");
    await page.locator("#solve-gap").click();
    await page.locator(".map-node-d").click();
    await expect(page.locator("#scenario-count")).toHaveText("5");
    expect(errors).toEqual([]);
  });

  for (const width of [320,390,768,1024,1440]) {
    test("fits and works at "+width+"px", async ({page}) => {
      await page.setViewportSize({width,height:850});
      await page.goto("/console");
      await expect(page.locator("#network-map")).toBeVisible();
      const dimensions=await page.evaluate(()=>({
        viewport:window.innerWidth,
        page:document.documentElement.scrollWidth,
        map:document.querySelector(".map-panel").getBoundingClientRect().toJSON(),
        decision:document.querySelector(".decision-panel").getBoundingClientRect().toJSON()
      }));
      expect(dimensions.page,JSON.stringify(dimensions)).toBeLessThanOrEqual(width+1);
      if(width<=800)expect(dimensions.map.top).toBeLessThan(dimensions.decision.top);
      await page.locator("#solve-gap").click();
      await expect(page.locator("#graph-state")).toHaveText("Fundable");
      if(width===390)await page.screenshot({path:path.join(screenshots,"pact-console-simple-mobile.png"),fullPage:true});
    });
  }

  test("serves exact assets and performance stays in budget", async ({page,request}) => {
    for(const route of ["/console","/protocol-workspace.css","/app.js","/engine.mjs","/near-workflow.mjs","/data/evidence.json","/HACKATHON.md"]) {
      expect((await request.get(route)).ok(),route).toBeTruthy();
    }
    await page.goto("/console",{waitUntil:"load"});
    const n=await page.evaluate(()=>performance.getEntriesByType("navigation")[0].toJSON());
    expect(n.domContentLoadedEventEnd-n.startTime).toBeLessThan(1500);
    expect(n.loadEventEnd-n.startTime).toBeLessThan(2500);
  });
});
