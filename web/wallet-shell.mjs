/* One wallet control across every PACT app route, with genuine SDK rehydration. */
import { ensureWalletAdapter, readableWalletError } from "./wallet-selector-host.mjs";
import { notifyUser } from "./notification-center.mjs";

const button = document.getElementById("connect-wallet");
const disconnectButton = document.getElementById("wallet-disconnect");
const message = document.getElementById("wallet-message");
let adapter = null, subscription = null, busy = false;
let accountId = "";

function display(account, explanation = "") {
  accountId = typeof account === "string" && account.endsWith(".testnet") ? account : "";
  document.body.dataset.walletState = accountId ? "connected" : "disconnected";
  if (button) {
    button.dataset.connected = String(Boolean(accountId));
    button.dataset.accountId = accountId;
    button.textContent = accountId ? accountId + " ↗" : "Connect wallet ↗";
    button.title = accountId ? "Switch wallet: " + accountId : "Connect a NEAR testnet wallet";
    button.setAttribute("aria-label", accountId ? "Connected as " + accountId + ". Change wallet" : "Connect a NEAR testnet wallet");
  }
  if (disconnectButton) {
    disconnectButton.hidden = !accountId;
    disconnectButton.setAttribute("aria-label", accountId ? "Disconnect " + accountId : "Disconnect wallet");
  }
  if (message) {
    message.dataset.state = accountId ? "ok" : (explanation ? "error" : "");
    message.textContent = explanation || (accountId
      ? "Connected to NEAR testnet as " + accountId + ". Every transaction requires separate wallet approval."
      : "Wallet not connected. Public records remain available without signing.");
  }
}
function update(account) {
  display(account);
}
function attach(nextAdapter) {
  if (adapter === nextAdapter) return;
  subscription?.unsubscribe?.();
  adapter = nextAdapter;
  subscription = adapter.subscribeAccount?.(update) || null;
}
async function connect() {
  if (!button || busy) return;
  busy = true; button.disabled = true; button.setAttribute("aria-busy", "true");
  const previous = accountId;
  try {
    if (previous && adapter) {
      adapter.chooseWallet?.();
      notifyUser("info", "Choose a different wallet, or close the selector to keep the current account.", {title:"Switch wallet"});
      return;
    }
    button.textContent = "Opening wallets…";
    if (message) { message.dataset.state = "pending"; message.textContent = "Opening the wallet selector. Connecting does not send funds."; }
    const active = adapter || await ensureWalletAdapter();
    attach(active);
    const account = await active.connect();
    if (!account || !account.endsWith(".testnet")) throw new Error("No NEAR testnet account was returned");
    display(account);
    notifyUser("success", "Connected to NEAR testnet as " + account + ". Each transaction needs separate approval.", {title:"Wallet connected"});
  } catch (error) {
    const text = readableWalletError(error);
    display(previous, previous ? "" : "Connection not completed. " + text);
    // User cancellation is a normal exit, not a transaction error.
    if (/cancel|reject|closed|selection/i.test(String(error?.message || ""))) {
      notifyUser("info", "Wallet selection closed. No transaction was sent.", {title:"Connection cancelled"});
    } else {
      notifyUser("error", text, {title:"Wallet connection failed"});
    }
  } finally {
    busy = false;
    button.disabled = false;
    button.removeAttribute("aria-busy");
  }
}
async function disconnect() {
  if (!disconnectButton || busy) return;
  busy = true; disconnectButton.disabled = true;
  try {
    if (!adapter) attach(await ensureWalletAdapter());
    await adapter.disconnect();
    display("");
    notifyUser("success", "Wallet disconnected. No funds or transactions were affected.", {title:"Disconnected"});
  } catch (error) {
    const text = readableWalletError(error);
    notifyUser("error", text, {title:"Could not disconnect"});
    display(accountId);
  } finally {
    busy = false; disconnectButton.disabled = false;
  }
}
async function restore() {
  if (window.PACT_DISABLE_WALLET_SELECTOR) return;
  // SDK stores the selected wallet ID, never a claimed connected account ID.
  // Re-read the actual account rather than trust localStorage as proof.
  try {
    if (!localStorage.getItem("selected-wallet")) return;
    const active = await ensureWalletAdapter();
    attach(active);
    display(active.getAccount?.());
  } catch {
    display("");
    // Continue read-only; do not make offline wallet restore an app-wide error.
  }
}
if (button) button.addEventListener("click", connect);
if (disconnectButton) disconnectButton.addEventListener("click", disconnect);
window.addEventListener("pact:wallet-account", event => {
  const next = event.detail?.accountId || "";
  if (next !== accountId) {
    display(next);
    if (next) notifyUser("success", "Wallet ready: " + next, {title:"Wallet connected"});
  }
});
// A wallet can connect during an explicit deploy/commit flow on another page.
void restore();
