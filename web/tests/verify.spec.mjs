import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const hash = "54ijCdCJqdQoA7s35XAaGPWXS7vHprs5RBMYaX8p3Pn";
async function fill(page) {
  await page.locator("#proof-contract").fill("pact-rc1.testnet");
  await page.locator("#proof-signer").fill("supporter.testnet");
  await page.locator("#proof-hash").fill(hash);
}

test.describe("Independent testnet evidence workspace", () => {
  test("begins without invented live evidence and links from the console", async ({ page }) => {
    await page.goto("/console");
    await page.getByRole("link", { name: /Verify a transaction/i }).click();
    await expect(page).toHaveURL(/verify/);
    await expect(page.getByRole("heading", { name: /No transaction checked/ })).toBeVisible();
    await expect(page.locator("#proof-explorer")).toBeHidden();
  });

  test("rejects malformed evidence without contacting the proof service", async ({ page }) => {
    let calls = 0;
    await page.route("**/api/verify-testnet", async route => {
      calls++;
      await route.fulfill({ json: { verified: true } });
    });
    await page.goto("/verify.html");
    await page.locator("#proof-contract").fill("not-a-testnet-address.near");
    await page.locator("#proof-signer").fill("supporter.testnet");
    await page.locator("#proof-hash").fill(hash);
    await page.locator("#proof-check").click();
    await expect(page.getByRole("heading", { name: "Not verified" })).toBeVisible();
    expect(calls).toBe(0);
  });

  test("does not claim success when RPC or code-hash verification fails", async ({ page }) => {
    await page.route("**/api/verify-testnet", route => route.fulfill({
      status: 422,
      contentType: "application/json",
      body: JSON.stringify({ verified: false, reason: "The contract code does not match." })
    }));
    await page.goto("/verify.html");
    await fill(page);
    await page.locator("#proof-check").click();
    await expect(page.getByRole("heading", { name: "Not verified" })).toBeVisible();
    await expect(page.locator("#proof-explanation")).toContainText("does not match");
    await expect(page.locator("#proof-explorer")).toBeHidden();
  });

  test("shows an explorer link only for a verified response", async ({ page }) => {
    await page.route("**/api/verify-testnet", route => route.fulfill({
      json: {
        verified: true, network: "testnet", method: "commit",
        explorerUrl: "https://testnet.nearblocks.io/txns/" + hash
      }
    }));
    await page.goto("/verify.html");
    await fill(page);
    await page.locator("#proof-check").click();
    await expect(page.getByRole("heading", { name: "Verified on NEAR testnet" })).toBeVisible();
    await expect(page.locator("#proof-explorer")).toHaveAttribute("href", /testnet\.nearblocks\.io\/txns/);
    await expect(page.locator("#proof-details")).toBeVisible();
  });

  test("remains keyboard-accessible and free of horizontal overflow on narrow devices", async ({ page }) => {
    await page.goto("/verify.html");
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 850 });
      const widthAudit = await page.evaluate(() => ({
        viewport: innerWidth, documentWidth: document.documentElement.scrollWidth
      }));
      expect(widthAudit.documentWidth, JSON.stringify(widthAudit)).toBeLessThanOrEqual(width + 1);
      await expect(page.locator("#proof-check")).toBeVisible();
    }
    const audit = await new AxeBuilder({ page }).analyze();
    expect(audit.violations.filter(x => ["critical", "serious"].includes(x.impact))).toEqual([]);
  });
});
