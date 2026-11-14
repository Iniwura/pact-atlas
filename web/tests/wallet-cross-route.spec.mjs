import { test, expect } from "@playwright/test";

// This fixture only exercises shared UI state: it is NOT a real wallet signature.
const simulatedConnector = `
const listeners = new Map();
const address = "iniwura.testnet";
const account = {accountId: address, active: true};
export class NearConnector {
  constructor() { this.whenManifestLoaded=Promise.resolve(); this.availableWallets=[{id:"meteor-wallet"}]; }
  on(type, callback) { const set=listeners.get(type)||new Set();set.add(callback);listeners.set(type,set);return ()=>set.delete(callback); }
  emit(type, payload) { for(const handler of listeners.get(type)||[])handler(payload); }
  wallet() { return {getAccounts:async()=>[account],signAndSendTransaction:async()=>{throw Error("test must not sign")}}; }
  async connect() { localStorage.setItem("selected-wallet","meteor-wallet");const wallet=this.wallet();this.emit("wallet:signIn",{accounts:[account],wallet,success:true});return wallet; }
  async getConnectedWallet() { if(localStorage.getItem("selected-wallet")!=="meteor-wallet")throw Error("No wallet selected");return {wallet:this.wallet(),accounts:[account]}; }
  async disconnect() { localStorage.removeItem("selected-wallet");this.emit("wallet:signOut",{success:true}); }
}`;
async function fixture(page) {
  await page.route(/^https:\/\/esm\.sh\/@hot-labs\/near-connect@0\.12\.0\?bundle/, route =>
    route.fulfill({status:200,contentType:"text/javascript",headers:{"access-control-allow-origin":"*"},body:simulatedConnector}));
  await page.route("**/rpc.testnet.fastnear.com/**",r=>r.abort());
  await page.route("**/rpc.testnet.near.org/**",r=>r.abort());
}

test("real account is re-read on every route and disconnect clears every header",async({page})=>{
  await fixture(page);
  await page.goto("/console");
  await page.locator("#connect-wallet").click();
  await expect(page.locator("#connect-wallet")).toContainText("iniwura.testnet",{timeout:15000});
  await expect(page.locator("#wallet-disconnect")).toBeVisible();
  await expect(page.locator("#pact-notifications")).toContainText("Wallet connected");
  await page.goto("/create.html");
  await expect(page.locator("#connect-wallet")).toContainText("iniwura.testnet",{timeout:12000});
  await expect(page.locator("#wallet-disconnect")).toBeVisible();
  await expect(page.locator("#wallet-message")).toContainText("Connected to NEAR testnet");
  await page.goto("/verify.html");
  await expect(page.locator("#connect-wallet")).toContainText("iniwura.testnet",{timeout:12000});
  await page.locator("#wallet-disconnect").click();
  await expect(page.locator("#connect-wallet")).toContainText("Connect wallet");
  await expect(page.locator("#wallet-disconnect")).toBeHidden();
  expect(await page.evaluate(()=>localStorage.getItem("selected-wallet"))).toBeNull();
  await page.goto("/console#activity");
  await expect(page.locator("#connect-wallet")).toContainText("Connect wallet");
  await expect(page.locator("#wallet-disconnect")).toBeHidden();
});
test("a misleading cached account string never passes as connected",async({page})=>{
  await fixture(page);
  await page.goto("/verify.html");
  await page.evaluate(()=>localStorage.setItem("selected-wallet","nonexistent-wallet"));
  await page.reload();
  await expect(page.locator("#connect-wallet")).toContainText("Connect wallet",{timeout:12000});
  await expect(page.locator("#wallet-disconnect")).toBeHidden();
  await expect(page.locator("#wallet-message")).not.toContainText("Connected to NEAR testnet");
});
test("visible guide and actionable error notifications remain available",async({page})=>{
  await fixture(page);
  await page.goto("/console");
  await page.locator("#pact-guide-header").click();
  await expect(page.locator("#pact-tour-panel")).toBeVisible();
  await expect(page.locator("#pact-tour-panel")).toContainText("PACT");
  await page.keyboard.press("Escape");
  await expect(page.locator("#pact-tour-panel")).toBeHidden();
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent("pact:notify",{detail:{kind:"error",message:"This testnet read is unavailable."}})));
  const alert=page.locator(".pact-notification[role=alert]");
  await expect(alert).toContainText("This testnet read is unavailable.");
  await alert.getByRole("button",{name:"Dismiss notification"}).click();
  await expect(alert).toHaveCount(0);
  await page.goto("/create.html");
  await page.getByRole("link",{name:"Open PACT guided walkthrough"}).click();
  await expect(page).toHaveURL(/console\?tour=1/);
  await expect(page.locator("#pact-tour-panel")).toBeVisible();
});
