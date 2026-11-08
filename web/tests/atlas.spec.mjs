import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const screenshots = path.join(root, "test-results", "screenshots");
test.beforeAll(async () => { await mkdir(screenshots, { recursive: true }); });

test.describe("PACT Atlas / first-time funding experience", () => {
  test("explains the task without prior crypto or technical knowledge", async ({page}) => {
    await page.setViewportSize({width:1440,height:900});
    await page.goto("/console");
    await expect(page.getByRole("heading",{name:"Can we fund all four?"})).toBeVisible();
    await expect(page.locator(".hero-description")).toContainText("Five supporters have pledged 12 NEAR");
    await expect(page.locator("#committed-value")).toHaveText("12");
    await expect(page.locator("#required-value")).toHaveText("13");
    await expect(page.locator("#gap-value")).toContainText("1 NEAR still needed");
    await expect(page.locator(".project-card")).toHaveCount(4);
    await expect(page.locator(".project-card[data-project='d']")).toHaveAttribute("data-coverage","2/3");
    await expect(page.locator(".project-card[data-project='d'] .project-state")).toHaveText("Needs 1 NEAR");
    await expect(page.locator("#solve-gap")).toContainText("Simulate +1 NEAR");
    await expect(page.locator(".model-disclosure")).toContainText("not a wallet");
    await page.screenshot({path:path.join(screenshots,"atlas-understand-desktop.png"),fullPage:true});
  });

  test("one safe interaction explains the solution and where all the money goes", async ({page}) => {
    await page.goto("/console");
    await page.locator("#solve-gap").click();
    await expect(page.locator("#graph-state")).toHaveText("All four possible");
    await expect(page.locator("#decision-heading")).toContainText("All four are possible");
    await expect(page.locator("#committed-value")).toHaveText("13");
    await expect(page.locator("#gap-value")).toHaveText("No funding gap");
    await expect(page.locator(".project-card[data-project='d']")).toHaveAttribute("data-coverage","3/3");
    await expect(page.locator(".project-card[data-project='d'] .project-state")).toHaveText("Can be funded");
    await expect(page.locator(".proof-project")).toHaveCount(4);
    await expect(page.locator("#allocation-proof")).toContainText("Supporter 01 · 3 NEAR");
    await expect(page.locator("#allocation-proof")).toContainText("Supporter 05 · 2 NEAR");
    await expect(page.locator("#allocation-proof")).toContainText("New commitment · 1 NEAR");
    await expect(page.locator("#allocation-proof")).toContainText("Each pledge used once");
    await expect(page.locator("#allocation-proof")).toContainText("not an onchain transaction");
    await page.screenshot({path:path.join(screenshots,"atlas-solution-desktop.png"),fullPage:true});
    await page.locator("#solve-gap").click();
    await expect(page.locator("#committed-value")).toHaveText("12");
    await expect(page.locator("#allocation-proof")).toHaveCount(0);
    await expect(page.locator(".project-card[data-project='d']")).toHaveAttribute("data-coverage","2/3");
  });

  test("explains why an eligible pledge cannot be spent twice", async ({page}) => {
    await page.goto("/console");
    await page.locator(".why-disclosure summary").click();
    await expect(page.locator(".why-disclosure")).toContainText("either Training or Events");
    await expect(page.locator(".why-disclosure")).toContainText("cannot pay for both");
    await expect(page.locator(".money-track")).toHaveAttribute("aria-valuenow","12");
  });

  test("every project card is selectable with mouse and keyboard", async ({page}) => {
    await page.goto("/console");
    await page.locator(".project-card[data-project='b']").click();
    await expect(page.locator("#project-inspector")).toContainText("Internet");
    await expect(page.locator("#project-inspector")).toContainText("Needs Training");
    await expect(page.locator(".project-card[data-project='b']")).toHaveAttribute("aria-pressed","true");
    await page.locator(".project-card[data-project='a']").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#project-inspector")).toContainText("Needs Internet and Equipment");
    await expect(page.locator(".project-card[data-project='a']")).toHaveAttribute("aria-pressed","true");
  });

  test("advanced scenario choices preserve exact constraint boundaries", async ({page}) => {
    await page.goto("/console");
    await page.locator("#advanced summary").click();
    await page.selectOption("#coalition-select","abc");
    await expect(page.locator("#graph-state")).toHaveText("Valid funding plan");
    await expect(page.locator("#gap-value")).toHaveText("2 NEAR unassigned");
    await page.selectOption("#coalition-select","d");
    await expect(page.locator("#graph-state")).toHaveText("Cannot activate");
    await page.selectOption("#coalition-select","abcd");
    await page.selectOption("#condition-select","donor5");
    await expect(page.locator("#graph-state")).toHaveText("All four possible");
    await expect(page.locator("#topup-toggle")).not.toBeChecked();
    await page.locator("#solve-gap").click();
    await expect(page.locator("#graph-state")).toHaveText("One project short");
    await expect(page.locator("#condition-select")).toHaveValue("none");
  });

  test("supporters and restrictions are legible without reading codes", async ({page}) => {
    await page.goto("/console#commitments");
    await expect(page.getByRole("heading",{name:"Supporters"})).toBeVisible();
    await page.locator(".commitment-row").nth(1).click();
    await expect(page.locator("#commitment-detail")).toContainText("Supporter 02");
    await expect(page.locator("#commitment-detail")).toContainText("Training");
    await expect(page.locator("#commitment-detail")).toContainText("Requires");
  });

  test("local sandbox evidence is truthful and easy to inspect", async ({page,request}) => {
    const evidence = await request.get("/data/evidence.json");
    expect(evidence.ok()).toBeTruthy();
    await page.goto("/console#evidence");
    await expect(page.locator("#scenario-count")).toHaveText("5");
    await expect(page.locator("#sandbox-version")).toHaveText("2.13.4");
    await page.selectOption("#evidence-select","4");
    await expect(page.locator("#receipt-list")).toContainText("PACT funded");
    await expect(page.locator("#receipt-list")).toContainText("liabilities");
    await expect(page.locator(".evidence-footnote")).toContainText("not your simulation");
    await expect(page.getByRole("link",{name:/Open raw evidence JSON/i})).toHaveAttribute("href","./data/evidence.json");
  });

  test("unavailable wallet mode cannot accidentally transact", async ({page}) => {
    await page.goto("/console");
    await page.locator("#workflow > summary").click();
    await page.locator("#connect-wallet").click();
    await expect(page.locator("#toast")).toContainText("Read-only evidence mode");
    await page.locator("[data-action='activate']").click();
    await expect(page.locator("#workflow-result")).toContainText("not submitted");
  });

  test("wallet test stub cannot sign the simulated extra contribution", async ({page}) => {
    await page.addInitScript(() => {
      window.PACT_NEAR_ADAPTER={
        connect:async()=>"demo-payer.testnet",
        call:async(request)=>{window.__lastRequest=request;return {transactionHash:"explicit-test-stub"};}
      };
      window.PACT_NEAR_CONFIG={network:"testnet",contractId:"pact-demo.testnet",daoId:"dao-demo.testnet"};
    });
    await page.goto("/console");
    await page.locator("#solve-gap").click();
    await page.locator("#workflow > summary").click();
    await page.locator("#connect-wallet").click();
    await page.locator("[data-action='activate']").click();
    await expect(page.locator("#workflow-result")).toContainText("No exact allocation certificate");
    expect(await page.evaluate(()=>Boolean(window.__lastRequest))).toBeFalsy();
    await page.locator("#advanced summary").click();
    await page.selectOption("#coalition-select","abc");
    await page.locator("[data-action='activate']").click();
    await expect(page.locator("#workflow-result")).toContainText("explicit-test-stub");
    expect(await page.evaluate(()=>window.__lastRequest.methodName)).toBe("activate");
  });

  test("approved cinematic homepage remains untouched", async ({page}) => {
    await page.goto("/");
    await expect(page.locator("#hero-title")).toContainText("FUND THE");
    await expect(page.locator("#hero-title")).toContainText("IMPOSSIBLE");
    await expect(page.locator(".hero-art img")).toBeVisible();
  });

  test("no serious or critical accessibility issues before and after simulation", async ({page}) => {
    await page.goto("/console");
    for (let i=0;i<2;i++) {
      if (i) await page.locator("#solve-gap").click();
      const audit=await new AxeBuilder({page}).analyze();
      expect(audit.violations.filter(x=>["serious","critical"].includes(x.impact))).toEqual([]);
    }
  });

  test("no script errors during a complete user journey", async ({page}) => {
    const errors=[];
    page.on("pageerror",e=>errors.push(e.message));
    page.on("console",m=>{if(m.type()==="error")errors.push(m.text());});
    await page.goto("/console");
    await page.locator(".project-card[data-project='d']").click();
    await page.locator("#solve-gap").click();
    await page.locator(".project-card[data-project='a']").click();
    await page.locator("#solve-gap").click();
    await expect(page.locator("#scenario-count")).toHaveText("5");
    expect(errors).toEqual([]);
  });

  for (const width of [320,360,390,768,1024,1440]) {
    test("usable and no horizontal overflow at "+width+"px", async ({page}) => {
      await page.setViewportSize({width,height:850});
      await page.goto("/console");
      await expect(page.locator(".project-card[data-project='d']")).toBeVisible();
      const dimensions=await page.evaluate(()=>({
        viewport:innerWidth,
        page:document.documentElement.scrollWidth,
        panel:document.querySelector(".decision-panel").getBoundingClientRect().toJSON(),
        project:document.querySelector(".map-panel").getBoundingClientRect().toJSON()
      }));
      expect(dimensions.page,JSON.stringify(dimensions)).toBeLessThanOrEqual(width+1);
      if (width<=820) expect(dimensions.panel.top).toBeLessThan(dimensions.project.top);
      await page.locator("#solve-gap").click();
      await expect(page.locator("#committed-value")).toHaveText("13");
      if(width===390) {
        await page.screenshot({path:path.join(screenshots,"atlas-solution-mobile.png"),fullPage:true});
        await page.locator("#solve-gap").click();
        await page.screenshot({path:path.join(screenshots,"atlas-understand-mobile.png"),fullPage:true});
      }
    });
  }

  test("all browser assets return success", async ({page,request}) => {
    for (const route of ["/console","/protocol-workspace.css","/app.js","/engine.mjs","/funding-view.mjs","/near-workflow.mjs","/data/evidence.json","/HACKATHON.md"]) {
      expect((await request.get(route)).ok(),route).toBeTruthy();
    }
    await page.goto("/console");
    await expect(page.locator("#scenario-count")).toHaveText("5");
  });
});
