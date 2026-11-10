/** Free, read-only NEAR testnet RPC access. No credentials or signing. */
export const TESTNET_RPC_URL = "https://rpc.testnet.fastnear.com";

function base64Json(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function rpcQuery(request, { fetchImpl = fetch, rpcUrl = TESTNET_RPC_URL } = {}) {
  const response = await fetchImpl(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "pact-atlas", method: "query", params: request }),
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error(`NEAR testnet RPC returned HTTP ${response.status}`);
  const body = await response.json();
  if (body.error || !body.result) throw new Error(body.error?.cause?.[0]?.name || "NEAR testnet RPC returned no result");
  return body.result;
}

export async function viewMethod({ contractId, methodName, args = {} }, options = {}) {
  const result = await rpcQuery({
    request_type: "call_function",
    account_id: contractId,
    method_name: methodName,
    args_base64: base64Json(args),
    finality: "final",
  }, options);
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(result.result)));
}

export function createTestnetProvider(options = {}) {
  return { query: async request => {
    if (request.request_type === "call_function") {
      const value = await viewMethod({
        contractId: request.account_id,
        methodName: request.method_name,
        args: request.args_base64 ? JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(request.args_base64), character => character.charCodeAt(0)))) : {},
      }, options);
      return { result: [...new TextEncoder().encode(JSON.stringify(value))] };
    }
    if (request.request_type === "tx") {
      const result = await rpcQuery({ request_type: "tx", tx_hash: request.tx_hash, sender_account_id: request.sender_account_id, wait_until: "FINAL" }, options);
      return result;
    }
    return rpcQuery(request, options);
  } };
}

export function explorerUrl(transactionHash) {
  return `https://testnet.nearblocks.io/txns/${encodeURIComponent(transactionHash)}`;
}
