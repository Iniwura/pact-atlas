import { test, expect } from "@playwright/test";

// A connection cannot be proven without the user's real extension approval.
// These browser checks enforce that unsupported wallet options are absent and
// that choosing to leave never yields a false connected state.
test("only Meteor Wallet is offered for NEAR testnet authorization", async ({page}) => {
  await page.route("**/rpc.testnet.fastnear.com/**",r=>r.abort());
  await page.route("**/rpc.testnet.near.org/**",r=>r.abort());
  await page.goto("/console");
  await page.locator("#connect-wallet").click();
  const modal=page.locator(".nws-modal-wrapper.open");
  await expect(modal).toBeVisible({timeout:30000});
  await expect(page.locator("#near-wallet-selector-modal")).toContainText("Meteor Wallet");
  await expect(page.locator("#near-wallet-selector-modal")).not.toContainText("MyNearWallet");
  await expect(page.locator("#near-wallet-selector-modal")).not.toContainText("Nightly");
  await expect(page.locator("#near-wallet-selector-modal")).not.toContainText("Sender");
  await expect(page.locator("#wallet-disconnect")).toBeHidden();
  await expect(page.locator("#connect-wallet")).not.toHaveAttribute("data-connected","true");
});
test("closing Meteor chooser returns to browsing with no wallet or transaction", async ({page}) => {
  await page.goto("/console");
  await page.locator("#connect-wallet").click();
  const modal=page.locator(".nws-modal-wrapper.open");
  await expect(modal).toBeVisible({timeout:30000});
  await page.locator("#near-wallet-selector-modal .close-button").click();
  await expect(modal).toBeHidden();
  await expect(page.locator("#connect-wallet")).toBeEnabled({timeout:10000});
  await expect(page.locator("#connect-wallet")).toContainText("Connect wallet");
  await expect(page.locator("#wallet-disconnect")).toBeHidden();
  await page.locator('.top-nav a[href="#campaigns"]').click();
  await expect(page.locator("#campaigns")).toBeVisible();
});
