import { test, expect } from "@playwright/test";

test.describe("PACT wallet, tour and recovery",()=>{
  test.beforeEach(async ({page})=>{
    await page.route("**/rpc.testnet.fastnear.com/**",r=>r.abort());
    await page.route("**/rpc.testnet.near.org/**",r=>r.abort());
  });
  test("NEAR Connect chooser is visible and cancellation always recovers",async ({page})=>{
    await page.goto("/console");
    await page.locator("#connect-wallet").click();
    const modal=page.locator(".modal-container");
    await expect(modal).toBeVisible({timeout:30000});
    await expect(modal).toContainText("Select wallet");
    await expect(modal).toContainText("Meteor Wallet");
    await expect(modal).toContainText("Intear Wallet");
    await expect(modal).not.toContainText("MyNearWallet");
    const style=await modal.evaluate(e=>({position:getComputedStyle(e).position,z:parseInt(getComputedStyle(e).zIndex)}));
    expect(style.position).toBe("fixed");
    expect(style.z).toBeGreaterThan(1200);
    await page.keyboard.press("Escape");
    await expect(modal).toHaveCount(0);
    await expect(page.locator("#connect-wallet")).toBeEnabled();
    await expect(page.locator("#wallet-message")).toContainText("Nothing was connected or signed");
    await expect(page.locator("#wallet-disconnect")).toBeHidden();
  });
  test("signing-disabled path shows a recoverable error",async ({page})=>{
    await page.addInitScript(()=>window.PACT_DISABLE_WALLET_SELECTOR=true);
    await page.goto("/console");
    await page.locator("#connect-wallet").click();
    await expect(page.locator("#wallet-message")).toContainText("Wallet signing is disabled");
    await expect(page.locator("#connect-wallet")).toBeEnabled();
  });
  test("guided discovery offers choice, highlights live UI, and exits on Escape",async ({page})=>{
    await page.goto("/console");
    await page.locator("#pact-tour-open").click();
    const panel=page.locator("#pact-tour-panel");
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute("aria-modal","true");
    await expect(page.locator(".tour-visual-node")).toHaveCount(2);
    await expect(panel).toContainText("Alpha");
    await expect(panel).toContainText("Beta");
    await page.locator('[data-tour-journey="explore"]').click();
    await expect(page.locator("#pact-tour-step-title")).toHaveText("See what's being funded.");
    await expect(page.locator("#campaigns")).toHaveClass(/pact-tour-focus/);
    await expect(page.locator("#pact-tour-spotlight")).toBeVisible();
    await page.locator("#pact-tour-next").click();
    await expect(page.locator("#pact-tour-step-title")).toHaveText("Follow the dependency.");
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(page.locator(".pact-tour-focus")).toHaveCount(0);
  });
  test("offline notice is explicit and dismissible",async ({page})=>{
    await page.goto("/");
    await page.evaluate(()=>window.dispatchEvent(new Event("offline")));
    const notice=page.locator("#pact-system-recovery");
    await expect(notice).toBeVisible();
    await expect(notice).toContainText("No transaction is automatically retried");
    await notice.getByRole("button",{name:"Dismiss"}).click();
    await expect(notice).toBeHidden();
  });
  test("invalid campaign URL is explained and clears when corrected",async ({page})=>{
    await page.goto("/console");
    await page.locator("#join-url").fill("https://outside.example/unsafe");
    await page.getByRole("button",{name:/Open agreement/i}).click();
    await expect(page.locator("#join-url")).toHaveAttribute("aria-invalid","true");
    await expect(page.locator("#join-status")).toContainText("Use a complete PACT campaign URL");
    await page.locator("#join-url").fill("https://outside.example/campaign");
    await expect(page.locator("#join-url")).not.toHaveAttribute("aria-invalid","true");
  });
  test("missing public index fails closed, with read-only retry",async ({page})=>{
    await page.route("**/data/testnet-proof.json",r=>r.abort());
    await page.goto("/console");
    await expect(page.locator(".evidence-load-failed")).toContainText("Public evidence unavailable");
    await expect(page.locator(".evidence-retry")).toBeVisible();
    await expect(page.locator("#campaign-list .campaign-tile")).toHaveCount(0);
  });
  test("unreachable verifier does not claim successful proof",async ({page})=>{
    await page.route("**/api/verify-testnet",r=>r.abort());
    await page.goto("/verify.html");
    await page.locator("#load-real-proof").click();
    await page.locator("#proof-check").click();
    await expect(page.locator("#proof-verdict")).toHaveText("Verification unavailable",{timeout:15000});
    await expect(page.locator("#proof-result")).toHaveAttribute("data-state","failed");
    await expect(page.locator("#proof-check")).toBeEnabled();
  });
});

