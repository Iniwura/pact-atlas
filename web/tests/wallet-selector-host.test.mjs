import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { WALLET_SELECTOR_MODULES, WALLET_SELECTOR_VERSION, readableWalletError } from "../wallet-selector-host.mjs";

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
 assert.ok(css.includes("position: fixed"));
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
