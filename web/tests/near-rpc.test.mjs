import assert from "node:assert/strict";
import test from "node:test";
import { rpcQuery } from "../near-rpc.mjs";

test("transaction finality uses the NEAR tx JSON-RPC method, not query", async () => {
  let serialized;
  const result = await rpcQuery({
    request_type: "tx",
    tx_hash: "finality-hash",
    sender_account_id: "alice.testnet",
    wait_until: "FINAL",
  }, {
    fetchImpl: async (_url, options) => {
      serialized = JSON.parse(options.body);
      return {
        ok: true,
        async json() {
          return { jsonrpc: "2.0", id: "pact-atlas", result: { final_execution_status: "FINAL" } };
        },
      };
    },
  });

  assert.equal(serialized.method, "tx");
  assert.deepEqual(serialized.params, {
    request_type: "tx",
    tx_hash: "finality-hash",
    sender_account_id: "alice.testnet",
    wait_until: "FINAL",
  });
  assert.equal(result.final_execution_status, "FINAL");
});
