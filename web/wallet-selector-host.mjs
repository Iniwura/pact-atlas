/**
 * PACT Atlas — NEAR Connect (NEAR Builders-style account-first wallet flow).
 *
 * Account connection NEVER requests an access key, an allowance or a transfer.
 * Each later state-changing operation requires a separate wallet approval.
 * The existing PACT transaction adapter enforces exact requests/finality.
 */
import { createNearWalletAdapter } from "./near-adapter.mjs";
import { createTestnetProvider } from "./near-rpc.mjs";

export const NEAR_CONNECT_VERSION = "0.12.0";
export const NEAR_CONNECT_MODULE = "https://esm.sh/@hot-labs/near-connect@" + NEAR_CONNECT_VERSION + "?bundle";
export const CONNECT_OPTIONS = Object.freeze({
  network: "testnet",
  autoConnect: false,
  features: { testnet: true, signInWithoutAddKey: true, signAndSendTransaction: true },
  // Retired MyNearWallet and unavailable CLI are not functional choices in a browser.
  excludedWallets: ["my-near-wallet", "near-cli", "wallet-connect", "ethereum-wallets"],
});
let setupPromise;

function problem(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}
export function readableWalletError(error) {
  if (error?.code === "wallet-disabled") return "Wallet connections are disabled in this preview. Public proof stays available.";
  if (error?.code === "wallet-cancelled") return "Wallet selection closed. Nothing was connected or signed.";
  if (error?.code === "wallet-unavailable") return "Wallet connections are temporarily unavailable. Browse public records and retry later.";
  if (error?.code === "wallet-timeout") return "The wallet did not respond. Unlock your wallet and retry.";
  const message = String(error?.message || "");
  if (/user rejected|denied|cancel|closed|reject/i.test(message)) return "Wallet approval was cancelled. Nothing was signed.";
  if (/popup.*block/i.test(message)) return "Allow wallet popups for this site and retry.";
  if (/locked/i.test(message)) return "Unlock your NEAR testnet wallet and retry.";
  if (/network|failed to fetch|load|timeout|module|chunk/i.test(message)) return "Wallet or network unavailable. Check your connection.";
  if (/account|not installed|not found|no wallet/i.test(message)) return "Unlock a supported NEAR testnet wallet and select an account.";
  return "Wallet connection was not completed. Nothing was signed.";
}
export function connectorSettings() {
  return {
    network: CONNECT_OPTIONS.network,
    autoConnect: CONNECT_OPTIONS.autoConnect,
    features: { ...CONNECT_OPTIONS.features },
    excludedWallets: [...CONNECT_OPTIONS.excludedWallets]
  };
}
async function setup() {
  const { NearConnector } = await import(NEAR_CONNECT_MODULE);
  if (typeof NearConnector !== "function") throw problem("wallet-unavailable", "NEAR Connect did not load.");
  const connector = new NearConnector(connectorSettings());
  await connector.whenManifestLoaded;
  if (!connector.availableWallets?.length) throw problem("wallet-unavailable", "No compatible testnet wallet was found.");
  return connector;
}
function currentAccountId(accounts) {
  return accounts?.find?.(a => typeof a?.accountId === "string" && a.accountId.endsWith(".testnet"))?.accountId ?? null;
}
export async function ensureWalletAdapter() {
  if (typeof window === "undefined" || window.PACT_DISABLE_WALLET_SELECTOR)
    throw problem("wallet-disabled", "Read-only mode is enabled for this preview.");
  if (window.PACT_NEAR_ADAPTER) return window.PACT_NEAR_ADAPTER;
  if (!setupPromise) setupPromise = setup().catch(e => { setupPromise = null; throw e; });
  const connector = await setupPromise;
  let accountId = null;
  const observers = new Set();
  const notify = () => { for (const listener of [...observers]) listener(accountId); };
  connector.on("wallet:signIn", ({ accounts }) => {
    const next = currentAccountId(accounts);
    if (next) { accountId = next; notify(); }
  });
  connector.on("wallet:signOut", () => { accountId = null; notify(); });

  // Uses the wallet's real connector signing interface. No mock signatures.
  const walletBridge = {
    getAccounts: async () => {
      const signed = await connector.getConnectedWallet().catch(() => null);
      return signed?.accounts ?? [];
    },
    signAndSendTransaction: async request => {
      const signed = await connector.getConnectedWallet();
      if (!currentAccountId(signed.accounts)) throw problem("wallet-unavailable", "Testnet account not authorized.");
      return signed.wallet.signAndSendTransaction(request);
    },
  };
  const transactionAdapter = createNearWalletAdapter({
    wallet: walletBridge,
    provider: createTestnetProvider(),
  });
  async function connect() {
    if (accountId) return accountId;
    // Calling connect() without addFunctionCallKey is intentional: zero gas
    // required to view the connected account; permission is per transaction.
    const wallet = await connector.connect();
    const accounts = await wallet.getAccounts();
    const next = currentAccountId(accounts);
    if (!next) throw problem("wallet-unavailable", "The wallet returned no NEAR testnet account.");
    accountId = next;
    notify();
    return transactionAdapter.connect();
  }
  async function disconnect() {
    if (!accountId) return;
    await connector.disconnect();
    accountId = null;
    notify();
  }
  function chooseWallet() {
    void connector.connect().then(async wallet => {
      const next = currentAccountId(await wallet.getAccounts());
      if (next) { accountId = next; notify(); }
    }).catch(error => {
      // Keep the existing connected account if switching was cancelled.
      if (!accountId) console.warn("Wallet selection ended:", readableWalletError(error));
    });
  }
  const instance = {
    ...transactionAdapter,
    connect, disconnect, chooseWallet,
    getAccount: () => accountId,
    subscribeAccount: listener => {
      observers.add(listener);
      return { unsubscribe: () => observers.delete(listener) };
    },
  };
  window.PACT_NEAR_ADAPTER = instance;
  return instance;
}
