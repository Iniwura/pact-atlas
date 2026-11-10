import assert from "node:assert/strict";
import test from "node:test";
import { WALLET_SELECTOR_MODULES, WALLET_SELECTOR_VERSION } from "../wallet-selector-host.mjs";

test("pins Meteor Wallet for explicit NEAR testnet selection", () => {
  assert.equal(WALLET_SELECTOR_VERSION, "10.1.4");
  assert.match(WALLET_SELECTOR_MODULES.meteorWallet, /@near-wallet-selector\/meteor-wallet@10\.1\.4/);
  assert.equal("myNearWallet" in WALLET_SELECTOR_MODULES, false);
});

test("Meteor, core and modal bundles are publicly retrievable", async () => {
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
