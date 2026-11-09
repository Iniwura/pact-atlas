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
  provider,
  viewMethod,
  signInOptions = {},
} = {}) {
  let activeWallet = wallet ?? null;
  let activeAccountId = accountId ?? null;

  const resolveWallet = async () => {
    if (activeWallet) return activeWallet;
    if (connector && typeof connector.wallet === "function") activeWallet = await connector.wallet();
    if (!activeWallet && selector && typeof selector.wallet === "function") activeWallet = await selector.wallet(walletId);
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
    activeAccountId = activeAccountId ?? accountIdOf(accounts[0]);
    if (!activeAccountId) throw new Error("Wallet connected without a signed-in account");
    return activeAccountId;
  };

  const call = async (request) => {
    const resolved = await resolveWallet();
    const action = functionCall
      ? functionCall(request.methodName, request.args ?? {}, BigInt(request.gas), BigInt(request.deposit))
      : makeInternalFunctionCall(request);
    const result = await resolved.signAndSendTransaction({
      signerId: activeAccountId ?? undefined,
      receiverId: request.contractId,
      actions: [action],
    });
    const hash = transactionHashOf(result);
    if (!hash) throw new Error("Wallet returned no transaction hash; confirmation is unknown");
    const finality = finalityOf(result);
    if (finality === "failed") throw new Error("Transaction " + hash + " failed on-chain. Check the explorer before any retry.");
    return { result, transactionHash: hash, confirmed: finality === "confirmed" };
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

  return { connect, call, view };
}

export { accountIdOf, transactionHashOf };
