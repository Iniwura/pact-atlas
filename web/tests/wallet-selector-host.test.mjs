import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { NEAR_CONNECT_MODULE, NEAR_CONNECT_VERSION, CONNECT_OPTIONS, connectorSettings, readableWalletError } from "../wallet-selector-host.mjs";

test("pins the recommended NEAR Connect wallet integration instead of deprecated Wallet Selector", () => {
  assert.equal(NEAR_CONNECT_VERSION, "0.12.0");
  assert.match(NEAR_CONNECT_MODULE, /@hot-labs\/near-connect@0\.12\.0/);
  assert.equal(CONNECT_OPTIONS.network, "testnet");
  assert.equal(CONNECT_OPTIONS.autoConnect, false);
  assert.equal(CONNECT_OPTIONS.features.signInWithoutAddKey, true);
  assert.equal(CONNECT_OPTIONS.features.signAndSendTransaction, true);
});

test("the connection does not request access-key creation or gas allowance", () => {
  const source = fs.readFileSync(new URL("../wallet-selector-host.mjs", import.meta.url), "utf8");
  assert.ok(source.includes("const wallet = await connector.connect()"));
  assert.ok(!source.includes("signIn: {"));
  assert.ok(!source.includes("connector.addFunctionCallKey("));
  assert.ok(!source.includes("methodNames: [\"status\"]"));
});

test("wallet options are cloned and retired wallets are filtered", () => {
  const first=connectorSettings();
  assert.equal(first.network,"testnet");
  assert.equal(first.autoConnect,false);
  assert.ok(first.excludedWallets.includes("my-near-wallet"));
  first.excludedWallets.push("x");
  first.features.signInWithoutAddKey=false;
  const second=connectorSettings();
  assert.ok(!second.excludedWallets.includes("x"));
  assert.equal(second.features.signInWithoutAddKey,true);
});

test("transaction signing continues through NEAR Connect wallet instead of a fake local signer",()=>{
  const source=fs.readFileSync(new URL("../wallet-selector-host.mjs",import.meta.url),"utf8");
  assert.ok(source.includes("getConnectedWallet()"));
  assert.ok(source.includes("signed.wallet.signAndSendTransaction(request)"));
  assert.ok(source.includes("createNearWalletAdapter("));
  assert.ok(!source.includes("signAndSendTransaction: async () => ({"));
});

test("new connector bundle is publicly reachable",async()=>{
  const response=await fetch(NEAR_CONNECT_MODULE);
  assert.equal(response.status,200);
  assert.match(await response.text(),/near-connect/i);
});

test("wallet failures do not claim funds were moved or connected",()=>{
  assert.match(readableWalletError({code:"wallet-cancelled"}),/Nothing was connected or signed/);
  assert.match(readableWalletError({code:"wallet-timeout"}),/did not respond/);
  assert.match(readableWalletError(new Error("User rejected")),/Nothing was connected or signed/);
  assert.doesNotMatch(readableWalletError(new Error("token=SENSITIVE_SECRET")) ,/SENSITIVE_SECRET/);
});
