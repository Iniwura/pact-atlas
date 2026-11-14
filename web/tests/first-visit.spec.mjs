import { test, expect } from "@playwright/test";

test.describe("PACT product first visit", () => {
  test.beforeEach(async ({page}) => {
    await page.route("**/rpc.testnet.fastnear.com/**", route => route.abort());
    await page.route("**/rpc.testnet.near.org/**", route => route.abort());
  });

  test("offers a real choice, spotlights controls, and remembers exit",async({page})=>{
    await page.goto("/console");
    await page.evaluate(() => localStorage.removeItem("pact-atlas-field-guide-v2"));
    await page.reload();
    const panel=page.locator("#pact-tour-panel");
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("button",{name:"Explore a campaign"})).toBeVisible();
    await expect(panel.getByRole("button",{name:"Create an agreement"})).toBeVisible();
    await panel.getByRole("button",{name:"Explore a campaign"}).click();
    await expect(page.locator("#pact-tour-step-title")).toHaveText("See what's being funded.");
    await expect(page.locator("#campaigns")).toHaveClass(/pact-tour-focus/);
    await page.locator("#pact-tour-visit").click();
    await expect(page.locator("#campaigns")).toHaveClass(/pact-tour-target-live/);
    await page.locator("#pact-tour-next").click();
    await expect(page.locator("#pact-tour-step-title")).toHaveText("Follow the dependency.");
    await page.locator("#pact-tour-next").click();
    await expect(page.locator("#pact-tour-step-title")).toHaveText("Open an agreement safely.");
    await page.locator("#pact-tour-next").click();
    await expect(page.locator("#pact-tour-step-title")).toHaveText("Check the result.");
    await page.locator("#pact-tour-next").click();
    await expect(panel).toBeHidden();
    await page.reload();
    await expect(panel).toBeHidden();
    await page.locator("#pact-tour-open").click();
    await expect(panel).toBeVisible();
    await panel.getByRole("button",{name:"Create an agreement"}).click();
    await expect(page.locator("#pact-tour-step-title")).toHaveText("Start with the projects.");
    await expect(page.locator(".entryway[href='./create.html']")).toHaveClass(/pact-tour-focus/);
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(page.locator(".pact-tour-focus")).toHaveCount(0);
  });

  test("preserves the editorial story, product paths and responsive width",async({page})=>{
    for(const width of [320,390,768,1280]){
      await page.setViewportSize({width,height:860});
      await page.goto("/");
      await expect(page.locator("#mechanism-heading")).toBeVisible();
      await expect(page.locator(".sequence-scene")).toHaveCount(3);
      await expect(page.locator(".pact-next-paths a")).toHaveCount(3);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
      await page.goto("/console");
      await expect(page.locator(".pact-entryways a")).toHaveCount(3);
      await expect(page.locator("#pact-tour-panel")).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    }
  });

  test("loads all real product routes without hiding controls",async({page})=>{
    await page.goto("/create.html");
    await expect(page.locator("#campaign-title")).toBeVisible();
    await expect(page.locator("#next-step")).toBeVisible();
    await page.goto("/verify.html");
    await expect(page.locator("#proof-form")).toBeVisible();
    await expect(page.locator("#proof-result")).toBeVisible();
    await page.goto("/campaign.html");
    await expect(page.locator("#campaign-main")).toBeVisible();
  });
});
