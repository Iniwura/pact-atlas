import { createNearWalletAdapter } from "./near-adapter.mjs";
import { createTestnetProvider } from "./near-rpc.mjs";

const VERSION = "10.1.4";
// A real faucet-funded PACT contract is used solely to scope the optional
// function-call login permission on routes without a campaign contract.
// Wallet approval is still needed for every state-changing action.
export const DEFAULT_SIGNIN_CONTRACT = "coalition-20261110.beneficiary-20261110.testnet";
const SIGNIN_METHODS = Object.freeze(["status"]);
export function walletSignInOptions(contractId) {
  const id = contractId ?? DEFAULT_SIGNIN_CONTRACT;
  if (typeof id !== "string" || !/^[a-z0-9][a-z0-9._-]*\.testnet$/.test(id))
    throw problem("wallet-unavailable", "The requested NEAR testnet contract is invalid.");
  return { contractId: id, methodNames: [...SIGNIN_METHODS] };
}
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
  if (error?.code === "wallet-signin-failed") return "The wallet did not authorize the connection. Unlock it, check testnet, or choose another wallet.";
  if (error?.code === "wallet-timeout") return "The wallet did not respond. Reopen the chooser and try again.";
  if (error?.code === "wallet-disabled") return "Wallet signing is disabled in this preview. Browse the public records without connecting.";
  const message = String(error?.message || "");
  if (/popup.*block/i.test(message)) return "Your browser blocked the wallet popup. Allow popups for this site and retry.";
  if (/locked/i.test(message)) return "Unlock your NEAR wallet and retry.";
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
// Wallet Selector emits "user-triggered" for cancellations and
// "wallet-navigation" after an authorized wallet handoff. A hidden chooser
// is not necessarily cancelled: browser wallets may still be approving in a
// popup. Do not infer cancellation by observing DOM visibility alone.
export async function waitForWalletAccount(selector, modal, { timeoutMs = 120000 } = {}) {
  if (currentAccount(selector)) return currentAccount(selector);
  return new Promise((resolve, reject) => {
    let settled = false, poll, limit, subscription, modalSubscription;
    function finish(error, account) {
      if (settled) return;
      settled = true;
      clearInterval(poll); clearTimeout(limit);
      subscription?.unsubscribe?.();
      modalSubscription?.remove?.();
      modalSubscription?.unsubscribe?.();
      if (error) reject(error); else resolve(account);
    }
    function check() {
      const account = currentAccount(selector);
      if (account) return finish(null, account);
      // The upstream modal renders this only after the selected wallet's
      // signIn() rejects (e.g. popup closed, locked or wrong network).
      // Do not leave a permanent "Opening wallets" state behind the error.
      if (typeof document !== "undefined" &&
          document.querySelector("#near-wallet-selector-modal .connecting-wrapper-err"))
        finish(problem("wallet-signin-failed", "Wallet sign-in was not completed."));
    }
    try {
      modalSubscription = modal?.on?.("onHide", ({ hideReason }) => {
        if (hideReason === "user-triggered") {
          const account = currentAccount(selector);
          if (account) finish(null, account);
          else finish(problem("wallet-cancelled", "Wallet chooser closed."));
        }
        // wallet-navigation is not cancellation: do not discard a pending
        // popup/redirect sign-in just because the modal has disappeared.
      });
      subscription = selector?.store?.observable?.subscribe?.(check);
      poll = setInterval(check, 250);
      limit = setTimeout(() => finish(problem("wallet-timeout", "Wallet was not connected.")), timeoutMs);
      check();
    } catch (error) { finish(error); }
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
    throw problem("wallet-disabled", "Read-only mode is enabled for this preview.");
  if (window.PACT_NEAR_ADAPTER) return window.PACT_NEAR_ADAPTER;
  if (!selectorPromise) selectorPromise = guarded(setup(),30000).catch(error=>{
    selectorPromise = null;
    if (error.code) throw error;
    throw problem("wallet-unavailable",String(error?.message || "Could not load wallet selector"));
  });
  const {selector,actionCreators,setupModal} = await selectorPromise;
  if (!document.querySelector('link[href*="near-wallet-selector.css"]'))
    throw problem("wallet-unavailable", "Wallet chooser stylesheet missing.");
  const modal = setupModal(selector, walletSignInOptions(contractId));
  // Add the accessible name after the chooser constructs its DOM.
  const showModal = () => {
    modal.show();
    document.querySelector('#near-wallet-selector-modal .close-button')
      ?.setAttribute('aria-label','Close wallet chooser');
  };
  const adapter = createNearWalletAdapter({selector,actionCreators,provider:createTestnetProvider()});
  const connect = async()=>{
    if (!currentAccount(selector)) {
      showModal();
      try {
        await waitForWalletAccount(selector, modal);
      } catch (error) {
        // Do not leave an active chooser visible behind a "timed out" notice.
        // Cancellation is already dismissed by the wallet's close control.
        if (error?.code === "wallet-timeout" || error?.code === "wallet-signin-failed") modal.hide?.();
        throw error;
      }
    }
    return adapter.connect();
  };
  const disconnect = async()=>{
    if (!currentAccount(selector)) return;
    const wallet=await selector.wallet();
    if (!wallet?.signOut) throw problem("wallet-unavailable","Disconnect not supported.");
    await wallet.signOut();
  };
  const subscribeAccount=callback=>selector.store.observable.subscribe(()=>callback(currentAccount(selector)));
  const instance={...adapter,connect,disconnect,chooseWallet:()=>showModal(),
    subscribeAccount,getAccount:()=>currentAccount(selector)};
  window.PACT_NEAR_ADAPTER=instance;
  return instance;
}
export {MODULES as WALLET_SELECTOR_MODULES,VERSION as WALLET_SELECTOR_VERSION};
