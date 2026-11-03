import { test, expect } from "@playwright/test";

test.describe("Lurais-inspired editorial integration", () => {
  test("introduces the premise without hiding the functioning Atlas", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Fund the impossible/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Money exists.*The agreement.*doesn't/i })).toBeVisible();
    await expect(page.locator("#network-map")).toBeAttached();
    await expect(page.locator("#engine-result")).toContainText("viable");
    await expect(page.locator("#wallet-status")).toContainText("Read-only");
    await expect(page.locator("#scenario-count")).toHaveText("5");
  });

  test("does not lose the funding constraint when using the new editorial navigation", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Explore the Atlas/i }).click();
    await expect(page).toHaveURL(/#counterfactual$/);
    await page.selectOption("#coalition-select", "abcd");
    await expect(page.locator("#engine-result")).toContainText("blocked");
    await page.check("#topup-toggle");
    await expect(page.locator("#engine-result")).toContainText("viable");
    await expect(page.locator("#engine-result")).toContainText("exact result");
  });

  test("keeps navigation and solver controls reachable on a narrow phone", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 760 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Fund the impossible/i })).toBeVisible();
    await expect(page.locator("#counterfactual")).toBeAttached();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.getByRole("link", { name: /Explore the Atlas/i }).click();
    await expect(page.locator("#coalition-select")).toBeVisible();
    await page.screenshot({ path: "test-results/lurais-editorial-mobile.png", fullPage: true });
  });
});
