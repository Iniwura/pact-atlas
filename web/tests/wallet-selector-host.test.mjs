import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { WALLET_SELECTOR_MODULES, WALLET_SELECTOR_VERSION, readableWalletError, DEFAULT_SIGNIN_CONTRACT, walletSignInOptions, waitForWalletAccount } from "../wallet-selector-host.mjs";

test("pins Meteor Wallet for explicit NEAR testnet selection", () => {
  assert.equal(WALLET_SELECTOR_VERSION, "10.1.4");
  assert.match(WALLET_SELECTOR_MODULES.meteorWallet, /@near-wallet-selector\/meteor-wallet@10\.1\.4/);
  assert.match(WALLET_SELECTOR_MODULES.meteorWallet, /deps=near-api-js@5\.1\.1/);
  assert.match(WALLET_SELECTOR_MODULES.sender, /@near-wallet-selector\/sender@10\.1\.4/);
  assert.match(WALLET_SELECTOR_MODULES.nightly, /@near-wallet-selector\/nightly@10\.1\.4/);
  assert.match(WALLET_SELECTOR_MODULES.myNearWallet,/my-near-wallet@10\.1\.4/);
});

test("registers Sender as an optional injected wallet without changing the testnet network", () => {
  const source = fs.readFileSync(new URL("../wallet-selector-host.mjs", import.meta.url), "utf8");
  assert.match(source, /import\(MODULES\.sender\)/);
  assert.match(source, /import\(MODULES\.nightly\)/);
  assert.match(source, /import\(MODULES\.myNearWallet\)/);
  assert.ok(source.includes("modules:[setupMeteorWallet(),setupSender(),setupNightly(),setupMyNearWallet()]"));
  assert.match(source, /network:\s*"testnet"/);
});

test("both overview and creator sign in against a known testnet PACT contract, with status-only access", () => {
  assert.equal(DEFAULT_SIGNIN_CONTRACT, "coalition-20261110.beneficiary-20261110.testnet");
  assert.deepEqual(walletSignInOptions(), {
    contractId: DEFAULT_SIGNIN_CONTRACT,
    methodNames: ["status"]
  });
  assert.deepEqual(walletSignInOptions("my-campaign.owner.testnet"), {
    contractId: "my-campaign.owner.testnet",
    methodNames: ["status"]
  });
  assert.throws(() => walletSignInOptions("mainnet.near"), /invalid/i);
  assert.throws(() => walletSignInOptions("https://evil.testnet"), /invalid/i);
  assert.throws(() => walletSignInOptions(""), /invalid/i);
});

test("wallet navigation never counts as cancelling an already approved wallet handoff", () => {
  const source = fs.readFileSync(new URL("../wallet-selector-host.mjs", import.meta.url), "utf8");
  assert.ok(source.includes('modal?.on?.("onHide"'));
  assert.ok(source.includes('hideReason === "user-triggered"'));
  assert.ok(!source.includes('classList.contains("open")'));
  assert.ok(source.includes("waitForWalletAccount(selector, modal)"));
  assert.ok(source.includes("setupModal(selector, walletSignInOptions(contractId))"));
});

function fakeWalletHandoff() {
  let accounts = [];
  const observed = new Set();
  const hidden = new Set();
  const selector = {store: {
    getState: () => ({ accounts }),
    observable: { subscribe(handler) {
      observed.add(handler);
      return { unsubscribe() { observed.delete(handler); } };
    } }
  }};
  const modal = { on(event, handler) {
    assert.equal(event, "onHide");
    hidden.add(handler);
    return { remove() { hidden.delete(handler); } };
  }};
  return {
    selector, modal,
    hide(hideReason) { for (const handler of [...hidden]) handler({hideReason}); },
    authorize(accountId) {
      accounts = [{accountId, active:true}];
      for (const handler of [...observed]) handler();
    },
    listeners() { return observed.size + hidden.size; }
  };
}

test("genuine user cancel releases the pending wallet flow and subscriptions", async () => {
  const fake = fakeWalletHandoff();
  const connect = waitForWalletAccount(fake.selector, fake.modal, {timeoutMs:300});
  fake.hide("user-triggered");
  await assert.rejects(connect, err => err.code === "wallet-cancelled");
  assert.equal(fake.listeners(), 0);
});

test("wallet navigation into popup is not a cancellation and may approve later", async () => {
  const fake = fakeWalletHandoff();
  const connect = waitForWalletAccount(fake.selector, fake.modal, {timeoutMs:300});
  fake.hide("wallet-navigation");
  fake.authorize("test-signer.testnet");
  assert.equal(await connect, "test-signer.testnet");
  assert.equal(fake.listeners(), 0);
});

test("wallet handoff without authorization returns a recoverable timeout, not connected", async () => {
  const fake = fakeWalletHandoff();
  const connect = waitForWalletAccount(fake.selector, fake.modal, {timeoutMs:20});
  fake.hide("wallet-navigation");
  await assert.rejects(connect, err => err.code === "wallet-timeout");
  assert.equal(fake.listeners(), 0);
});

test("returns the modal factory used by the real connection boundary", () => {
  const source = fs.readFileSync(new URL("../wallet-selector-host.mjs", import.meta.url), "utf8");
  assert.ok(source.includes("return {selector,actionCreators,setupModal}"));
  assert.ok(source.includes("const {selector,actionCreators,setupModal} = await selectorPromise"));
});

test("Meteor, Sender, core and modal bundles are publicly retrievable", async () => {
  for (const [name, url] of Object.entries(WALLET_SELECTOR_MODULES)) {
    const response = await fetch(url);
    assert.equal(response.status, 200, `${name} bundle did not return HTTP 200`);
    const body = await response.text();
    assert.ok(body.length > 100, `${name} bundle was unexpectedly empty`);
    assert.match(body, /near-wallet-selector|esm\.sh/, `${name} response was not a module bundle`);
  }
});

test("the configured RPC is an actual NEAR testnet endpoint", async () => {
  const response = await fetch("https://rpc.testnet.near.org", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "pact-atlas-wallet-selector", method: "status", params: [] }),
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.result?.chain_id, "testnet");
  assert.ok(Number(body.result?.protocol_version) >= 83, "testnet protocol must support the current action/gas rules");
});

test("official pinned modal CSS is present on every signing surface",()=> {
 const root=new URL("../",import.meta.url);
 const css=fs.readFileSync(new URL("vendor/near-wallet-selector.css",root),"utf8");
 assert.ok(css.includes(".nws-modal-wrapper"));
 assert.match(css,/position:\s*fixed/);
 for(const page of ["console.html","create.html","campaign.html"]){
  const html=fs.readFileSync(new URL(page,root),"utf8");
  assert.ok(html.includes("vendor/near-wallet-selector.css"));
  assert.ok(html.includes("wallet-modal-polish.css"));
 }
});
test("wallet cancellation and network failures never imply a signature",()=> {
 assert.match(readableWalletError({code:"wallet-cancelled"}),/Nothing was connected or signed/);
 assert.match(readableWalletError({code:"wallet-timeout"}),/did not respond/);
 assert.match(readableWalletError({code:"wallet-unavailable"}),/could not load/);
 assert.doesNotMatch(readableWalletError(new Error("token=SECRET123")),/SECRET123/);
});
