import {test,expect} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Atlas product workspace",()=>{
  test("is a light, focused funding workspace, not another marketing hero",async({page,request})=>{
    await page.goto("/console");
    await expect(page.getByRole("heading",{name:"Atlas."})).toBeVisible();
    await expect(page.getByRole("heading",{name:"Scenario"})).toBeVisible();
    await expect(page.locator("#network-map")).toBeVisible();
    await expect(page.locator("#engine-result")).toContainText("viable");
    await expect(page.locator("#commitment-list .commitment-row")).toHaveCount(5);
    await expect(page.locator("#scenario-count")).toHaveText("5");
    await expect(page.locator("#wallet-status")).toContainText("Read-only evidence mode");
    expect(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor)).toBe("rgb(245, 245, 241)");
    expect((await request.get("/workspace.css")).ok()).toBeTruthy();
    await page.screenshot({path:"test-results/atlas-workspace-desktop.png",fullPage:true});
  });

  test("uses the original exact funding evaluation and refuses unsigned activation",async({page})=>{
    await page.goto("/console");
    await page.selectOption("#coalition-select","abcd");
    await expect(page.locator("#engine-result")).toContainText("blocked");
    await page.check("#topup-toggle");
    await expect(page.locator("#engine-result")).toContainText("viable");
    await expect(page.locator("#engine-result")).toContainText("exact result");
    await page.click("[data-action='activate']");
    await expect(page.locator("#toast")).toContainText("not submitted");
    await page.locator("[data-project='d']").click();
    await expect(page.locator("#project-inspector")).toContainText("Events");
  });

  test("can inspect pledges and local evidence without a wallet",async({page})=>{
    await page.goto("/console");
    await page.locator(".commitment-row").nth(2).click();
    await expect(page.locator("#project-inspector")).toContainText("Commitment");
    await page.selectOption("#evidence-select","4");
    await expect(page.locator("#receipt-list")).toContainText("liabilities");
    await page.click("#connect-wallet");
    await expect(page.locator("#toast")).toContainText("Read-only evidence mode");
  });

  for(const width of [320,390,768,1024,1440]){
    test("fits without horizontal scrolling at "+width+"px",async({page})=>{
      await page.setViewportSize({width,height:850});
      await page.goto("/console");
      await expect(page.getByRole("heading",{name:"Atlas."})).toBeVisible();
      const dims=await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth}));
      expect(dims.width,JSON.stringify(dims)).toBeLessThanOrEqual(dims.viewport+1);
      await expect(page.locator("#topup-toggle")).toBeAttached();
      if(width===390){
        const order=await page.evaluate(()=>({
          map:document.querySelector(".map-workspace").getBoundingClientRect().top,
          scenario:document.querySelector(".workspace-sidebar").getBoundingClientRect().top
        }));
        expect(order.map).toBeLessThan(order.scenario);
        await page.screenshot({path:"test-results/atlas-workspace-mobile.png",fullPage:true});
      }
    });
  }

  test("has no serious or critical accessibility issues",async({page})=>{
    await page.goto("/console");
    const report=await new AxeBuilder({page}).analyze();
    expect(report.violations.filter(v=>["critical","serious"].includes(v.impact))).toEqual([]);
  });

  test("has no script or resource errors",async({page})=>{
    const errors=[];
    page.on("pageerror",error=>errors.push(error.message));
    page.on("console",message=>{if(message.type()==="error")errors.push(message.text());});
    await page.goto("/console");
    await expect(page.locator("#scenario-count")).toHaveText("5");
    expect(errors).toEqual([]);
  });
});
