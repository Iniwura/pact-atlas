import assert from "node:assert/strict";
import test from "node:test";
import { createNearWalletAdapter, transactionHashOf } from "../near-adapter.mjs";

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
