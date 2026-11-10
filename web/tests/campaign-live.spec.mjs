import { test, expect } from "@playwright/test";
import { campaignShareToken } from "../campaign-chain.mjs";

const campaign = {
  title: "River Commons",
  projects: [
    { id: "alpha", name: "Community Wi-Fi", goal: 1, dependencies: [], beneficiary: "alpha.testnet" },
    { id: "beta", name: "Training room", goal: 1, dependencies: [], beneficiary: "beta.testnet" },
  ],
  supporters: [
    { id: "s1", name: "Mina", amount: 1, allowed: ["alpha"], requires: [] },
    { id: "s2", name: "Tunde", amount: 1, allowed: ["beta"], requires: [] },
  ],
  deployment: { authority: "authority.testnet" },
};

function encodedView(value) {
  return [...new TextEncoder().encode(JSON.stringify(value))];
}

async function mockFinalizedViews(page) {
  await page.route(/rpc\.testnet\.fastnear\.com/, async route => {
    const request = route.request().postDataJSON();
    const method = request?.params?.method_name;
    const value = method === "status"
      ? { phase: "OPEN", activate_after_ms: Date.now() + 60_000, deadline_ms: Date.now() + 86_400_000, pledge_count: 2 }
      : method === "accounting"
        ? { locked_pledges: "2000000000000000000000000", liabilities: "2000000000000000000000000", solvent: true }
        : [];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ jsonrpc: "2.0", id: "pact-atlas", result: { result: encodedView(value) } }),
    });
  });
}

test.describe("Public testnet campaign", () => {
  test("renders finalized state, conditions and a clearly labeled candidate certificate", async ({ page }) => {
    await mockFinalizedViews(page);
    await page.goto(`/campaign?contract=river.testnet&config=${encodeURIComponent(campaignShareToken(campaign))}`);

    await expect(page.getByRole("heading", { name: "River Commons" })).toBeVisible();
    await expect(page.locator("#campaign-network")).toContainText("NEAR TESTNET");
    await expect(page.locator("#live-phase")).toHaveText("OPEN");
    await expect(page.locator("#live-committed")).toHaveText("2 NEAR");
    await expect(page.locator("#live-pledges")).toHaveText("2");
    await expect(page.locator("#live-solvency")).toHaveText("accounting identity reconciles");
    await expect(page.locator("#campaign-projects")).toContainText("Community Wi-Fi");
    await expect(page.locator("#campaign-projects")).toContainText("Training room");
    await expect(page.locator("#allocation-state")).toContainText("Candidate certificate ready");
    await expect(page.locator("#allocation-certificate")).toBeVisible();
    await expect(page.locator("#activate-submit")).toBeVisible();
    await expect(page.locator("#campaign-error")).toBeHidden();
  });

  test("rejects a malformed share link before contacting the RPC", async ({ page }) => {
    let rpcCalls = 0;
    await page.route(/rpc\.testnet\.fastnear\.com/, async route => { rpcCalls += 1; await route.abort(); });
    await page.goto("/campaign?contract=river.testnet&config=not-a-campaign-token");
    await expect(page.locator("#campaign-error")).toContainText("incomplete or invalid");
    expect(rpcCalls).toBe(0);
  });

  test("rejects a mainnet-style campaign account before showing a testnet explorer link", async ({ page }) => {
    let rpcCalls = 0;
    await page.route(/rpc\.testnet\.fastnear\.com/, async route => { rpcCalls += 1; await route.abort(); });
    await page.goto(`/campaign?contract=river.near&config=${encodeURIComponent(campaignShareToken(campaign))}`);
    await expect(page.locator("#campaign-error")).toContainText("dedicated *.testnet account");
    expect(rpcCalls).toBe(0);
  });
});
