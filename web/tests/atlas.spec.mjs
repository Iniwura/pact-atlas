import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const screenshots = path.join(root, "test-results", "screenshots");
test.beforeAll(async () => { await mkdir(screenshots, { recursive: true }); });

async function noExternalRpc(page) {
  await page.route("**/rpc.testnet.fastnear.com/**", route => route.abort());
  await page.route("**/rpc.testnet.near.org/**", route => route.abort());
}

test.describe("PACT Atlas / real funding workspace", () => {
  test("has a coherent consumer entry, with no fictional funding demonstration", async ({ page }) => {
    await noExternalRpc(page);
    await page.goto("/console");
    await expect(page.getByRole("heading", { name: "Funding. Together." })).toBeVisible();
    await expect(page.locator("#campaign-list .campaign-tile")).toHaveCount(2);
    await expect(page.locator("#metric-campaigns")).toHaveText("02");
    await expect(page.locator("#metric-funded")).toHaveText("2");
    await expect(page.locator("#metric-refunded")).toHaveText("1");
    await expect(page.locator(".feature-story")).toContainText("Beta can receive funding only when Alpha is funded");
    await expect(page.getByRole("link", { name: /Create campaign/i }).last()).toHaveAttribute("href", "./create.html");
    await expect(page.locator("#activity-list .activity-entry")).toHaveCount(8);
    await expect(page.locator("body")).not.toContainText("Simulate +1 NEAR");
    await expect(page.locator("body")).not.toContainText("Five fictional supporters");
    await expect(page.locator("body")).not.toContainText("INTERACTIVE EXAMPLE");
  });

  test("every real campaign opens a correctly encoded immutable onchain reader", async ({ page }) => {
    await noExternalRpc(page);
    await page.goto("/console");
    await expect(page.locator(".campaign-tile")).toHaveCount(2);
    for (const id of ["coalition", "refund"]) {
      const tile = page.locator(".campaign-tile").nth(id === "coalition" ? 0 : 1);
      const href = await tile.getByRole("link", { name: /Open campaign/i }).getAttribute("href");
      const url = new URL(href, "http://localhost");
      expect(url.pathname).toBe("/campaign");
      expect(url.searchParams.get("contract")).toContain(id === "coalition" ? "coalition-20261110" : "refund-20261110");
      expect(url.searchParams.get("config")?.length).toBeGreaterThan(100);
    }
    await expect(page.locator("#featured-open")).toHaveAttribute("href", /\/campaign\?contract=coalition-20261110/);
  });

  test("filters genuine campaign states without mixing funded and expired", async ({ page }) => {
    await noExternalRpc(page);
    await page.goto("/console");
    await expect(page.locator(".campaign-tile")).toHaveCount(2);
    await page.getByRole("button", { name: "Funded" }).click();
    await expect(page.locator(".campaign-tile")).toHaveCount(1);
    await expect(page.locator(".campaign-tile")).toContainText("Conditional coalition");
    await page.getByRole("button", { name: "Expired" }).click();
    await expect(page.locator(".campaign-tile")).toHaveCount(1);
    await expect(page.locator(".campaign-tile")).toContainText("Expired campaign");
    await page.getByRole("button", { name: "All", exact: true }).first().click();
    await expect(page.locator(".campaign-tile")).toHaveCount(2);
  });

  test("lists every original transaction receipt with useful filtering", async ({ page }) => {
    await noExternalRpc(page);
    await page.goto("/console#activity");
    await expect(page.locator(".activity-entry")).toHaveCount(8);
    await expect(page.locator("#activity-list")).toContainText("Alpha payout");
    await expect(page.locator("#activity-list")).toContainText("Beta payout");
    await expect(page.locator("#activity-list")).toContainText("Contribution refunded");
    const links = page.locator(".activity-entry a");
    expect(await links.count()).toBe(8);
    for (let i = 0; i < 8; i++) {
      await expect(links.nth(i)).toHaveAttribute("href", /^https:\/\/testnet\.nearblocks\.io\/txns\//);
      await expect(links.nth(i)).toHaveAttribute("rel", "noopener noreferrer");
    }
    await page.getByRole("button", { name: "Payouts" }).click();
    await expect(page.locator(".activity-entry")).toHaveCount(2);
    await page.getByRole("button", { name: "Funding", exact: true }).last().click();
    await expect(page.locator(".activity-entry")).toHaveCount(3);
  });

  test("keeps historical receipts visible while both live RPC providers fail", async ({ page }) => {
    await noExternalRpc(page);
    await page.goto("/console");
    await expect(page.locator(".campaign-tile")).toHaveCount(2);
    await expect(page.locator(".tile-rpc").first()).toContainText("Live RPC unavailable");
    await expect(page.locator("#activity-list")).toContainText("Contribution refunded");
    await expect(page.locator("#activity-note")).toContainText("not a live transaction feed");
    await expect(page.locator(".status-chip").first()).toHaveAttribute("data-live", "unavailable");
  });

  test("only calls a real testnet wallet on explicit user action", async ({ page }) => {
    await noExternalRpc(page);
    await page.addInitScript(() => { window.PACT_DISABLE_WALLET_SELECTOR = true; });
    await page.goto("/console");
    await expect(page.locator("#wallet-message")).toBeHidden();
    await page.getByRole("button", { name: /Connect wallet/i }).click();
    await expect(page.locator("#wallet-message")).toContainText("Wallet connection wasn't completed");
    await expect(page.locator("#wallet-message")).not.toContainText("Transaction confirmed");
    await expect(page.locator("#connect-wallet")).toBeEnabled();
  });

  for (const width of [320, 360, 390, 768, 1024, 1440]) {
    test("has no horizontal overflow and keeps campaign actions reachable at " + width + "px", async ({ page }) => {
      await noExternalRpc(page);
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/console");
      await expect(page.locator(".campaign-tile")).toHaveCount(2);
      const dimensions = await page.evaluate(() => ({
        viewport: window.innerWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      expect(dimensions.scroll, JSON.stringify(dimensions)).toBeLessThanOrEqual(width + 1);
      await expect(page.locator("#featured-open")).toBeVisible();
      await expect(page.getByRole("link", { name: /Create campaign/i }).last()).toBeVisible();
      if (width === 1440 || width === 390) {
        await page.screenshot({ path: path.join(screenshots, "pact-product-" + width + ".png"), fullPage: true });
      }
    });
  }

  test("has no critical or serious accessibility violations in the app shell", async ({ page }) => {
    await noExternalRpc(page);
    await page.goto("/console");
    await expect(page.locator(".campaign-tile")).toHaveCount(2);
    const audit = await new AxeBuilder({ page }).analyze();
    expect(audit.violations.filter(violation => ["critical", "serious"].includes(violation.impact))).toEqual([]);
  });

  test("navigates to actual creator and verification routes", async ({ page }) => {
    await noExternalRpc(page);
    await page.goto("/console");
    await page.getByRole("link", { name: /New campaign/i }).click();
    await expect(page).toHaveURL(/create\.html$/);
    await expect(page.getByRole("heading", { name: /Create a campaign/i })).toBeVisible();
    await page.goto("/console");
    await page.getByRole("link", { name: /Verify a transaction/i }).click();
    await expect(page).toHaveURL(/verify\.html$/);
  });
});
