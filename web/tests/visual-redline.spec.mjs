import { test, expect } from "@playwright/test";

const widths = [320, 390, 768, 1024, 1440];

test.describe("PACT visual redline regressions", () => {
  for (const width of widths) {
    test("landing content reflows without overlapping numeric labels at " + width + "px", async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await expect(page.locator("#intro-heading")).toContainText("depend");
      await expect(page.locator(".model-disclaimer")).toContainText("reference model");
      await expect(page.locator(".pact-sequence")).toHaveCount(0);
      const report = await page.evaluate(() => {
        const metrics = [...document.querySelectorAll(".intro-metrics strong")].map(el => {
          const range = document.createRange();
          range.selectNodeContents(el.firstChild);
          const numeral = range.getBoundingClientRect();
          const denominator = el.querySelector("span").getBoundingClientRect();
          return { gap: denominator.left - numeral.right, clipped: el.scrollWidth > el.clientWidth + 1 };
        });
        const headings = ["#intro-heading", "#atlas-heading", "#benchmark-heading", "#proof-heading"]
          .map(sel => document.querySelector(sel)).filter(Boolean)
          .map(el => ({ text: el.textContent.trim(), clipped: el.scrollWidth > el.clientWidth + 1 }));
        return {
          viewport: innerWidth,
          bodyWidth: document.documentElement.scrollWidth,
          metrics,
          headings
        };
      });
      expect(report.bodyWidth, JSON.stringify(report)).toBeLessThanOrEqual(width + 1);
      expect(report.metrics.every(n => n.gap >= 3 && !n.clipped), JSON.stringify(report.metrics)).toBe(true);
      expect(report.headings.every(n => !n.clipped), JSON.stringify(report.headings)).toBe(true);
    });

    test("campaign card hover stays legible and stable at " + width + "px", async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/console");
      const card = page.locator(".campaign-tile").first();
      await expect(card).toBeVisible();
      // The live RPC response can replace the card DOM during initial load.
      // Measure the hover only after this refresh has completed.
      await page.waitForFunction(() => [...document.querySelectorAll('.tile-rpc')]
        .every(el => !el.textContent.includes('Checking latest state')), null, { timeout: 18000 });
      const initial = await card.evaluate(el => ({
        height: el.getBoundingClientRect().height,
        pseudo: getComputedStyle(el, "::before").content, pseudoDisplay: getComputedStyle(el, "::before").display
      }));
      await card.hover();
      const hovered = await card.evaluate(el => ({
        height: el.getBoundingClientRect().height,
        pseudo: getComputedStyle(el, "::before").content, pseudoDisplay: getComputedStyle(el, "::before").display,
        transform: getComputedStyle(el).transform
      }));
      expect(["none", ""].includes(initial.pseudoDisplay)).toBe(true);
      expect(["none", ""].includes(hovered.pseudoDisplay)).toBe(true);
      expect(["none", ""].includes(hovered.transform)).toBe(true);
      expect(Math.abs(hovered.height - initial.height)).toBeLessThanOrEqual(1);
    });
  }

  for (const width of [320, 390, 768]) {
    test("console maintains a readable workspace layout at " + width + "px", async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/console");
      const geometry = await page.evaluate(() => {
        const copy = document.querySelector(".desk-lead").getBoundingClientRect();
        const proof = document.querySelector(".desk-proof").getBoundingClientRect();
        return {copyBottom: copy.bottom, copyRight: copy.right, proofTop: proof.top, proofLeft: proof.left, scrollWidth: document.documentElement.scrollWidth};
      });
      if (width <= 750) expect(geometry.proofTop, JSON.stringify(geometry)).toBeGreaterThanOrEqual(geometry.copyBottom - 1);
      else expect(geometry.proofLeft, JSON.stringify(geometry)).toBeGreaterThanOrEqual(geometry.copyRight - 1);
      expect(geometry.scrollWidth).toBeLessThanOrEqual(width + 1);
    });
  }
});

