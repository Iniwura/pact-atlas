import { MODEL, evaluate } from "./engine.mjs";

export const TESTNET_GAS = "300000000000000";
export const ONE_NEAR = "1000000000000000000000000";

function encodeJson(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function contractIdFor(config) {
  const contractId = config?.pactContractId ?? config?.contractId;
  if (!contractId) throw new Error("PACT testnet contract ID is not configured");
  return contractId;
}

function certificateFor(targetKey = "abc") {
  const result = evaluate(targetKey);
  const plan = result.plans[0];
  if (!plan) throw new Error(`No exact allocation certificate exists for ${targetKey}`);
  const indexes = new Map(MODEL.pledges.map((pledge, index) => [pledge.id, index]));
  return plan.allocations
    .filter(Boolean)
    .map((allocation) => ({ pledge_index: indexes.get(allocation.pledge), project_id: allocation.project }));
}

/**
 * Build one explicit request for a host wallet adapter. This module does not
 * sign, submit, retry, or mutate DAO-approved conditions. A HOT Connect or
 * Wallet Selector host can translate this narrow request into its own wallet
 * API and return the confirmed result.
 */
export function buildWorkflowRequest(action, { config = {}, targetKey = "abc" } = {}) {
  if (action === "certify") {
    return {
      kind: "local-certificate",
      targetKey,
      allocations: certificateFor(targetKey),
      exact: true,
    };
  }
  const contractId = contractIdFor(config);
  if (action === "commit") {
    return {
      contractId,
      methodName: "commit",
      args: { allowed: ["a", "d"], requires: [] },
      deposit: (3n * BigInt(ONE_NEAR)).toString(),
      gas: TESTNET_GAS,
    };
  }
  if (action === "activate") {
    return {
      contractId,
      methodName: "activate",
      args: { allocations: certificateFor(targetKey) },
      deposit: "0",
      gas: TESTNET_GAS,
    };
  }
  if (action === "withdraw") {
    return { contractId, methodName: "withdraw", args: {}, deposit: "0", gas: TESTNET_GAS };
  }
  if (action === "approve") {
    const daoId = config.daoContractId ?? config.daoId;
    if (!daoId) throw new Error("Sputnik DAO contract ID is not configured");
    const commitArgs = { allowed: ["a", "d"], requires: [] };
    return {
      contractId: daoId,
      methodName: "add_proposal",
      args: {
        proposal: {
          description: "PACT Atlas testnet commitment: 3 NEAR toward the connected coalition",
          kind: {
            FunctionCall: {
              receiver_id: contractId,
              actions: [{
                method_name: "commit",
                args: encodeJson(commitArgs),
                deposit: ONE_NEAR,
                gas: TESTNET_GAS,
              }],
            },
          },
        },
      },
      deposit: ONE_NEAR,
      gas: TESTNET_GAS,
    };
  }
  throw new Error(`Unsupported workflow action: ${action}`);
}

export function reconciliationViews(config = {}) {
  const contractId = contractIdFor(config);
  return [
    { contractId, methodName: "status", args: {} },
    { contractId, methodName: "accounting", args: {} },
  ];
}

export { certificateFor };
