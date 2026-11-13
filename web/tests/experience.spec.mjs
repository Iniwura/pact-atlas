import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("PACT / cinematic public-evidence story", () => {
  test("preserves original orbital art and an immediate real-campaign route", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#hero-title")).toContainText("FUND THE");
    await expect(page.locator(".hero-art img")).toHaveAttribute("src", "/orbital-art.svg");
    await expect(page.locator(".hero-link")).toHaveAttribute("href", "/console#campaigns");
    await expect(page.locator("#real-proof")).toBeVisible();
    await expect(page.locator("#real-proof")).toContainText("HISTORICAL");
  });

  test("the three stages surface only original public-chain receipt links", async ({ page }) => {
    await page.goto("/");
    const stage = page.locator("#real-proof");
    const link = page.locator("#evidence-current-link");
    await expect(stage).toHaveAttribute("data-stage", "pledges");
    await expect(link).toHaveAttribute("href", /39QG8aueJBWZEcJY/);
    await page.getByRole("button", { name: /02 Conditions are satisfied/ }).click();
    await expect(stage).toHaveAttribute("data-stage", "conditions");
    await expect(link).toHaveAttribute("href", /31FxH2YE9FEm7iq49AH/);
    await expect(page.locator("#evidence-current-title")).toContainText("allocation");
    await page.getByRole("button", { name: /03 Both projects get paid/ }).click();
    await expect(stage).toHaveAttribute("data-stage", "settled");
    await expect(link).toHaveAttribute("href", /GuUpGeBNaygqoaepXPrmxb/);
    await expect(stage).toContainText("zero liabilities");
    await expect(page.getByRole("button", { name: /03 Both projects get paid/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: /01 Commitments arrive/ })).toHaveAttribute("aria-pressed", "false");
  });

  test("no fake live payments and testnet limitations remain visible", async ({ page }) => {
    await page.goto("/#real-proof");
    const section=page.locator("#real-proof");
    await expect(section).toContainText("Faucet-funded NEAR testnet evidence");
    await expect(section).toContainText("unverified");
    await expect(section).toContainText("0 NEAR");
    await expect(section.getByRole("link", { name: /Open the contract/ })).toHaveAttribute("href", /testnet\.nearblocks\.io\/address\/coalition-/);
  });

  for(const width of [320, 390, 768, 1024, 1440]){
    test("editorial stages fit "+width+"px without overflow", async ({ page }) => {
      await page.setViewportSize({width,height:850});
      await page.goto("/");
      await expect(page.locator("#hero-title")).toBeVisible();
      await expect(page.locator("#evidence-heading")).toBeVisible();
      const sizes=await page.evaluate(()=>({
        full:document.documentElement.scrollWidth,
        viewport:innerWidth,
        hero:document.querySelector(".hero").getBoundingClientRect().width
      }));
      expect(sizes.full).toBeLessThanOrEqual(width+1);
      expect(sizes.hero).toBeLessThanOrEqual(width+1);
    });
  }

  test("story supports keyboard and reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const select = page.locator('[data-evidence-step="conditions"]');
    await select.focus();
    await page.keyboard.press("Enter");
    await expect(select).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#evidence-announcement")).toContainText("recorded testnet evidence");
    await expect(page.locator(".hero-art")).toHaveCSS("animation-name", "none");
  });

  test("passes critical and serious accessibility audit", async ({ page }) => {
    await page.goto("/");
    const report=await new AxeBuilder({page}).analyze();
    expect(report.violations.filter(v=>["serious","critical"].includes(v.impact))).toEqual([]);
  });
});
