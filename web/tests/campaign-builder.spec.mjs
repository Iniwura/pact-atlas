import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const shots=path.join(root,"test-results","screenshots");
test.beforeAll(async()=>mkdir(shots,{recursive:true}));
test.beforeEach(async({page})=>{await page.goto("/create.html");await page.locator("#load-example").click();});

test.describe("Self-service campaign lab",()=>{
  test("the public console leads to a real custom scenario editor",async({page})=>{
    await page.goto("/console");
    await page.getByRole("link",{name:/Build your own funding plan/i}).click();
    await expect(page).toHaveURL(/create\.html$/);
    await expect(page.getByRole("heading",{name:/Build something together/i})).toBeVisible();
    await expect(page.locator("#campaign-title")).toHaveValue("Community Hub");
  });

  test("a beginner can inspect the example, add missing funding, and get a local certificate",async({page})=>{
    await expect(page.locator("#preview-committed")).toHaveText("12");
    await expect(page.locator("#preview-required")).toHaveText("13");
    await expect(page.locator('[data-project="d"]')).toHaveCount(1);
    await page.locator("#next-step").click();
    await expect(page.locator("#step-supporters")).toHaveAttribute("aria-current","step");
    await expect(page.locator(".edit-item[data-supporter]")).toHaveCount(5);
    await page.locator("#add-supporter").count(); // layout uses the same accessible Add supporter control
    await page.getByRole("button",{name:"+ Add supporter"}).click();
    const sixth=page.locator('[data-supporter="s6"]');
    await expect(sixth).toBeVisible();
    await sixth.locator("input[type=number]").fill("1");
    await sixth.locator(".rules-field").first().getByText("Training").locator("..").locator("input").uncheck();
    await sixth.locator(".rules-field").first().getByText("Events").locator("..").locator("input").check();
    await page.locator("#next-step").click();
    await expect(page.locator("#preview-status")).toHaveText("EXACT PLAN");
    await expect(page.locator("#preview-result")).toContainText("Where the money goes");
    await expect(page.locator("#preview-result")).toContainText("Supporter 5 · 2 NEAR");
    await expect(page.locator("#preview-result")).toContainText("Supporter 6 · 1 NEAR");
    await expect(page.locator("#preview-result .allocation-group")).toHaveCount(4);
    await page.screenshot({path:path.join(shots,"pact-custom-plan-funded-desktop.png"),fullPage:true});
    const downloadPromise=page.waitForEvent("download");
    await page.getByRole("button",{name:/Download scenario and verification JSON/i}).click();
    const download=await downloadPromise;
    const data=JSON.parse(await readFile(await download.path(),"utf8"));
    expect(data.network).toBe("OFFLINE-NOT-ONCHAIN");
    expect(data.result).toBe("fundable");
    expect(data.certificate.assigned).toBe(13);
    expect(data.certificate.allocations).toHaveLength(6);
  });

  test("a truly blank campaign can be authored and funded without editing source code",async({page})=>{
    await page.locator("#start-blank").click();
    await page.locator("#campaign-title").fill("Riverside Hub");
    const p1=page.locator('[data-project="p1"]');
    const p2=page.locator('[data-project="p2"]');
    await p1.locator("input[type=text]").fill("Library");
    await p1.locator("input[type=number]").fill("3");
    await p2.locator("input[type=text]").fill("Shelves");
    await p2.locator("input[type=number]").fill("2");
    await page.locator("#next-step").click();
    await expect(page.locator("#step-supporters")).toHaveAttribute("aria-current","step");
    await page.getByRole("button",{name:"+ Add supporter"}).click();
    let s1=page.locator('[data-supporter="s1"]');
    await s1.locator("input[type=text]").fill("Alex");
    await s1.locator("input[type=number]").fill("3");
    await page.getByRole("button",{name:"+ Add supporter"}).click();
    const s2=page.locator('[data-supporter="s2"]');
    await s2.locator("input[type=text]").fill("Bola");
    await s2.locator("input[type=number]").fill("2");
    await s2.locator(".rules-field").first().getByText("Library").locator("..").locator("input").uncheck();
    await s2.locator(".rules-field").first().getByText("Shelves").locator("..").locator("input").check();
    await page.locator("#next-step").click();
    await expect(page.locator("#preview-status")).toHaveText("EXACT PLAN");
    await expect(page.locator("#preview-title")).toHaveText("Riverside Hub");
    await expect(page.locator("#preview-result")).toContainText("Alex · 3 NEAR");
    await expect(page.locator("#preview-result")).toContainText("Bola · 2 NEAR");
  });

  test("prohibits invalid project goals and prevents false positive plans",async({page})=>{
    await page.locator("#start-blank").click();
    await page.locator("#campaign-title").fill("Test campaign");
    await page.locator("#next-step").click();
    await expect(page.locator("#form-errors")).toBeVisible();
    await expect(page.locator("#form-errors")).toContainText("needs a name");
    await expect(page.locator("#step-projects")).toHaveAttribute("aria-current","step");
  });

  test("a campaign with ample but unusable money still reports blocked",async({page})=>{
    await page.locator("#next-step").click();
    await page.getByRole("button",{name:"+ Add supporter"}).click();
    const row=page.locator('[data-supporter="s6"]');
    await row.locator("input[type=number]").fill("1");
    await page.locator("#next-step").click();
    await expect(page.locator("#preview-committed")).toHaveText("13");
    await expect(page.locator("#preview-status")).toHaveText("BLOCKED");
    await expect(page.locator("#preview-result")).toContainText("Events needs 3 NEAR");
    await expect(page.locator("#preview-result")).not.toContainText("Where the money goes");
  });

  test("drafts persist locally without any blockchain account",async({page})=>{
    await page.locator("#campaign-title").fill("Neighborhood Water Initiative");
    await page.reload();
    await expect(page.locator("#campaign-title")).toHaveValue("Neighborhood Water Initiative");
    await expect(page.locator("#preview-title")).toHaveText("Neighborhood Water Initiative");
  });

  test("screens remain usable on mobile and desktop",async({page})=>{
    for(const width of [320,390,768,1280]){
      await page.setViewportSize({width,height:850});
      await page.goto("/create.html");
      const size=await page.evaluate(()=>({viewport:innerWidth,content:document.documentElement.scrollWidth}));
      expect(size.content,JSON.stringify(size)).toBeLessThanOrEqual(width+1);
      await expect(page.locator("#next-step")).toBeVisible();
      await page.locator("#next-step").click();
      await expect(page.locator("#step-supporters")).toHaveAttribute("aria-current","step");
      if(width===390)await page.screenshot({path:path.join(shots,"pact-custom-plan-mobile.png"),fullPage:true});
    }
  });

  test("is accessible before and after checking a funding plan",async({page})=>{
    for(let step=0;step<3;step++){
      const report=await new AxeBuilder({page}).analyze();
      expect(report.violations.filter(v=>["serious","critical"].includes(v.impact))).toEqual([]);
      if(step<2)await page.locator("#next-step").click();
    }
  });

  test("does not produce browser errors or unwanted wallet calls",async({page})=>{
    const failures=[];
    page.on("pageerror",e=>failures.push(e.message));
    page.on("console",m=>{if(m.type()==="error")failures.push(m.text());});
    await page.evaluate(()=>{window.__walletCalls=0;window.PACT_NEAR_ADAPTER={call:()=>{window.__walletCalls++;}}});
    await page.locator("#next-step").click();
    await page.locator("#next-step").click();
    await expect(page.locator("#preview-status")).toHaveText("BLOCKED");
    expect(await page.evaluate(()=>window.__walletCalls)).toBe(0);
    expect(failures).toEqual([]);
  });
});
