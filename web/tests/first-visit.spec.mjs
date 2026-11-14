import { test, expect } from "@playwright/test";

test.describe("first-visit guide and full landing continuity", () => {
  test("shows four optional steps, allows skip and replay without sending money", async ({page}) => {
    await page.addInitScript(() => localStorage.removeItem("pact-atlas-console-tour-v1"));
    await page.route("**/rpc.testnet.fastnear.com/**", route => route.abort());
    await page.route("**/rpc.testnet.near.org/**", route => route.abort());
    await page.goto("/console");
    const guide = page.locator("#pact-tour-panel");
    await expect(guide).toBeVisible();
    await expect(guide).toContainText("Find a campaign.");
    await expect(page.locator("#campaigns")).toHaveClass(/pact-tour-focus/);
    await page.locator("#pact-tour-next").click();
    await expect(guide).toContainText("Understand the condition.");
    await page.locator("#pact-tour-next").click();
    await expect(guide).toContainText("Create an agreement.");
    await page.locator("#pact-tour-next").click();
    await expect(guide).toContainText("Check every receipt.");
    await page.locator("#pact-tour-next").click();
    await expect(guide).toBeHidden();
    await page.reload();
    await expect(guide).toBeHidden();
    await page.locator("#pact-tour-open").click();
    await expect(guide).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(guide).toBeHidden();
    await expect(page.locator(".pact-tour-focus")).toHaveCount(0);
  });

  test("maintains editorial bridge and proof links on mobile", async ({page}) => {
    await page.setViewportSize({width:390,height:844});
    await page.goto("/");
    await expect(page.locator("#bridge-title")).toBeVisible();
    await expect(page.locator(".editorial-bridge a[href='#real-proof']")).toHaveCount(1);
    await expect(page.locator(".editorial-bridge a[href='#atlas']")).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });
});
