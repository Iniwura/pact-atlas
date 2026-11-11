import { createNearWalletAdapter } from "./near-adapter.mjs";
import { createTestnetProvider } from "./near-rpc.mjs";

// Pinned public packages keep the static preview dependency-free while still
// providing a real testnet wallet path. No wallet code is loaded until the
// user presses a connect/deploy/contribute control.
const VERSION = "10.1.4";
const MODULES = Object.freeze({
  core: `https://esm.sh/@near-wallet-selector/core@${VERSION}?bundle`,
  modal: `https://esm.sh/@near-wallet-selector/modal-ui-js@${VERSION}?bundle`,
  // Meteor imports near-api-js by package name. Pin the same API major used by
  // this release so esm.sh cannot silently resolve a newer export surface.
  meteorWallet: `https://esm.sh/@near-wallet-selector/meteor-wallet@${VERSION}?bundle&deps=near-api-js@5.1.1`,
  // Sender is optional: its official injected module is only available when the
  // authentic extension is installed in the user's browser. PACT's contribution
  // path uses FunctionCall actions, the action type Sender supports.
  sender: `https://esm.sh/@near-wallet-selector/sender@${VERSION}?bundle`,
  // Nightly is the final optional fallback for this release's browser proof.
  nightly: `https://esm.sh/@near-wallet-selector/nightly@${VERSION}?bundle`,
});

let selectorPromise;

function currentAccount(selector) {
  return selector?.store?.getState?.().accounts?.[0]?.accountId ?? null;
}

async function waitForAccount(selector) {
  const existing = currentAccount(selector);
  if (existing) return existing;
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer;
    let timeout;
    let subscription;
    const finish = (error, account) => {
      if (settled) return;
      settled = true;
      clearInterval(timer);
      clearTimeout(timeout);
      subscription?.unsubscribe?.();
      if (error) reject(error); else resolve(account);
    };
    subscription = selector?.store?.observable?.subscribe?.(state => {
      const account = state?.accounts?.[0]?.accountId;
      if (account) finish(null, account);
    });
    timer = setInterval(() => {
      const account = currentAccount(selector);
      if (account) finish(null, account);
    }, 500);
    timeout = setTimeout(() => finish(new Error("Wallet connection was not completed.")), 120_000);
  });
}

async function setup() {
  const [{ setupWalletSelector, actionCreators }, { setupModal }, { setupMeteorWallet }, { setupSender }, { setupNightly }] = await Promise.all([
    import(MODULES.core),
    import(MODULES.modal),
    import(MODULES.meteorWallet),
    import(MODULES.sender),
    import(MODULES.nightly),
  ]);
  const selector = await setupWalletSelector({
    network: "testnet",
    modules: [setupMeteorWallet(), setupSender(), setupNightly()],
  });
  return { selector, actionCreators, setupModal };
}

export async function ensureWalletAdapter({ contractId } = {}) {
  if (window.PACT_NEAR_ADAPTER) return window.PACT_NEAR_ADAPTER;
  if (window.PACT_DISABLE_WALLET_SELECTOR) throw new Error("Read-only mode is enabled for this preview.");
  if (!selectorPromise) selectorPromise = setup();
  const { selector, actionCreators, setupModal } = await selectorPromise;
  const modalOptions = contractId ? { contractId } : {};
  const modal = setupModal(selector, modalOptions);
  const provider = createTestnetProvider();
  const adapter = createNearWalletAdapter({ selector, actionCreators, provider });
  const connect = async () => {
    const existing = currentAccount(selector);
    if (!existing) {
      modal.show();
      await waitForAccount(selector);
    }
    return adapter.connect();
  };
  window.PACT_NEAR_ADAPTER = { ...adapter, connect };
  return window.PACT_NEAR_ADAPTER;
}

export { MODULES as WALLET_SELECTOR_MODULES, VERSION as WALLET_SELECTOR_VERSION };
