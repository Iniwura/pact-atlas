import assert from "node:assert/strict";
import test from "node:test";
import { createNearWalletAdapter, transactionHashOf, finalityOf } from "../near-adapter.mjs";

const request = {
  contractId: "pact-rc1.testnet",
  methodName: "activate",
  args: { allocations: [{ pledge_index: 0, project_id: "a" }] },
  gas: "300000000000000",
  deposit: "0",
};

test("adapts a HOT/legacy-compatible wallet and requires a receipt hash", async () => {
  const calls = [];
  const adapter = createNearWalletAdapter({
    accountId: "operator.testnet",
    wallet: {
      async getAccounts() { return [{ accountId: "operator.testnet" }]; },
      async signAndSendTransaction(value) { calls.push(value); return { transaction: { hash: "hot-hash" } }; },
    },
  });
  assert.equal(await adapter.connect(), "operator.testnet");
  const result = await adapter.call(request);
  assert.equal(result.transactionHash, "hot-hash");
  assert.equal(result.confirmed, false, "a returned hash is not proof of execution");
  assert.equal(calls[0].receiverId, request.contractId);
  assert.equal(calls[0].actions[0].type, "FunctionCall");
  assert.equal(calls[0].actions[0].params.methodName, "activate");
});

test("uses the Wallet Selector v10 functionCall action creator when supplied", async () => {
  let action;
  const adapter = createNearWalletAdapter({
    accountId: "operator.testnet",
    functionCall: (...values) => { action = values; return { functionCall: values }; },
    wallet: { async signAndSendTransaction(value) { return { transactionHash: "selector-hash", value }; } },
  });
  await adapter.connect();
  await adapter.call({ ...request, gas: "300", deposit: "7" });
  assert.deepEqual(action, ["activate", request.args, 300n, 7n]);
});

test("does not turn a missing or delayed outcome into a confirmed transaction", async () => {
  const adapter = createNearWalletAdapter({
    wallet: { async signAndSendTransaction() { return undefined; } },
  });
  await assert.rejects(() => adapter.call(request), /no transaction hash/);
  assert.equal(transactionHashOf({}), null);
});

test("reconciles views through the configured provider", async () => {
  let query;
  const adapter = createNearWalletAdapter({
    wallet: { async signAndSendTransaction() { return { hash: "view-hash" }; } },
    provider: { async query(value) { query = value; return { result: [...new TextEncoder().encode('{"liabilities":"0"}')] }; } },
  });
  const value = await adapter.view({ contractId: "pact-rc1.testnet", methodName: "accounting", args: {} });
  assert.deepEqual(value, { liabilities: "0" });
  assert.equal(query.request_type, "call_function");
  assert.equal(query.finality, "final");
});

test("requires fully finalized successful receipt outcomes before showing wallet confirmation", () => {
  const good = {
    final_execution_status: "FINAL",
    status: { SuccessValue: "" },
    transaction_outcome: { outcome: { status: { SuccessReceiptId: "receipt" } } },
    receipts_outcome: [{ outcome: { status: { SuccessValue: "" } } }]
  };
  assert.equal(finalityOf(good), "confirmed");
  assert.equal(finalityOf({ ...good, final_execution_status: "EXECUTED" }), "unknown");
  assert.equal(finalityOf({ ...good, receipts_outcome: undefined }), "unknown");
  assert.equal(finalityOf({ ...good, receipts_outcome: [{ outcome: { status: { Failure: {} } } }] }), "failed");
});

test("rejects a finalized failed transaction even when the wallet supplies a hash", async () => {
  const adapter = createNearWalletAdapter({
    wallet: { async signAndSendTransaction() { return {
      transaction: { hash: "failed-hash" },
      final_execution_status: "FINAL",
      status: { Failure: { ActionError: {} } }
    }; } }
  });
  await assert.rejects(() => adapter.call(request), /failed on-chain.*explorer/i);
});

test("converts deployment actions without silently dropping account creation or Wasm", async () => {
  let sent;
  const adapter = createNearWalletAdapter({
    accountId: "alice.testnet",
    actionCreators: {
      createAccount: () => ({ type: "create" }),
      transfer: value => ({ type: "transfer", value }),
      deployContract: code => ({ type: "deploy", code }),
      functionCall: (...values) => ({ type: "call", values }),
    },
    wallet: { async signAndSendTransaction(value) { sent = value; return { transactionHash: "deploy-hash" }; } },
  });
  await adapter.connect();
  await adapter.call({
    contractId: "riverside-hub.alice.testnet",
    signerId: "alice.testnet",
    actions: [
      { type: "CreateAccount" },
      { type: "Transfer", deposit: "7" },
      { type: "DeployContract", code: new Uint8Array([1, 2, 3]) },
      { type: "FunctionCall", methodName: "new", args: {}, gas: "300", deposit: "0" },
    ],
  });
  assert.deepEqual(sent.actions.map(action => action.type), ["create", "transfer", "deploy", "call"]);
  assert.equal(sent.actions[1].value, 7n);
  assert.deepEqual([...sent.actions[2].code], [1, 2, 3]);
});

test("finality confirmation is read-only and never resubmits", async () => {
  let sends = 0;
  const adapter = createNearWalletAdapter({
    accountId: "alice.testnet",
    wallet: { async signAndSendTransaction() { sends += 1; return { transactionHash: "unknown-hash" }; } },
    provider: { async query(request) {
      assert.equal(request.request_type, "tx");
      return { final_execution_status: "FINAL", status: { SuccessValue: "" }, transaction_outcome: { outcome: { status: { SuccessReceiptId: "receipt" } } }, receipts_outcome: [{ outcome: { status: { SuccessValue: "" } } }] };
    } },
  });
  await adapter.connect();
  const submitted = await adapter.call(request);
  assert.equal(submitted.confirmed, false);
  const confirmed = await adapter.confirm({ transactionHash: submitted.transactionHash });
  assert.equal(confirmed.confirmed, true);
  assert.equal(sends, 1);
});
