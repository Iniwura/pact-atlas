import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Art-directed Atlas homepage", () => {
  test("has the original cinematic composition and direct access to the protocol", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/PACT Atlas/);
    await expect(page.locator("#hero-title")).toContainText("FUND THE");
    await expect(page.locator("#hero-title")).toContainText("IMPOSSIBLE");
    await expect(page.locator(".hero-art img")).toBeVisible();
    await expect(page.locator("#intro-heading")).toContainText("AGREEMENT");
    await expect(page.getByRole("link", { name: /Open Protocol/i }).first()).toHaveAttribute("href","/console");
    await expect(page.locator("#network-mode")).toContainText("12N");
    await expect(page.locator("#cert-total")).toContainText("10");
    await page.screenshot({path:"test-results/pact-studio-desktop.png",fullPage:true});
  });

  test("keeps the approved cinematic hero unchanged", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#hero-title")).toContainText("FUND THE");
    await expect(page.locator("#hero-title")).toContainText("IMPOSSIBLE");
    await expect(page.locator(".hero-art img")).toHaveAttribute("width", "1600");
    await expect(page.locator(".hero-art img")).toHaveAttribute("height", "1040");
    await expect(page.locator(".hero-art img")).toHaveAttribute("fetchpriority", "high");
    await expect(page.getByRole("heading", { name: /MONEY.*EXISTS/i })).toBeAttached();
  });

  test("mobile navigation closes with Escape, outside click, and returns focus", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const toggle=page.locator("#menu-toggle");
    const nav=page.locator("#mobile-menu");
    await expect(nav).toBeHidden();
    await toggle.click();
    await expect(nav).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(toggle).toHaveAttribute("aria-label", "Close menu");
    await page.keyboard.press("Escape");
    await expect(nav).toBeHidden();
    await expect(toggle).toBeFocused();
    await toggle.click();
    await page.locator("#hero-title").click({ position: { x: 10, y: 10 }, force: true });
    await expect(nav).toBeHidden();
    await toggle.click();
    await page.getByRole("link", {name:"The Atlas"}).last().click();
    await expect(nav).toBeHidden();
    await expect(page).toHaveURL(/#atlas$/);
  });

  test("mobile menu closes when viewport switches to desktop", async ({ page }) => {
    await page.setViewportSize({width:390,height:820});
    await page.goto("/");
    await page.locator("#menu-toggle").click();
    await expect(page.locator("#mobile-menu")).toBeVisible();
    await page.setViewportSize({width:1024,height:768});
    await expect(page.locator("#mobile-menu")).toBeHidden();
    await expect(page.locator("#menu-toggle")).toHaveAttribute("aria-expanded","false");
  });

  test("demonstrates a model-only one NEAR top-up with an inspectable certificate", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#funded-count")).toContainText("3");
    await page.locator("#topup-button").click();
    await expect(page.locator("#network-mode")).toContainText("13N");
    await expect(page.locator("#funded-count")).toContainText("4");
    await expect(page.locator("#cert-total")).toContainText("13");
    await expect(page.locator("#topup-button")).toHaveAttribute("aria-pressed","true");
    await page.locator("[data-project='d']").click();
    await expect(page.locator("#inspector-heading")).toContainText("Community");
    await expect(page.locator("#inspector-status")).toContainText("VALID");
    await page.locator("#topup-button").click();
    await expect(page.locator("#inspector-status")).toContainText("NOT FUNDED");
  });

  test("keeps invalid baseline plans clearly marked", async ({ page }) => {
    await page.goto("/#benchmarks");
    await page.selectOption("#benchmark-select","competing");
    await expect(page.locator("#benchmark-results")).toContainText("PACT");
    await expect(page.locator("#benchmark-results")).toContainText("INVALID");
  });

  for (const width of [320,390,768]) {
    test("is usable without horizontal overflow at "+width+"px", async ({ page }) => {
      await page.setViewportSize({width,height:850});
      await page.goto("/");
      await expect(page.locator("#hero-title")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await expect(page.locator("#topup-button")).toBeVisible();
      if(width===390) await page.screenshot({path:"test-results/pact-studio-mobile.png",fullPage:true});
    });
  }

  test("does not produce serious or critical accessibility violations", async ({ page }) => {
    await page.goto("/");
    const report=await new AxeBuilder({page}).analyze();
    expect(report.violations.filter(v=>["critical","serious"].includes(v.impact))).toEqual([]);
  });

  test("keeps a real workflow and sandbox evidence available on the protocol route", async ({ page }) => {
    await page.goto("/console");
    await expect(page.locator("#scenario-count")).toHaveText("5");
    await expect(page.locator("#wallet-status")).toContainText("Read-only");
    await expect(page.locator("#coalition-select")).toHaveValue("abcd");
    await expect(page.locator("#decision-heading")).toContainText("1 NEAR short");
    await page.locator("#solve-gap").click();
    await expect(page.locator("#decision-heading")).toContainText("All four are possible");
  });

  test("has no browser errors on homepage", async ({ page }) => {
    const errors=[];
    page.on("pageerror",e=>errors.push(e.message));
    page.on("console",m=>{if(m.type()==="error") errors.push(m.text());});
    await page.goto("/");
    await expect(page.locator("#benchmark-results")).not.toBeEmpty();
    expect(errors).toEqual([]);
  });
});
