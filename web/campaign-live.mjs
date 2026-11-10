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
let live = { status: null, accounting: null, certificate: [], config: null, pledges: [], codeHash: null, authenticated: false, configError: null, pledgeError: null };
let adapter = null;
let accountId = null;

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
}

function candidateCertificate() {
  if (!live.authenticated || !live.pledges?.length) return null;
  try {
    return candidateFromOnchainPledges(campaign, live.pledges);
  } catch (error) {
    live.pledgeError = error.message;
    return null;
  }
}

function renderCertificate() {
  const holder = $("#allocation-state"); const pre = $("#allocation-certificate"); const activate = $("#activate-submit");
  pre.hidden = true; activate.hidden = true;
  if (live.status?.phase === "ACTIVATED" && Array.isArray(live.certificate) && live.certificate.length) {
    holder.textContent = "The contract has accepted this allocation certificate. The JSON below is read directly from finalized state.";
    pre.textContent = JSON.stringify(live.certificate, null, 2); pre.hidden = false; return;
  }
  if (!live.authenticated) {
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

async function readView(view) { return adapter?.view ? adapter.view(view) : viewMethod(view); }
async function readCodeHash() { return adapter?.codeHash ? adapter.codeHash(contractId) : viewCodeHash(contractId); }

async function refresh() {
  try {
    const views = liveCampaignViews(contractId, accountId);
    const values = await Promise.all(views.slice(0, 5).map(readView));
    [live.status, live.accounting, live.certificate, live.config, live.pledges] = values;
    live.codeHash = await readCodeHash();
    const authentication = authenticateCampaignConfig(campaign, live.config, live.codeHash);
    live.authenticated = authentication.valid;
    live.configError = authentication.valid ? null : authentication.errors.join(" ");
    live.pledgeError = null;
    renderStatus();
    if (accountId && views.length > 5) {
      const balances = await Promise.all(views.slice(5).map(readView));
      $("#claimable-value").textContent = formatNear(balances[0]);
      $("#pending-value").textContent = formatNear(balances[1]);
    }
    if (authentication.valid) $("#campaign-error").hidden = true;
    else showMessage("#campaign-error", live.configError, "error");
  } catch (error) { showMessage("#campaign-error", `Live state could not be read: ${error.message}`, "error"); }
}

async function wallet() {
  adapter = window.PACT_NEAR_ADAPTER || await ensureWalletAdapter({ contractId });
  accountId = await adapter.connect();
  $("#wallet-state").textContent = `Connected as ${accountId}. Every action still requires explicit wallet approval.`;
  $("#account-state").textContent = `Connected as ${accountId}. Balances are read from finalized contract views.`;
  await refresh();
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
  event.preventDefault(); const node = $("#commit-result"); const button = $("#commit-submit"); button.disabled = true;
  try {
    const walletAdapter = await wallet();
    const request = buildCampaignCommitRequest({ contractId, amountNear: Number($("#commit-amount").value), allowed: selectedValues("allowed"), requires: selectedValues("requires") });
    resultMessage(node, "Reviewing the exact commit request in your wallet…", "pending");
    const final = await confirmOrExplain(await walletAdapter.call(request), "Commitment");
    if (!final.confirmed) { leavePending(button); resultMessage(node, `Commitment submitted as ${final.transactionHash}, but finality is unknown. Do not resubmit blindly.`, "warning", final.transactionHash); return; }
    resultMessage(node, `Commitment finalized as ${final.transactionHash}.`, "success", final.transactionHash); await refresh();
  } catch (error) { resultMessage(node, error.message || "Commitment was not confirmed.", "error"); }
  finally { if (button.dataset.outcome !== "unknown") button.disabled = false; }
}

async function activate() {
  const button = $("#activate-submit"); button.disabled = true;
  try {
    const walletAdapter = await wallet(); const allocations = JSON.parse(button.dataset.allocations || "[]");
    const final = await confirmOrExplain(await walletAdapter.call(buildCampaignActivationRequest({ contractId, allocations })), "Activation");
    if (!final.confirmed) { leavePending(button); showMessage("#campaign-error", `Activation submitted as ${final.transactionHash}, but finality is unknown. Do not retry blindly.`, "warning"); return; }
    showMessage("#campaign-error", `Activation finalized as ${final.transactionHash}.`, "success"); await refresh();
  } catch (error) { showMessage("#campaign-error", error.message, "error"); }
  finally { if (button.dataset.outcome !== "unknown") button.disabled = false; }
}

async function simpleAction(action, buttonSelector) {
  const button = $(buttonSelector); button.disabled = true;
  try {
    const walletAdapter = await wallet(); const request = action === "expire" ? buildCampaignExpireRequest(contractId) : buildCampaignWithdrawRequest(contractId);
    const final = await confirmOrExplain(await walletAdapter.call(request), action);
    if (!final.confirmed) { leavePending(button); showMessage("#campaign-error", `${action} submitted as ${final.transactionHash}, but finality is unknown. Do not retry blindly.`, "warning"); return; }
    showMessage("#campaign-error", `${action} finalized as ${final.transactionHash}.`, "success"); await refresh();
  } catch (error) { showMessage("#campaign-error", error.message, "error"); }
  finally { if (button.dataset.outcome !== "unknown") button.disabled = false; }
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
