import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const screenshots = path.join(root, "test-results", "screenshots");
test.beforeAll(async () => { await mkdir(screenshots, { recursive: true }); });
test.beforeEach(async ({ page }) => {
  await page.goto("/create.html");
  await page.locator("#start-blank").click();
});

async function buildFundablePlan(page) {
  await page.locator("#campaign-title").fill("Community garden");
  const project = page.locator('[data-project="p1"]');
  await project.getByPlaceholder("e.g. Community Wi-Fi").fill("Garden equipment");
  await project.locator("input[type=number]").fill("2");
  await project.getByPlaceholder("e.g. project.testnet").fill("beneficiary.testnet");
  await page.locator("#next-step").click();
  await expect(page.locator("#step-supporters")).toHaveAttribute("aria-current", "step");
  await page.getByRole("button", { name: "+ Add supporter" }).click();
  const supporter = page.locator('[data-supporter="s1"]');
  await supporter.locator("input[type=text]").fill("Alex");
  await supporter.locator("input[type=number]").fill("2");
  await page.locator("#next-step").click();
}

test.describe("PACT Atlas / campaign creation", () => {
  test("opens as a genuine blank draft rather than a prefilled demonstration", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Create a campaign/i })).toBeVisible();
    await expect(page.locator("#campaign-title")).toHaveValue("");
    await expect(page.locator(".edit-item[data-project]")).toHaveCount(1);
    await expect(page.locator("#preview-committed")).toHaveText("0");
    await expect(page.locator("#preview-required")).toHaveText("1");
    await expect(page.locator("#load-example")).toHaveCount(0);
  });

  test("opens from consumer dashboard without exposing artificial campaigns", async ({ page }) => {
    await page.goto("/console");
    await page.getByRole("link", { name: "Create campaign", exact: true }).first().click();
    await expect(page).toHaveURL(/create\.html$/);
    await expect(page.locator("#campaign-title")).toHaveValue("");
  });

  test("allows a client to create a valid one-project plan and export a genuine offline certificate", async ({ page }) => {
    await buildFundablePlan(page);
    await expect(page.locator("#preview-status")).toHaveText("EXACT PLAN");
    await expect(page.locator("#preview-title")).toHaveText("Community garden");
    await expect(page.locator("#preview-result")).toContainText("Garden equipment");
    await expect(page.locator("#preview-result")).toContainText("Alex · 2 NEAR");
    await expect(page.locator("#deploy-campaign")).toBeVisible();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Export funding plan/i }).click();
    const download = await downloadPromise;
    const data = JSON.parse(await readFile(await download.path(), "utf8"));
    expect(data.network).toBe("OFFLINE-NOT-ONCHAIN");
    expect(data.result).toBe("fundable");
    expect(data.certificate.assigned).toBe(2);
    await page.screenshot({ path: path.join(screenshots, "pact-create-client-plan.png"), fullPage: true });
  });

  test("stops a campaign that has no named project", async ({ page }) => {
    await page.locator("#campaign-title").fill("Community garden");
    await page.locator("#next-step").click();
    await expect(page.locator("#form-errors")).toBeVisible();
    await expect(page.locator("#form-errors")).toContainText("needs a name");
    await expect(page.locator("#step-projects")).toHaveAttribute("aria-current", "step");
  });

  test("can add another project with a dependency", async ({ page }) => {
    await page.locator("#campaign-title").fill("Connected communities");
    await page.getByRole("button", { name: "+ Add project" }).click();
    await expect(page.locator(".edit-item[data-project]")).toHaveCount(2);
    const alpha = page.locator('[data-project="p1"]');
    const beta = page.locator('[data-project="p2"]');
    await alpha.getByPlaceholder("e.g. Community Wi-Fi").fill("Alpha");
    await beta.getByPlaceholder("e.g. Community Wi-Fi").fill("Beta");
    await beta.locator(".rules-field").getByText("Alpha").locator("..").locator("input").check();
    await expect(beta.locator(".rules-field input:checked")).toHaveCount(1);
    await page.locator("#next-step").click();
    await expect(page.locator("#step-supporters")).toHaveAttribute("aria-current", "step");
  });

  test("keeps deployment fail-closed without a real authorized wallet", async ({ page }) => {
    await page.evaluate(() => { window.PACT_DISABLE_WALLET_SELECTOR = true; });
    await buildFundablePlan(page);
    await page.locator("#deploy-campaign").click();
    await expect(page.locator("#chain-result")).toContainText("Read-only mode is enabled");
    await expect(page.locator("#chain-result")).not.toContainText("LIVE TESTNET CAMPAIGN");
  });

  test("saves an unfinished draft locally without publishing it", async ({ page }) => {
    await page.locator("#campaign-title").fill("Neighborhood water");
    await page.locator('[data-project="p1"]').getByPlaceholder("e.g. Community Wi-Fi").fill("Well");
    await page.reload();
    await expect(page.locator("#campaign-title")).toHaveValue("Neighborhood water");
    await expect(page.locator('[data-project="p1"]').getByPlaceholder("e.g. Community Wi-Fi")).toHaveValue("Well");
    await expect(page.locator("#preview-status")).toContainText("Editing");
  });

  for (const width of [320, 390, 768, 1280]) {
    test("is responsive at " + width + "px", async ({ page }) => {
      await page.setViewportSize({ width, height: 850 });
      await page.goto("/create.html");
      await expect(page.locator("#next-step")).toBeVisible();
      const size = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
      expect(size.scroll, JSON.stringify(size)).toBeLessThanOrEqual(width + 1);
      if (width === 390) await page.screenshot({ path: path.join(screenshots, "pact-create-mobile.png"), fullPage: true });
    });
  }

  test("is accessible before and after reviewing a plan", async ({ page }) => {
    const first = await new AxeBuilder({ page }).analyze();
    expect(first.violations.filter(v => ["serious", "critical"].includes(v.impact))).toEqual([]);
    await buildFundablePlan(page);
    const final = await new AxeBuilder({ page }).analyze();
    expect(final.violations.filter(v => ["serious", "critical"].includes(v.impact))).toEqual([]);
  });
});
