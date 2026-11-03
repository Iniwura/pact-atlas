import {test,expect} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Protocol Studio design integration",()=>{
  test("matches the editorial homepage but retains an authentic read-only protocol",async({page})=>{
    await page.goto("/console");
    await expect(page.getByRole("heading",{name:/MAKE THE.*CONNECTION/i})).toBeVisible();
    await expect(page.locator(".console-map-stage #network-map")).toBeVisible();
    await expect(page.locator(".console-decision-grid #engine-result")).toContainText("viable");
    await expect(page.locator(".console-commitment-grid .commitment-row")).toHaveCount(5);
    await expect(page.locator(".workflow-step")).toHaveCount(5);
    await expect(page.locator("#wallet-status")).toContainText("Read-only evidence mode");
    await expect(page.locator("#scenario-count")).toHaveText("5");
    await page.screenshot({path:"test-results/pact-protocol-desktop.png",fullPage:true});
  });

  test("keeps node selection, constraint violation and exact top-up responsive",async({page})=>{
    await page.goto("/console");
    await page.locator(".map-node[data-project='d']").click();
    await expect(page.locator("#project-inspector")).toContainText("Events");
    await expect(page.locator("#map-selection-name")).toContainText("D / Events");
    await expect(page.locator("#map-selection-detail")).toContainText("3N required");
    await page.selectOption("#coalition-select","abcd");
    await expect(page.locator("#engine-result")).toContainText("blocked");
    await page.check("#topup-toggle");
    await expect(page.locator("#engine-result")).toContainText("viable");
    await expect(page.locator("#engine-result")).toContainText("exact result");
    await expect(page.locator("#map-scenario")).toContainText("+1N");
    await expect(page.locator("body")).toHaveAttribute("data-simulated-d","fundable");
    await page.selectOption("#condition-select","donor5");
    await expect(page.locator("#engine-result")).toContainText("model-only change");
    await page.click("[data-action='activate']");
    await expect(page.locator("#workflow-result")).toContainText("not submitted");
  });

  for(const width of [320,390,768,1440]){
    test("maintains usable composition without document overflow at "+width+"px",async({page})=>{
      await page.setViewportSize({width,height:860});
      await page.goto("/console");
      await expect(page.locator("#hero-title")).toBeVisible();
      await expect(page.locator("#coalition-select")).toBeAttached();
      await expect(page.locator("#evidence-select")).toHaveCount(1);
      const dimensions=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}));
      expect(dimensions.scroll,JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.viewport+1);
      if(width===390)await page.screenshot({path:"test-results/pact-protocol-mobile.png",fullPage:true});
    });
  }

  test("routes to the actual evidence, with no fake confirmations",async({page,request})=>{
    await page.goto("/console");
    const data=await request.get("/data/evidence.json");
    expect(data.ok()).toBe(true);
    await page.locator("#evidence-select").selectOption("4");
    await expect(page.locator("#receipt-list")).toContainText("PACT funded");
    await expect(page.locator("#receipt-list")).toContainText("liabilities");
    await page.getByRole("button",{name:/Connect wallet/i}).click();
    await expect(page.locator("#toast")).toContainText("Read-only evidence mode");
    const css=await request.get("/console-studio.css");
    expect(css.ok()).toBe(true);
    expect(await css.text()).toContain("console-decision-grid");
  });

  test("has no serious or critical accessibility findings in protocol studio",async({page})=>{
    await page.goto("/console");
    const report=await new AxeBuilder({page}).analyze();
    expect(report.violations.filter(v=>["critical","serious"].includes(v.impact))).toEqual([]);
  });

  test("does not emit browser errors",async({page})=>{
    const errors=[];
    page.on("pageerror",e=>errors.push(e.message));
    page.on("console",m=>{if(m.type()==="error")errors.push(m.text());});
    await page.goto("/console");
    await expect(page.locator("#scenario-count")).toHaveText("5");
    expect(errors).toEqual([]);
  });
});
