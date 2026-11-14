import {test,expect} from "@playwright/test";
const widths=[320,390,768,1024,1440];
test.describe("cinematic PACT visual integrity",()=>{
  for(const width of widths){
    test("landing and funding model remain legible at "+width+"px",async({page})=>{
      await page.setViewportSize({width,height:900});
      await page.goto("/");
      await expect(page.locator(".hero-side")).toHaveCount(0);
      await expect(page.locator(".hero-edition")).toHaveCount(0);
      await expect(page.locator(".evidence-project")).toHaveCount(2);
      const state=await page.evaluate(()=>{
        const rect=s=>document.querySelector(s).getBoundingClientRect();
        const title=rect("#hero-title"),cta=rect(".hero-bottom");
        const inspector=document.querySelector(".inspector"),head=document.querySelector("#inspector-heading");
        const range=document.createRange();range.selectNodeContents(head);
        const text=range.getBoundingClientRect(),box=head.getBoundingClientRect();
        return {
          scroll:document.documentElement.scrollWidth,
          heroOverlap:cta.top<title.bottom-1,
          titleOverflow:Math.max(0,text.right-box.right),
          nodeDecor:getComputedStyle(document.querySelector(".graph-stage"),"::before").backgroundImage,
          certificateWatermark:getComputedStyle(document.querySelector(".certificate"),"::after").content,
          inspectorOverflow:inspector.scrollWidth-inspector.clientWidth
        };
      });
      expect(state.scroll).toBeLessThanOrEqual(width+1);
      expect(state.heroOverlap).toBe(false);
      expect(state.titleOverflow).toBeLessThanOrEqual(1);
      expect(state.inspectorOverflow).toBeLessThanOrEqual(1);
      expect(state.nodeDecor).not.toContain("linear-gradient(rgba");
      expect(state.certificateWatermark).toBe("none");
      if(width<=650)await expect(page.locator(".graph-lines")).toBeHidden();
      for(const id of ["a","b","c","d"]){
        await page.locator('.graph-node[data-project="'+id+'"]').click();
        const overflow=await page.evaluate(()=>{
          const el=document.querySelector("#inspector-heading"),range=document.createRange();
          range.selectNodeContents(el);return range.getBoundingClientRect().right-el.getBoundingClientRect().right;
        });
        expect(overflow).toBeLessThanOrEqual(1);
      }
      await page.locator('.graph-node[data-project="d"]').click();
      await page.locator("#topup-button").click();
      await expect(page.locator("#funded-count")).toContainText("4");
      await expect(page.locator("#cert-count")).toContainText("04 / 04");
    });
  }
  test("receipt-linked graphic respects the actual transaction order",async({page})=>{
    await page.goto("/");
    await expect(page.locator(".evidence-project.alpha .evidence-amount")).toContainText("AWAITING");
    await expect(page.locator(".evidence-project.beta .evidence-amount")).toContainText("PLEDGED");
    await page.locator('[data-evidence-step="conditions"]').click();
    await expect(page.locator(".evidence-project.alpha .evidence-amount")).toContainText("FUNDED");
    await expect(page.locator("#evidence-current-link")).toHaveAttribute("href",/31FxH2YE9FEm7iq49AH6eXMvZYiFv7Y3jeqd8rThK96v/);
    await page.locator('[data-evidence-step="settled"]').click();
    await expect(page.locator(".evidence-project.beta .evidence-amount")).toContainText("PAID");
    await expect(page.locator("#evidence-current-link")).toHaveAttribute("href",/GuUpGeBNaygqoaepXPrmxbWgEzexoXgyxxFDZ617E9FX/);
  });
  test("console keeps real campaign actions usable",async({page})=>{
    await page.goto("/console");
    await expect(page.getByRole("link",{name:"Create campaign"})).toBeVisible();
    await expect(page.locator("#campaigns")).toBeVisible();
    await expect(page.locator(".desk-proof")).toContainText("Projects funded");
    await expect(page.locator(".campaign-tile").first()).toBeVisible();
  });
});

