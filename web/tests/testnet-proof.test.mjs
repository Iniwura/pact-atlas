import assert from "node:assert/strict";
import test from "node:test";
import { PACT_WASM_CODE_HASH, RPC_URL, BACKUP_RPC_URL, inspectTestnetProof, validateProofInput, verifyTestnetProof, jsonRpc } from "../testnet-proof.mjs";
import { createVerifyHandler } from "../../api/verify-testnet.mjs";

const HASH = "54ijCdCJqdQoA7s35XAaGPWXS7vHprs5RBMYaX8p3Pn";
const input = {
  contractId: "pact-rc1.testnet", signerId: "supporter.testnet",
  transactionHash: HASH, method: "commit"
};
const transaction = () => ({
  final_execution_status: "FINAL",
  transaction: {
    hash: HASH, signer_id: input.signerId, receiver_id: input.contractId,
    actions: [{ FunctionCall: { method_name: "commit", deposit: "3000000000000000000000000" } }]
  },
  status: { SuccessValue: "" },
  transaction_outcome: { outcome: { status: { SuccessReceiptId: "receipt" } } },
  receipts_outcome: [{ outcome: { status: { SuccessValue: "" } } }]
});
const account = { code_hash: PACT_WASM_CODE_HASH };

test("validates testnet-only contract identities, signer, transaction hash and method", () => {
  assert.equal(validateProofInput(input), null);
  assert.equal(validateProofInput({ ...input, signerId: "a".repeat(64) }), null);
  for (const bad of [
    { contractId: "pact.near" },
    { signerId: "supporter.near" },
    { transactionHash: "not-a-hash" },
    { method: "delete_account" }
  ]) assert.ok(validateProofInput({ ...input, ...bad }));
});

test("verifies finalized PACT commit and pinned Wasm from independently returned RPC results", async () => {
  const seen = [];
  const proof = await verifyTestnetProof(input, async (method, params) => {
    seen.push({ method, params });
    return method === "tx" ? { result: transaction() } : { result: account };
  });
  assert.equal(proof.verified, true);
  assert.equal(proof.network, "testnet");
  assert.equal(proof.method, "commit");
  assert.equal(proof.codeHash, PACT_WASM_CODE_HASH);
  assert.match(proof.explorerUrl, /testnet\.nearblocks\.io\/txns\//);
  assert.deepEqual(seen.map(x => x.method), ["tx", "query"]);
  assert.equal(seen[0].params.wait_until, "FINAL");
  assert.equal(seen[1].params.finality, "final");
});

test("never upgrades pending, foreign, changed-code or failed receipts into proof", () => {
  const bad = [
    t => { t.final_execution_status = "EXECUTED"; },
    t => { t.transaction.signer_id = "impostor.testnet"; },
    t => { t.transaction.receiver_id = "other.testnet"; },
    t => { t.transaction.actions[0].FunctionCall.method_name = "unrelated"; },
    t => { t.transaction.hash = "another-hash"; },
    t => { t.status = { Failure: {} }; },
    t => { t.transaction_outcome.outcome.status = { Failure: {} }; },
    t => { t.receipts_outcome[0].outcome.status = { Failure: {} }; },
    t => { delete t.receipts_outcome; },
    t => { t.transaction.actions[0].FunctionCall.deposit = "0"; }
  ];
  for (const makeBad of bad) {
    const tx = transaction();
    makeBad(tx);
    assert.equal(inspectTestnetProof(input, tx, account).verified, false);
  }
  assert.equal(inspectTestnetProof(input, transaction(), { code_hash: "unrelated" }).verified, false);
});

test("invalid input is refused before contacting any RPC", async () => {
  let count = 0;
  const result = await verifyTestnetProof({ ...input, contractId: "mainnet.near" }, async () => { count++; });
  assert.equal(result.verified, false);
  assert.equal(count, 0);
});

test("RPC outages and non-final data fail closed without fabricating evidence", async () => {
  assert.equal((await verifyTestnetProof(input, async () => { throw new Error("offline"); })).verified, false);
  assert.equal((await verifyTestnetProof(input, async () => ({ error: "UNKNOWN_TRANSACTION" }))).verified, false);
  assert.equal((await verifyTestnetProof(input, async (method) => method === "tx" ?
    { result: transaction() } : { error: "NO_ACCOUNT" })).verified, false);
});

test("JSON-RPC transport is pinned to testnet and never sends a wallet credential", async () => {
  let url, body;
  const response = await jsonRpc("tx", { tx_hash: HASH, sender_account_id: input.signerId }, async (uri, opts) => {
    url = uri; body = JSON.parse(opts.body);
    return { ok: true, text: async () => JSON.stringify({ result: { done: true } }) };
  });
  assert.equal(url, RPC_URL);
  assert.equal(body.method, "tx");
  assert.equal(body.params.tx_hash, HASH);
  assert.deepEqual(response, { result: { done: true } });
});

test("uses archival history, falls back to independent archival RPC and never upgrades RPC errors to proof", async () => {
  assert.match(RPC_URL, /^https:\/\/archival-rpc\.testnet\./);
  assert.match(BACKUP_RPC_URL, /^https:\/\/archival-rpc\.testnet\./);
  const seen = [];
  const result = await jsonRpc("tx", { tx_hash: HASH }, async url => {
    seen.push(url);
    if (url === RPC_URL) throw new Error("primary testnet archive unavailable");
    return { ok: true, text: async () => JSON.stringify({ result: { final_execution_status: "FINAL" } }) };
  });
  assert.deepEqual(seen, [RPC_URL, BACKUP_RPC_URL]);
  assert.equal(result.result.final_execution_status, "FINAL");
  let count = 0;
  await assert.rejects(jsonRpc("tx", { tx_hash: HASH }, async () => {
    count++;
    return { ok: true, text: async () => JSON.stringify({ error: { code: -32000 } }) };
  }), /Both NEAR archival RPC reads failed/);
  assert.equal(count, 2);
});

test("same-origin proof endpoint accepts only POST and returns explicit verification status", async () => {
  const responses = [];
  const handler = createVerifyHandler({ verify: async () => ({ verified: true, method: "commit" }) });
  const makeResponse = () => ({
    writeHead(code, headers) { this.code = code; this.headers = headers; },
    end(body) { responses.push({ code: this.code, headers: this.headers, body: JSON.parse(body) }); }
  });
  await handler({ method: "GET" }, makeResponse());
  await handler({ method: "POST", body: input }, makeResponse());
  assert.equal(responses[0].code, 405);
  assert.equal(responses[1].code, 200);
  assert.equal(responses[1].body.verified, true);
  assert.equal(responses[1].headers["Cache-Control"], "no-store");
});
