import { test, expect } from "@playwright/test";

// Validate the real Wallet Selector -> external wallet URL handoff. The
// third-party page is replaced with an inert fixture; this test never signs.
test("wallet chooser delegates to MyNearWallet with a scoped NEAR testnet authorization", async ({page}) => {
  await page.route("**/rpc.testnet.fastnear.com/**",route=>route.abort());
  await page.route("**/rpc.testnet.near.org/**",route=>route.abort());
  await page.context().route("https://testnet.mynearwallet.com/**", route =>
    route.fulfill({status:200,contentType:"text/html",body:"<h1>External wallet login</h1>"}));
  await page.goto("/console");
  await page.locator("#connect-wallet").click();
  await expect(page.locator(".nws-modal-wrapper.open")).toBeVisible({timeout:30000});
  const popupPromise = page.waitForEvent("popup",{timeout:15000});
  await page.locator("#module-my-near-wallet").click();
  const popup = await popupPromise;
  try {
    await popup.waitForURL(/testnet\.mynearwallet\.com\/login\//,{timeout:15000});
    const u=new URL(popup.url());
    expect(u.origin).toBe("https://testnet.mynearwallet.com");
    expect(u.searchParams.get("contract_id")).toBe("coalition-20261110.beneficiary-20261110.testnet");
    expect(u.searchParams.getAll("methodNames")).toContain("status");
    expect(u.searchParams.get("success_url")).toContain("127.0.0.1:4173/console");
    await expect(page.locator("#wallet-disconnect")).toBeHidden();
    await expect(page.locator("#connect-wallet")).not.toHaveAttribute("data-connected","true");
  } finally { await popup.close(); }
});
