/**
 * Optional host adapter for HOT Connect or NEAR Wallet Selector.
 *
 * The preview does not import a wallet package, hold keys, or sign implicitly.
 * An authorized host supplies a connected wallet instance and, for Wallet
 * Selector v10, its actionCreators.functionCall implementation.
 */

function accountIdOf(account) {
  if (typeof account === "string") return account;
  return account?.accountId ?? account?.account_id ?? account?.id ?? null;
}

function transactionHashOf(result) {
  return result?.transactionHash
    ?? result?.txHash
    ?? result?.hash
    ?? result?.transaction?.hash
    ?? result?.transaction_outcome?.id
    ?? null;
}

const succeeded = status => !!status && typeof status === "object" &&
  (Object.prototype.hasOwnProperty.call(status, "SuccessValue") ||
   Object.prototype.hasOwnProperty.call(status, "SuccessReceiptId"));

/**
 * A returned hash proves submission at most. Only fully finalized successful
 * action/receipt results may be presented as confirmed. Do not retry an
 * unknown transaction: it might already have executed.
 */
export function finalityOf(result) {
  if (result?.final_execution_status !== "FINAL") return "unknown";
  if (result?.status && typeof result.status === "object" &&
      Object.prototype.hasOwnProperty.call(result.status, "Failure")) return "failed";
  if (!succeeded(result?.status) ||
      !succeeded(result?.transaction_outcome?.outcome?.status) ||
      !Array.isArray(result?.receipts_outcome)) return "unknown";
  if (result.receipts_outcome.some(receipt => !succeeded(receipt?.outcome?.status))) return "failed";
  return "confirmed";
}

function base64Json(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function accountsFor(wallet) {
  if (typeof wallet?.getAccounts !== "function") return [];
  return (await wallet.getAccounts()) ?? [];
}

function makeInternalFunctionCall(request) {
  return {
    type: "FunctionCall",
    params: {
      methodName: request.methodName,
      args: request.args ?? {},
      gas: request.gas,
      deposit: request.deposit,
    },
  };
}

function makeInternalAction(action) {
  if (action.type === "FunctionCall") return makeInternalFunctionCall(action);
  if (action.type === "CreateAccount") return { type: "CreateAccount" };
  if (action.type === "Transfer") return { type: "Transfer", params: { deposit: action.deposit } };
  if (action.type === "DeployContract") return { type: "DeployContract", params: { code: action.code } };
  throw new Error(`Unsupported wallet action: ${action.type}`);
}

function makeAction(action, creators = {}, legacyFunctionCall) {
  if (action.type === "FunctionCall") {
    if (legacyFunctionCall) return legacyFunctionCall(action.methodName, action.args ?? {}, BigInt(action.gas), BigInt(action.deposit));
    if (typeof creators.functionCall !== "function") return makeInternalAction(action);
    return creators.functionCall(action.methodName, action.args ?? {}, BigInt(action.gas), BigInt(action.deposit));
  }
  const creator = creators[action.type[0].toLowerCase() + action.type.slice(1)];
  if (typeof creator === "function") {
    if (action.type === "Transfer") return creator(BigInt(action.deposit));
    if (action.type === "DeployContract") return creator(action.code);
    return creator();
  }
  return makeInternalAction(action);
}

/**
 * Create the narrow adapter consumed by web/app.js.
 *
 * `wallet` is a HOT Connect or Wallet Selector-compatible wallet. `connector`
 * may be supplied for HOT Connect and `selector` for Wallet Selector; the
 * host remains responsible for choosing a wallet and presenting its UI.
 * `functionCall` should be `actionCreators.functionCall` for Wallet Selector
 * v10. Without it, the legacy internal action shape is used, which HOT
 * Connect supports for compatibility.
 */
export function createNearWalletAdapter({
  wallet,
  connector,
  selector,
  walletId,
  accountId,
  functionCall,
  actionCreators = {},
  provider,
  viewMethod,
  signInOptions = {},
} = {}) {
  let activeWallet = wallet ?? null;
  let activeAccountId = accountId ?? null;

  const resolveWallet = async () => {
    if (selector && typeof selector.wallet === "function") {
      const selected = await selector.wallet(walletId);
      if (selected) { activeWallet = selected; return selected; }
    }
    if (activeWallet) return activeWallet;
    if (connector && typeof connector.wallet === "function") activeWallet = await connector.wallet();
    if (!activeWallet) throw new Error("No HOT Connect or Wallet Selector wallet is configured");
    return activeWallet;
  };

  const connect = async () => {
    if (connector && typeof connector.connect === "function") await connector.connect();
    const resolved = await resolveWallet();
    let accounts = await accountsFor(resolved);
    if (!accounts.length && typeof resolved.signIn === "function" && Object.keys(signInOptions).length) {
      accounts = (await resolved.signIn(signInOptions)) ?? [];
    }
    activeAccountId = accountIdOf(accounts[0]) ?? accountId ?? null;
    if (!activeAccountId) throw new Error("Wallet connected without a signed-in account");
    return activeAccountId;
  };

  const call = async (request) => {
    const resolved = await resolveWallet();
    const actions = request.actions?.map(action => makeAction(action, actionCreators, functionCall))
      ?? [makeAction({
        type: "FunctionCall",
        methodName: request.methodName,
        args: request.args,
        gas: request.gas,
        deposit: request.deposit,
      }, actionCreators, functionCall)];
    const result = await resolved.signAndSendTransaction({
      signerId: request.signerId ?? activeAccountId ?? undefined,
      receiverId: request.contractId,
      actions,
    });
    const hash = transactionHashOf(result);
    if (!hash) throw new Error("Wallet returned no transaction hash; confirmation is unknown");
    const finality = finalityOf(result);
    if (finality === "failed") throw new Error("Transaction " + hash + " failed on-chain. Check the explorer before any retry.");
    return { result, transactionHash: hash, confirmed: finality === "confirmed" };
  };

  const confirm = async ({ transactionHash, senderId = activeAccountId } = {}) => {
    if (!transactionHash) throw new Error("A transaction hash is required for finality checking");
    if (!senderId) throw new Error("The connected signer is required for finality checking");
    if (!provider || typeof provider.query !== "function") throw new Error("No NEAR provider is configured for finality checking");
    const result = await provider.query({ request_type: "tx", tx_hash: transactionHash, sender_account_id: senderId, finality: "final" });
    const finality = finalityOf(result);
    if (finality === "failed") throw new Error(`Transaction ${transactionHash} failed on-chain. Check the explorer before any retry.`);
    return { result, transactionHash, confirmed: finality === "confirmed" };
  };

  const view = async ({ contractId, methodName, args = {} }) => {
    if (typeof viewMethod === "function") return viewMethod({ contractId, methodName, args });
    if (!provider || typeof provider.query !== "function") throw new Error("No NEAR view provider is configured");
    const response = await provider.query({
      request_type: "call_function",
      account_id: contractId,
      method_name: methodName,
      args_base64: base64Json(args),
      finality: "final",
    });
    return JSON.parse(new TextDecoder().decode(new Uint8Array(response.result)));
  };

  const codeHash = async (contractId) => {
    if (!provider || typeof provider.query !== "function") throw new Error("No NEAR provider is configured for code verification");
    const response = await provider.query({ request_type: "view_code", account_id: contractId, finality: "final" });
    if (typeof response?.hash !== "string" || !response.hash) throw new Error("NEAR provider returned no contract code hash");
    return response.hash;
  };

  return { connect, call, confirm, view, codeHash };
}

export { accountIdOf, transactionHashOf };
