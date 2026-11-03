import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Quiet protocol workspace refinement", () => {
  test("keeps the homepage design separate from the functional console", async ({page, request}) => {
    await page.goto("/");
    await expect(page.getByRole("heading",{name:/FUND THE IMPOSSIBLE/i})).toBeVisible();
    await page.goto("/console");
    await expect(page.getByRole("heading",{name:/Find the agreement/i})).toBeVisible();
    await expect(page.locator("#network-map")).toBeVisible();
    await expect(page.locator("#engine-result")).toContainText("viable");
    await expect(page.locator("#wallet-status")).toContainText("Read-only evidence mode");
    await expect(page.locator("#scenario-count")).toHaveText("5");
    expect((await request.get("/console-refined.css")).ok()).toBe(true);
    await page.screenshot({path:"test-results/console-refined-desktop.png",fullPage:true});
  });

  test("keeps exact model outcomes and blocks unsigned transactions", async ({page}) => {
    await page.goto("/console");
    await page.selectOption("#coalition-select","abcd");
    await expect(page.locator("#engine-result")).toContainText("blocked");
    await page.check("#topup-toggle");
    await expect(page.locator("#engine-result")).toContainText("viable");
    await expect(page.locator("#engine-result")).toContainText("exact result");
    await page.locator("[data-action='activate']").click();
    await expect(page.locator("#toast")).toContainText("not submitted");
    await page.locator("[data-project='d']").click();
    await expect(page.locator("#project-inspector")).toContainText("Events");
  });

  for (const width of [320,390,768,1440]) {
    test("has no horizontal overflow at "+width+"px",async({page})=>{
      await page.setViewportSize({width,height:850});
      await page.goto("/console");
      await expect(page.getByRole("heading",{name:/Find the agreement/i})).toBeVisible();
      await expect(page.locator("#coalition-select")).toBeAttached();
      const dimension=await page.evaluate(()=>({viewport:innerWidth,html:document.documentElement.scrollWidth}));
      expect(dimension.html,JSON.stringify(dimension)).toBeLessThanOrEqual(dimension.viewport+1);
      if(width===390)await page.screenshot({path:"test-results/console-refined-mobile.png",fullPage:true});
    });
  }

  test("maintains accessible focus, controls and readable contrast",async({page})=>{
    await page.goto("/console");
    const a=await new AxeBuilder({page}).analyze();
    expect(a.violations.filter(v=>["serious","critical"].includes(v.impact))).toEqual([]);
  });

  test("has no Javascript or missing-resource errors",async({page})=>{
    const errors=[];
    page.on("pageerror",err=>errors.push(err.message));
    page.on("console",msg=>{if(msg.type()==="error")errors.push(msg.text());});
    await page.goto("/console");
    await expect(page.locator("#scenario-count")).toHaveText("5");
    expect(errors).toEqual([]);
  });
});
