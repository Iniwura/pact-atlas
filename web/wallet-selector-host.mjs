import { createNearWalletAdapter } from "./near-adapter.mjs";
import { createTestnetProvider } from "./near-rpc.mjs";

const VERSION = "10.1.4";
const BASE = "https://esm.sh/@near-wallet-selector/";
const MODULES = Object.freeze({
  core: BASE + "core@" + VERSION + "?bundle",
  modal: BASE + "modal-ui-js@" + VERSION + "?bundle",
  meteorWallet: BASE + "meteor-wallet@" + VERSION + "?bundle&deps=near-api-js@5.1.1",
  sender: BASE + "sender@" + VERSION + "?bundle",
  nightly: BASE + "nightly@" + VERSION + "?bundle",
  myNearWallet: BASE + "my-near-wallet@" + VERSION + "?bundle",
});
let selectorPromise;

function problem(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}
export function readableWalletError(error) {
  if (error?.code === "wallet-cancelled") return "Wallet selection closed. Nothing was connected or signed.";
  if (error?.code === "wallet-unavailable") return "The wallet chooser could not load. Check your connection and try again.";
  if (error?.code === "wallet-timeout") return "The wallet did not respond. Reopen the chooser and try again.";
  if (error?.code === "wallet-disabled") return "Wallet signing is disabled in this preview. Browse the public records without connecting.";
  const message = String(error?.message || "");
  if (/reject|denied|cancelled|canceled|closed/i.test(message)) return "Wallet approval was cancelled. No transaction was submitted by PACT.";
  if (/network|failed to fetch|load|timeout|module|chunk/i.test(message)) return "The wallet or network is unavailable. Check your connection and retry.";
  if (/account|not installed|not found/i.test(message)) return "No testnet account is available. Choose MyNearWallet or an installed NEAR wallet.";
  return "Wallet connection could not be completed. No transaction was signed. Try another wallet.";
}
function currentAccount(selector) {
  const accounts = selector?.store?.getState?.()?.accounts || [];
  return accounts.find(item => item?.active)?.accountId || accounts[0]?.accountId || null;
}
async function guarded(work, ms) {
  let timer;
  return Promise.race([
    work,
    new Promise((_, reject) => timer = setTimeout(() => reject(problem("wallet-timeout", "Wallet chooser took too long.")), ms)),
  ]).finally(() => clearTimeout(timer));
}
async function waitForAccount(selector) {
  if (currentAccount(selector)) return currentAccount(selector);
  return new Promise((resolve, reject) => {
    let settled = false, seenOpen = false, closedAt = null;
    let poll, limit, subscription;
    function finish(error, account) {
      if (settled) return;
      settled = true;
      clearInterval(poll);clearTimeout(limit);subscription?.unsubscribe?.();
      if (error) reject(error);else resolve(account);
    }
    function check() {
      const account = currentAccount(selector);
      if (account) return finish(null, account);
      if (document.visibilityState === "hidden") return;
      const wrapper = document.querySelector("#near-wallet-selector-modal .nws-modal-wrapper");
      if (wrapper?.classList.contains("open")) {seenOpen = true;closedAt = null;}
      else if (seenOpen) {
        if (closedAt === null) closedAt = Date.now();
        if (Date.now() - closedAt > 750) finish(problem("wallet-cancelled", "Wallet chooser closed."));
      }
    }
    try {
      subscription = selector?.store?.observable?.subscribe?.(check);
      poll = setInterval(check, 250);
      limit = setTimeout(() => finish(problem("wallet-timeout", "Wallet was not connected.")), 90000);
      check();
    } catch (error) {finish(error);}
  });
}
async function setup() {
  const [{setupWalletSelector,actionCreators},{setupModal},{setupMeteorWallet},
    {setupSender},{setupNightly},{setupMyNearWallet}] = await Promise.all([
      import(MODULES.core),import(MODULES.modal),import(MODULES.meteorWallet),
      import(MODULES.sender),import(MODULES.nightly),import(MODULES.myNearWallet),
    ]);
  const selector = await setupWalletSelector({
    network:"testnet",
    modules:[setupMeteorWallet(),setupSender(),setupNightly(),setupMyNearWallet()],
  });
  return {selector,actionCreators,setupModal};
}
export async function ensureWalletAdapter({contractId}={}) {
  if (typeof window === "undefined" || window.PACT_DISABLE_WALLET_SELECTOR)
    throw problem("wallet-disabled", "Wallet signing disabled.");
  if (window.PACT_NEAR_ADAPTER) return window.PACT_NEAR_ADAPTER;
  if (!selectorPromise) selectorPromise = guarded(setup(),30000).catch(error=>{
    selectorPromise = null;
    if (error.code) throw error;
    throw problem("wallet-unavailable",String(error?.message || "Could not load wallet selector"));
  });
  const {selector,actionCreators,setupModal} = await selectorPromise;
  if (!document.querySelector('link[href*="near-wallet-selector.css"]'))
    throw problem("wallet-unavailable", "Wallet chooser stylesheet missing.");
  const modal = setupModal(selector,contractId?{contractId}:{});
  const adapter = createNearWalletAdapter({selector,actionCreators,provider:createTestnetProvider()});
  const connect = async()=>{
    if (!currentAccount(selector)) {modal.show();await waitForAccount(selector);}
    return adapter.connect();
  };
  const disconnect = async()=>{
    if (!currentAccount(selector)) return;
    const wallet=await selector.wallet();
    if (!wallet?.signOut) throw problem("wallet-unavailable","Disconnect not supported.");
    await wallet.signOut();
  };
  const subscribeAccount=callback=>selector.store.observable.subscribe(()=>callback(currentAccount(selector)));
  const instance={...adapter,connect,disconnect,chooseWallet:()=>modal.show(),
    subscribeAccount,getAccount:()=>currentAccount(selector)};
  window.PACT_NEAR_ADAPTER=instance;
  return instance;
}
export {MODULES as WALLET_SELECTOR_MODULES,VERSION as WALLET_SELECTOR_VERSION};

