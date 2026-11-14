import { test, expect } from "@playwright/test";

test("NEAR Connect displays modern testnet wallets without requesting a gas allowance",async({page})=>{
  await page.route("**/rpc.testnet.fastnear.com/**",r=>r.abort());
  await page.route("**/rpc.testnet.near.org/**",r=>r.abort());
  await page.goto("/console");
  await page.locator("#connect-wallet").click();
  const modal=page.locator(".modal-container");
  await expect(modal).toBeVisible({timeout:30000});
  await expect(modal).toContainText("Select wallet");
  await expect(modal).toContainText("Meteor Wallet");
  await expect(modal).toContainText("Intear Wallet");
  await expect(modal).toContainText("NEAR Connector");
  await expect(modal).not.toContainText("MyNearWallet");
  await expect(page.locator(".connect-item")).toHaveCount(4);
  await expect(page.locator("#wallet-disconnect")).toBeHidden();
  await expect(page.locator("#connect-wallet")).not.toHaveAttribute("data-connected","true");
});

test("closing NEAR Connect chooser returns to read-only browsing without wallet approval",async({page})=>{
  await page.goto("/console");
  await page.locator("#connect-wallet").click();
  const modal=page.locator(".modal-container");
  await expect(modal).toBeVisible({timeout:30000});
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
  await expect(page.locator("#connect-wallet")).toBeEnabled({timeout:10000});
  await expect(page.locator("#connect-wallet")).toContainText("Connect wallet");
  await expect(page.locator("#wallet-disconnect")).toBeHidden();
  await page.locator('.top-nav a[href="#campaigns"]').click();
  await expect(page.locator("#campaigns")).toBeVisible();
});
