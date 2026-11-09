/**
 * Read-only, independently reproducible verification of a PACT testnet call.
 * Does not sign transactions, process payments, or claim production safety.
 */
export const PACT_WASM_CODE_HASH = "8kYswvde6AC41E17ae1LtuepvC4FcTrEzRTSpr1TBgCS";
export const RPC_URL = "https://rpc.testnet.fastnear.com";
export const ALLOWED_METHODS = Object.freeze(["commit", "activate", "expire", "withdraw"]);
const methodSet = new Set(ALLOWED_METHODS);
const testnetAccount = /^(?:[a-z0-9_-]+\.)+testnet$/;
const implicitAccount = /^[0-9a-f]{64}$/;
const base58 = /^[1-9A-HJ-NP-Za-km-z]{42,50}$/;
const has = (object, key) => object !== null && typeof object === "object" &&
  Object.prototype.hasOwnProperty.call(object, key);
const succeeded = status => has(status, "SuccessValue") || has(status, "SuccessReceiptId");
const fail = reason => ({ verified: false, network: "testnet", reason });

export function validateProofInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    return "Provide a testnet contract, signer, transaction hash and method.";
  if (typeof input.contractId !== "string" || input.contractId.length > 64 || !testnetAccount.test(input.contractId))
    return "Enter a valid NEAR testnet contract account ending in .testnet.";
  if (typeof input.signerId !== "string" || input.signerId.length > 64 || !testnetAccount.test(input.signerId))
    return "Enter the testnet account that actually signed the transaction.";
  if (typeof input.transactionHash !== "string" || !base58.test(input.transactionHash))
    return "Enter the full Base58 NEAR transaction hash.";
  if (!methodSet.has(input.method)) return "Choose a supported PACT contract method.";
  return null;
}

export function inspectTestnetProof(input, transaction, account) {
  const error = validateProofInput(input);
  if (error) return fail(error);
  if (!transaction || transaction.final_execution_status !== "FINAL")
    return fail("The transaction is not finalized on NEAR testnet.");
  if (transaction.transaction?.hash !== input.transactionHash ||
      transaction.transaction?.signer_id !== input.signerId ||
      transaction.transaction?.receiver_id !== input.contractId)
    return fail("The transaction hash, signer or destination does not match the requested proof.");
  const actions = transaction.transaction?.actions;
  if (!Array.isArray(actions) || !actions.some(action => action?.FunctionCall?.method_name === input.method))
    return fail("The transaction does not call the selected PACT method.");
  if (!succeeded(transaction.status) ||
      !succeeded(transaction.transaction_outcome?.outcome?.status))
    return fail("The chain reports a failed or unconfirmed transaction.");
  if (!Array.isArray(transaction.receipts_outcome))
    return fail("Receipt outcomes are missing; execution cannot be verified.");
  if (transaction.receipts_outcome.some(receipt => !succeeded(receipt?.outcome?.status)))
    return fail("One or more transaction receipts did not execute successfully.");
  if (!account || account.code_hash !== PACT_WASM_CODE_HASH)
    return fail("The contract's currently deployed Wasm does not match PACT's published build.");
  const action = actions.find(a => a?.FunctionCall?.method_name === input.method);
  if (input.method === "commit" &&
      (!/^\d+$/.test(String(action?.FunctionCall?.deposit ?? "")) ||
        BigInt(action.FunctionCall.deposit) === 0n))
    return fail("A funding commitment must attach a positive amount of native NEAR.");
  return {
    verified: true,
    network: "testnet",
    transactionHash: input.transactionHash,
    signerId: input.signerId,
    contractId: input.contractId,
    method: input.method,
    receiptCount: transaction.receipts_outcome.length,
    codeHash: account.code_hash,
    explorerUrl: "https://testnet.nearblocks.io/txns/" + input.transactionHash,
    scope: "Finalized method execution and current PACT Wasm match only; not a payout, deployment or security audit."
  };
}

export async function verifyTestnetProof(input, rpc = jsonRpc) {
  const error = validateProofInput(input);
  if (error) return fail(error);
  let transaction;
  try {
    const response = await rpc("tx", {
      tx_hash: input.transactionHash,
      sender_account_id: input.signerId,
      wait_until: "FINAL"
    });
    transaction = response?.result;
    if (!transaction || response?.error) return fail("The transaction is unavailable from the testnet RPC.");
  } catch {
    return fail("Could not obtain a finalized testnet receipt. Try again when the RPC is available.");
  }
  if (transaction?.transaction?.receiver_id !== input.contractId)
    return fail("The transaction does not target that PACT contract account.");
  let account;
  try {
    const response = await rpc("query", {
      request_type: "view_account",
      account_id: input.contractId,
      finality: "final"
    });
    if (response?.error || !response?.result) return fail("Unable to verify the deployed PACT code hash.");
    account = response.result;
  } catch {
    return fail("Unable to check the deployed contract code against the published PACT build.");
  }
  return inspectTestnetProof(input, transaction, account);
}

export async function jsonRpc(method, params, fetchImpl = fetch) {
  const response = await fetchImpl(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "pact-verify", method, params }),
    signal: AbortSignal.timeout(9000)
  });
  if (!response.ok) throw new Error("NEAR testnet RPC returned HTTP " + response.status);
  const body = await response.text();
  if (body.length > 300000) throw new Error("Oversized response from NEAR RPC");
  return JSON.parse(body);
}
