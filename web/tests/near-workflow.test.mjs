import assert from "node:assert/strict";
import test from "node:test";
import { buildWorkflowRequest, certificateFor, reconciliationViews } from "../near-workflow.mjs";

const config = { network: "testnet", contractId: "pact-rc1.testnet", daoId: "sputnik-rc1.testnet" };

test("builds an attached native commitment request", () => {
  const request = buildWorkflowRequest("commit", { config });
  assert.equal(request.contractId, config.contractId);
  assert.equal(request.methodName, "commit");
  assert.equal(request.deposit, "3000000000000000000000000");
  assert.deepEqual(request.args, { allowed: ["a", "d"], requires: [] });
});

test("builds a Sputnik proposal containing the exact PACT call", () => {
  const request = buildWorkflowRequest("approve", { config });
  const functionCall = request.args.proposal.kind.FunctionCall;
  const action = functionCall.actions[0];
  assert.equal(request.contractId, config.daoId);
  assert.equal(functionCall.receiver_id, config.contractId);
  assert.equal(action.method_name, "commit");
  assert.deepEqual(JSON.parse(Buffer.from(action.args, "base64").toString()), { allowed: ["a", "d"], requires: [] });
});

test("builds an exact local certificate without a transaction", () => {
  const request = buildWorkflowRequest("certify", { config });
  assert.equal(request.exact, true);
  assert.deepEqual(request.allocations, certificateFor());
  assert.equal(request.allocations.length, 4);
});

test("builds activation and settlement requests from the same contract config", () => {
  const activation = buildWorkflowRequest("activate", { config });
  const withdrawal = buildWorkflowRequest("withdraw", { config });
  assert.equal(activation.methodName, "activate");
  assert.equal(activation.args.allocations.length, 4);
  assert.equal(withdrawal.methodName, "withdraw");
  assert.deepEqual(reconciliationViews(config).map((view) => view.methodName), ["status", "accounting"]);
});

test("refuses signing requests without an explicit configured contract", () => {
  assert.throws(() => buildWorkflowRequest("activate"), /contract ID is not configured/);
  assert.throws(() => buildWorkflowRequest("approve", { config: { contractId: config.contractId } }), /DAO contract ID is not configured/);
});
