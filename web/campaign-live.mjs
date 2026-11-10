import {
  buildCampaignActivationRequest,
  buildCampaignCommitRequest,
  buildCampaignExpireRequest,
  buildCampaignWithdrawRequest,
  campaignFromShareToken,
  isTestnetAccount,
  liveCampaignViews,
} from "./campaign-chain.mjs";
import { authenticateCampaignConfig, candidateFromOnchainPledges } from "./campaign-live-data.mjs";
import { ensureWalletAdapter } from "./wallet-selector-host.mjs";
import { explorerUrl, viewCodeHash, viewMethod } from "./near-rpc.mjs";

const $ = selector => document.querySelector(selector);
const yocto = value => BigInt(String(value ?? "0"));
const formatNear = value => {
  const amount = yocto(value);
  const whole = amount / 1_000_000_000_000_000_000_000_000n;
  const fraction = (amount % 1_000_000_000_000_000_000_000_000n).toString().padStart(24, "0").slice(0, 3).replace(/0+$/, "");
  return `${whole}${fraction ? `.${fraction}` : ""} NEAR`;
};
const element = (tag, className = "", text = undefined) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = String(text); return node; };

const params = new URLSearchParams(location.search);
const contractId = params.get("contract");
let campaign;
let live = { status: null, accounting: null, certificate: [], config: null, pledges: [], codeHash: null, authenticated: false, verified: false, configError: null, pledgeError: null, claimable: null, pending: null };
let adapter = null;
let accountId = null;
let refreshSequence = 0;
const pendingActions = new Set();

function showMessage(selector, message, tone = "neutral") {
  const node = $(selector); node.textContent = message; node.dataset.tone = tone; node.hidden = false;
}

function projectById(id) { return campaign.projects.find(project => project.id === id); }

function renderHeader() {
  $("#campaign-title").textContent = campaign.title || "PACT funding campaign";
  $("#campaign-subtitle").textContent = `${campaign.projects.length} projects · ${campaign.supporters?.length || 0} planned commitments · exact conditions enforced by the deployed contract.`;
  $("#campaign-id").textContent = contractId;
  $("#campaign-explorer").href = `https://testnet.nearblocks.io/address/${encodeURIComponent(contractId)}`;
  $("#authority-label").textContent = campaign.activationAuthority ? `Activation authority: ${campaign.activationAuthority}` : "Activation authority is fixed in the deployed contract";
}

function renderProjects() {
  const holder = $("#campaign-projects"); holder.replaceChildren();
  campaign.projects.forEach((project, index) => {
    const card = element("article", "campaign-project-card");
    const header = element("header"); header.append(element("span", "", `PROJECT ${String(index + 1).padStart(2, "0")}`), element("span", "", project.id.toUpperCase()));
    const title = element("h3", "", project.name); const goal = element("div", "project-goal"); goal.append(element("span", "", "required"), element("strong", "", `${project.goal} NEAR`));
    const deps = element("p", "project-deps"); deps.append(element("strong", "", project.dependencies?.length ? "Depends on: " : "Independent: "), document.createTextNode(project.dependencies?.length ? project.dependencies.map(id => projectById(id)?.name || id).join(", ") : "can activate without another project"));
    card.append(header, title, goal, deps); card.dataset.project = project.id; holder.append(card);
  });
}

function renderSupporterOptions() {
  const select = $("#supporter-plan"); select.replaceChildren();
  const supporters = campaign.supporters || [];
  supporters.forEach((supporter, index) => {
    const option = element("option", "", `${supporter.name || `Supporter ${index + 1}`} · ${supporter.amount} NEAR`);
    option.value = String(index); select.append(option);
  });
  if (!supporters.length) {
    const option = element("option", "", "Custom contribution"); option.value = "-1"; select.append(option);
  }
  select.addEventListener("change", renderPlannedContribution);
  renderPlannedContribution();
}

function checkboxGroup(holder, values, name, disabled = false) {
  holder.replaceChildren();
  campaign.projects.forEach(project => {
    const label = element("label", "check-choice"); const input = document.createElement("input"); input.type = "checkbox"; input.value = project.id; input.name = name; input.checked = values.includes(project.id); input.disabled = disabled;
    label.append(input, element("span", "", project.name)); holder.append(label);
  });
}

function renderPlannedContribution() {
  const index = Number($("#supporter-plan").value); const supporter = campaign.supporters?.[index];
  $("#commit-amount").value = supporter?.amount ?? 1;
  checkboxGroup($("#allowed-projects"), supporter?.allowed ?? campaign.projects.map(project => project.id), "allowed");
  checkboxGroup($("#required-projects"), supporter?.requires ?? [], "requires");
}

function selectedValues(name) { return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(input => input.value); }

function renderStatus() {
  const status = live.status; const accounting = live.accounting;
  $("#live-phase").textContent = status?.phase || "Unavailable";
  $("#live-window").textContent = status ? `opens ${new Date(Number(status.activate_after_ms)).toLocaleString()} · expires ${new Date(Number(status.deadline_ms)).toLocaleString()}` : "—";
  const required = campaign.projects.reduce((total, project) => total + Number(project.goal || 0), 0);
  $("#live-committed").textContent = accounting ? formatNear(accounting.locked_pledges) : "—";
  $("#live-required").textContent = `${required} NEAR required across the full coalition`;
  $("#live-pledges").textContent = status ? String(status.pledge_count) : "—";
  $("#live-liabilities").textContent = accounting ? formatNear(accounting.liabilities) : "—";
  $("#live-solvency").textContent = accounting ? (accounting.solvent ? "accounting identity reconciles" : "solvency check failed") : "Reconciliation pending";
  document.body.dataset.phase = status?.phase || "unknown";
  renderCertificate();
  renderActionAvailability();
}

function renderActionAvailability() {
  const verified = live.verified === true;
  const open = live.status?.phase === "OPEN";
  $("#commit-submit").disabled = pendingActions.has("commit-submit") || !(verified && open);
  $("#expire-submit").disabled = pendingActions.has("expire-submit") || !verified;
  $("#withdraw-submit").disabled = pendingActions.has("withdraw-submit") || !verified;
  $("#activate-submit").disabled = pendingActions.has("activate-submit") || !verified || $("#activate-submit").hidden;
}

function beginAction(button) {
  pendingActions.add(button.id);
  button.disabled = true;
}

function finishAction(button) {
  if (button.dataset.outcome !== "unknown") pendingActions.delete(button.id);
  renderActionAvailability();
}

function failClosed(message) {
  live = {
    status: null,
    accounting: null,
    certificate: [],
    config: null,
    pledges: [],
    codeHash: null,
    authenticated: false,
    verified: false,
    configError: message,
    pledgeError: null,
    claimable: null,
    pending: null,
  };
  // A view or code-hash failure invalidates the wallet session for this page.
  // There is deliberately no attempt to disconnect or retry a transaction: the
  // host may own the adapter, but this route will not reuse its authorization.
  adapter = null;
  accountId = null;
  if (campaign) {
    renderStatus();
    $("#claimable-value").textContent = "—";
    $("#pending-value").textContent = "—";
    $("#account-state").textContent = "Wallet authorization cleared until live state is verified again.";
  }
  showMessage("#campaign-error", message, "error");
}

function candidateCertificate() {
  if (!live.verified || !live.pledges?.length) return null;
  try {
    return candidateFromOnchainPledges(campaign, live.pledges);
  } catch (error) {
    live.pledgeError = error.message;
    return null;
  }
}

function renderCertificate() {
  const holder = $("#allocation-state"); const pre = $("#allocation-certificate"); const activate = $("#activate-submit");
  pre.hidden = true; activate.hidden = true; delete activate.dataset.allocations;
  if (live.verified && live.status?.phase === "ACTIVATED" && Array.isArray(live.certificate) && live.certificate.length) {
    holder.textContent = "The contract has accepted this allocation certificate. The JSON below is read directly from finalized state.";
    pre.textContent = JSON.stringify(live.certificate, null, 2); pre.hidden = false; return;
  }
  if (!live.verified) {
    holder.textContent = live.configError || "Waiting for immutable contract verification.";
    return;
  }
  if (live.pledgeError) {
    holder.textContent = `Cannot prepare an allocation from the finalized pledge records: ${live.pledgeError}`;
    return;
  }
  const candidate = candidateCertificate();
  const observedLocked = live.pledges.reduce((sum, pledge) => sum + yocto(pledge.amount), 0n);
  const actualLocked = live.accounting ? yocto(live.accounting.locked_pledges) : -1n;
  if (candidate?.allocations && live.status?.phase === "OPEN" && live.status.pledge_count === live.pledges.length && actualLocked === observedLocked) {
    holder.textContent = "Candidate certificate ready. It is derived from finalized onchain pledge records in canonical index order and will still be revalidated by the contract during authority activation.";
    pre.textContent = JSON.stringify(candidate.allocations, null, 2); pre.hidden = false; activate.hidden = false; activate.dataset.allocations = JSON.stringify(candidate.allocations); return;
  }
  holder.textContent = live.status?.phase === "EXPIRED" ? "This campaign expired. Contributors can claim their refunds after finalized expiry." : "Waiting for a complete, reconciled set of finalized onchain pledge records. Planned contribution templates are never treated as deposits.";
}

// Verification deliberately stays on the fixed read-only testnet RPC. A
// wallet adapter is a signing boundary, not an authority for the state that
// enables a transaction.
async function readView(view) { return viewMethod(view); }
async function readCodeHash() { return viewCodeHash(contractId); }

async function refresh() {
  const sequence = ++refreshSequence;
  // Never leave a previously verified state usable while a new finalized read
  // is in flight. Buttons are disabled before any wallet can be opened.
  live.verified = false;
  live.authenticated = false;
  live.configError = "Verifying immutable campaign state and the latest finalized RPC state…";
  live.status = null;
  live.accounting = null;
  live.certificate = [];
  live.config = null;
  live.pledges = [];
  live.codeHash = null;
  live.claimable = null;
  live.pending = null;
  if (campaign) renderStatus();
  try {
    const views = liveCampaignViews(contractId, accountId);
    const values = await Promise.all(views.map(readView));
    const codeHash = await readCodeHash();
    if (sequence !== refreshSequence) return false;
    const [status, accounting, certificate, config, pledges, claimable, pending] = values;
    const authentication = authenticateCampaignConfig(campaign, config, codeHash);
    const stateErrors = [];
    if (!status || typeof status !== "object" || !["OPEN", "ACTIVATED", "EXPIRED"].includes(status.phase)) stateErrors.push("The deployed contract returned an invalid campaign phase.");
    if (!accounting || typeof accounting !== "object" || accounting.solvent !== true) stateErrors.push("The finalized accounting identity is not solvent.");
    if (!Array.isArray(certificate) || !Array.isArray(pledges)) stateErrors.push("The deployed contract returned incomplete canonical state.");
    if (status && Number(status.pledge_count) !== pledges.length) stateErrors.push("The finalized pledge count does not match canonical pledge records.");
    const errors = [...authentication.errors, ...stateErrors];
    if (errors.length) {
      failClosed(errors.join(" "));
      return false;
    }
    live.status = status;
    live.accounting = accounting;
    live.certificate = certificate;
    live.config = config;
    live.pledges = pledges;
    live.codeHash = codeHash;
    live.authenticated = true;
    live.verified = true;
    live.configError = null;
    live.pledgeError = null;
    live.claimable = claimable;
    live.pending = pending;
    renderStatus();
    if (accountId && views.length > 5) {
      $("#claimable-value").textContent = formatNear(claimable);
      $("#pending-value").textContent = formatNear(pending);
    }
    $("#campaign-error").hidden = true;
    return true;
  } catch (error) {
    if (sequence !== refreshSequence) return false;
    failClosed(`Live state could not be verified: ${error.message}`);
    return false;
  }
}

async function wallet() {
  // This preflight is intentionally direct-RPC when no adapter is connected.
  // The wallet modal must never be the first step of a state-changing action.
  if (!(await refresh())) throw new Error("Live campaign state is not verified; wallet remains closed.");
  adapter = window.PACT_NEAR_ADAPTER || await ensureWalletAdapter({ contractId });
  accountId = await adapter.connect();
  if (!isTestnetAccount(accountId)) {
    failClosed("The connected wallet did not provide a valid testnet account.");
    throw new Error("A named testnet wallet account is required.");
  }
  $("#wallet-state").textContent = `Connected as ${accountId}. Every action still requires explicit wallet approval.`;
  $("#account-state").textContent = `Connected as ${accountId}. Balances are read from finalized contract views.`;
  if (!(await refresh())) throw new Error("Live campaign state changed or could not be verified; no transaction was submitted.");
  return adapter;
}

async function confirmOrExplain(submitted, label) {
  if (!submitted?.transactionHash) throw new Error(`${label} returned no transaction hash; finality is unknown and no retry was made.`);
  let final = submitted;
  if (!final.confirmed && typeof adapter.confirm === "function") {
    try { final = await adapter.confirm({ transactionHash: submitted.transactionHash }); } catch { return { ...submitted, confirmed: false, unknown: true }; }
  }
  return final;
}

function resultMessage(node, message, tone = "neutral", hash = null) {
  node.replaceChildren(document.createTextNode(message)); node.dataset.tone = tone;
  if (hash) { const link = element("a", "chain-share-link", `Inspect ${hash} on NEAR testnet ↗`); link.href = explorerUrl(hash); link.target = "_blank"; link.rel = "noopener noreferrer"; node.append(document.createElement("br"), link); }
}

function leavePending(button) {
  button.dataset.outcome = "unknown";
  button.disabled = true;
}

async function commit(event) {
  event.preventDefault(); const node = $("#commit-result"); const button = $("#commit-submit"); beginAction(button);
  try {
    const walletAdapter = await wallet();
    const request = buildCampaignCommitRequest({ contractId, amountNear: Number($("#commit-amount").value), allowed: selectedValues("allowed"), requires: selectedValues("requires") });
    resultMessage(node, "Reviewing the exact commit request in your wallet…", "pending");
    const final = await confirmOrExplain(await walletAdapter.call(request), "Commitment");
    if (!final.confirmed) { leavePending(button); resultMessage(node, `Commitment submitted as ${final.transactionHash}, but finality is unknown. Do not resubmit blindly.`, "warning", final.transactionHash); return; }
    resultMessage(node, `Commitment finalized as ${final.transactionHash}.`, "success", final.transactionHash); await refresh();
  } catch (error) { resultMessage(node, error.message || "Commitment was not confirmed.", "error"); }
  finally { finishAction(button); }
}

async function activate() {
  const button = $("#activate-submit"); beginAction(button);
  try {
    const walletAdapter = await wallet(); const allocations = JSON.parse(button.dataset.allocations || "[]");
    const final = await confirmOrExplain(await walletAdapter.call(buildCampaignActivationRequest({ contractId, allocations })), "Activation");
    if (!final.confirmed) { leavePending(button); showMessage("#campaign-error", `Activation submitted as ${final.transactionHash}, but finality is unknown. Do not retry blindly.`, "warning"); return; }
    showMessage("#campaign-error", `Activation finalized as ${final.transactionHash}.`, "success"); await refresh();
  } catch (error) { showMessage("#campaign-error", error.message, "error"); }
  finally { finishAction(button); }
}

async function simpleAction(action, buttonSelector) {
  const button = $(buttonSelector); beginAction(button);
  try {
    const walletAdapter = await wallet(); const request = action === "expire" ? buildCampaignExpireRequest(contractId) : buildCampaignWithdrawRequest(contractId);
    const final = await confirmOrExplain(await walletAdapter.call(request), action);
    if (!final.confirmed) { leavePending(button); showMessage("#campaign-error", `${action} submitted as ${final.transactionHash}, but finality is unknown. Do not retry blindly.`, "warning"); return; }
    showMessage("#campaign-error", `${action} finalized as ${final.transactionHash}.`, "success"); await refresh();
  } catch (error) { showMessage("#campaign-error", error.message, "error"); }
  finally { finishAction(button); }
}

function boot() {
  if (!contractId || !params.get("config")) { showMessage("#campaign-error", "This link needs both a testnet campaign account and its public configuration.", "error"); return; }
  if (!isTestnetAccount(contractId)) { showMessage("#campaign-error", "This campaign link must point to a dedicated *.testnet account.", "error"); return; }
  try { campaign = campaignFromShareToken(params.get("config")); } catch (error) { showMessage("#campaign-error", error.message, "error"); return; }
  renderHeader(); renderProjects(); renderSupporterOptions();
  $("#commit-form").addEventListener("submit", commit);
  $("#refresh-campaign").addEventListener("click", refresh);
  $("#activate-submit").addEventListener("click", activate);
  $("#expire-submit").addEventListener("click", () => simpleAction("expire", "#expire-submit"));
  $("#withdraw-submit").addEventListener("click", () => simpleAction("withdraw", "#withdraw-submit"));
  refresh();
}

boot();
