import { publicCampaignConfig, campaignUrl } from "./campaign-chain.mjs";
import { authenticateCampaignConfig } from "./campaign-live-data.mjs";
import { viewMethod, viewCodeHash } from "./near-rpc.mjs";
import { ensureWalletAdapter } from "./wallet-selector-host.mjs";

const $ = selector => document.querySelector(selector);
const oneNear = 1_000_000_000_000_000_000_000_000n;
const rpcHosts = ["https://rpc.testnet.fastnear.com", "https://rpc.testnet.near.org"];
const model = { campaigns: [], campaignFilter: "all", activityFilter: "all" };

function node(tag, className = "", label) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (label !== undefined) element.textContent = String(label);
  return element;
}

function link(text, href, className = "", newTab = false) {
  const element = node("a", className, text);
  element.href = href;
  if (newTab) {
    element.target = "_blank";
    element.rel = "noopener noreferrer";
  }
  return element;
}

function amountFromYocto(value) {
  try {
    const amount = BigInt(String(value));
    if (amount < 0n) throw Error("negative amount");
    const whole = amount / oneNear;
    const fraction = (amount % oneNear).toString().padStart(24, "0").slice(0, 2).replace(/0+$/, "");
    return whole + (fraction ? "." + fraction : "");
  } catch {
    return "—";
  }
}

function recordedAmount(campaign) {
  const projects = campaign?.share?.projects || [];
  const supporters = campaign?.share?.supporters || [];
  if (campaign.id === "coalition") return projects.reduce((total, project) => total + Number(project.goal || 0), 0);
  if (campaign.id === "refund") return supporters.reduce((total, supporter) => total + Number(supporter.amount || 0), 0);
  return null;
}

function titleOf(campaign) {
  if (campaign.id === "coalition") return "Conditional coalition";
  if (campaign.id === "refund") return "Expired campaign";
  if (campaign.origin === "local") return String(campaign.label || campaign.share?.title || "Your campaign");
  return String(campaign.label || "Community campaign");
}

function phaseLabel(phase) {
  return phase === "ACTIVATED" ? "Funded" : phase === "EXPIRED" ? "Expired" : phase === "OPEN" ? "Funding" : "Unknown";
}

function campaignLink(campaign) {
  if (!campaign.share || !campaign.contract_id?.endsWith(".testnet")) return campaign.contract_explorer;
  return campaignUrl(campaign.contract_id, campaign.share, location.href);
}

function renderSummary() {
  $("#metric-campaigns").textContent = String(model.campaigns.length).padStart(2, "0");
  const coalition = model.campaigns.find(item => item.id === "coalition");
  const refund = model.campaigns.find(item => item.id === "refund");
  $("#metric-funded").textContent = coalition ? String(recordedAmount(coalition)) : "—";
  $("#metric-refunded").textContent = refund ? String(recordedAmount(refund)) : "—";
  if (coalition) $("#featured-open").href = campaignLink(coalition);
}

function renderCampaignTile(campaign) {
  const phase = campaign.chain?.phase || campaign.status;
  const card = node("article", "campaign-tile");
  const head = node("div", "tile-head");
  head.append(node("span", "tile-index", campaign.origin === "local" ? "SAVED IN THIS BROWSER" : campaign.id === "coalition" ? "ONCHAIN / 01" : "ONCHAIN / 02"));
  const status = node("span", "status-chip", phaseLabel(phase));
  status.dataset.phase = phase || "UNKNOWN";
  status.dataset.live = campaign.chain ? "verified" : "unavailable";
  head.append(status);

  const heading = node("h3", "", titleOf(campaign));
  const description = node("p", "", campaign.origin === "local"
    ? "Deployed from this browser. Inspect its verified contract state and project conditions."
    : campaign.id === "coalition"
    ? "Two projects funded together. Beta's contribution depended on Alpha receiving funding."
    : "The funding period ended without activation. The recorded contributor received a refund.");

  const stats = node("div", "tile-summary");
  const projects = node("div");
  const projectCaption = node("span", "", "PROJECTS");
  const projectCount = node("strong", "", String(campaign.share?.projects?.length ?? "—"));
  projects.append(projectCaption, projectCount);
  const funded = node("div");
  const fundedCaption = node("span", "", campaign.origin === "local" ? "CURRENTLY LOCKED" : campaign.status === "EXPIRED" ? "REFUNDED" : "RECORDED FUNDING");
  const amount = campaign.origin === "local" ? (campaign.chain ? amountFromYocto(campaign.chain.lockedPledges) : "—") : String(recordedAmount(campaign));
  const fundedValue = node("strong", "", amount);
  fundedValue.append(node("small", "", " NEAR"));
  funded.append(fundedCaption, fundedValue);
  stats.append(projects, funded);

  const footer = node("div", "tile-footer");
  const action = link("Open campaign ↗", campaignLink(campaign));
  const chainState = node("span", "tile-rpc", campaign.chain
    ? "Finalized chain state checked"
     : campaign.rpcError ? (campaign.origin === "local" ? "Live RPC unavailable · saved link" : "Live RPC unavailable · recorded data") : "Checking latest state…");
  footer.append(action, chainState);
  card.append(head, heading, description, stats, footer);
  return card;
}

function renderCampaigns() {
  const shown = model.campaigns.filter(item => model.campaignFilter === "all" || (item.chain?.phase || item.status) === model.campaignFilter);
  const container = $("#campaign-list");
  container.replaceChildren(...shown.map(renderCampaignTile));
  const empty = $("#campaign-list-status");
  empty.hidden = !!shown.length;
  if (!shown.length) empty.textContent = model.campaigns.length ? "No campaigns match this status." : "No campaigns are listed. Create a funding agreement to get started.";
}

function categoryOf(campaign, receipt) {
  const label = String(receipt.label).toLowerCase();
  if (label.includes("contribution")) return "contribution";
  if (label.includes("beneficiary withdrawal")) return "payout";
  return "other";
}

function eventLabel(receipt) {
  const label = String(receipt.label);
  if (label.toLowerCase() === "accepted activation certificate") return "Campaign activated";
  if (label.toLowerCase() === "expiry") return "Campaign expired";
  if (label.toLowerCase() === "refund withdrawal") return "Contribution refunded";
  if (label.toLowerCase().includes("beneficiary withdrawal")) return label.replace("beneficiary withdrawal", "payout");
  return label;
}

function renderActivity() {
  const all = model.campaigns.flatMap(campaign =>
    (campaign.links || []).map(receipt => ({ campaign, receipt, category: categoryOf(campaign, receipt) })));
  const shown = all.filter(item => model.activityFilter === "all" || item.category === model.activityFilter);
  const container = $("#activity-list");
  container.replaceChildren();
  if (!shown.length) {
    container.append(node("p", "empty-state", "No recorded transactions match this filter."));
    return;
  }
  shown.forEach(({ campaign, receipt }, index) => {
    const item = node("article", "activity-entry");
    item.append(node("span", "activity-index", String(index + 1).padStart(2, "0")));
    const description = node("div");
    description.append(node("strong", "", eventLabel(receipt)));
    description.append(node("p", "", titleOf(campaign) + " · NEAR testnet"));
    item.append(description);
    item.append(node("code", "", receipt.hash));
    item.append(link("Receipt ↗", receipt.url, "", true));
    container.append(item);
  });
}

function filterControls(selector, property, render) {
  document.querySelectorAll(selector).forEach(button => {
    button.addEventListener("click", () => {
      model[property] = button.dataset[property === "campaignFilter" ? "campaignFilter" : "activityFilter"];
      document.querySelectorAll(selector).forEach(element => element.setAttribute("aria-pressed", String(element === button)));
      render();
    });
  });
}

function validateEvidence(campaign) {
  if (!campaign?.contract_id?.endsWith(".testnet") || !campaign?.share) return false;
  if (!Array.isArray(campaign.links) || campaign.links.some(r => !r.hash || !r.url?.startsWith("https://testnet.nearblocks.io/txns/"))) return false;
  try {
    const token = publicCampaignConfig(campaign.share);
    return token.immutable.projects.length === campaign.share.projects.length;
  } catch {
    return false;
  }
}

async function finalizedState(campaign, rpcUrl) {
  const options = { rpcUrl };
  const contractId = campaign.contract_id;
  const [status, accounting, immutable, hash] = await Promise.all([
    viewMethod({ contractId, methodName: "status" }, options),
    viewMethod({ contractId, methodName: "accounting" }, options),
    viewMethod({ contractId, methodName: "campaign_config" }, options),
    viewCodeHash(contractId, options),
  ]);
  const auth = authenticateCampaignConfig(publicCampaignConfig(campaign.share), immutable, hash);
  if (!auth.valid || accounting?.solvent !== true || !["ACTIVATED", "EXPIRED", "OPEN"].includes(status?.phase)) {
    throw Error("Contract or accounting verification failed");
  }
  return { phase: status.phase, liabilities: String(accounting.liabilities), pledgeCount: Number(status.pledge_count), lockedPledges: String(accounting.locked_pledges) };
}

async function refreshCampaign(campaign) {
  for (const rpcUrl of rpcHosts) {
    try {
      campaign.chain = await finalizedState(campaign, rpcUrl);
      campaign.rpcError = false;
      renderCampaigns();
      return;
    } catch {
      // A failed provider read never becomes a success. Try an independent
      // read-only RPC for all four checks, not a mixture of partial responses.
    }
  }
  campaign.chain = null;
  campaign.rpcError = true;
  renderCampaigns();
}

async function connectWallet() {
  const button = $("#connect-wallet");
  const message = $("#wallet-message");
  button.disabled = true;
  button.textContent = "Connecting…";
  message.dataset.state = "";
  try {
    const adapter = await ensureWalletAdapter();
    const accountId = await adapter.connect();
    if (!accountId || typeof accountId !== "string") throw Error("No NEAR account was returned");
    button.textContent = accountId.length > 17 ? accountId.slice(0, 12) + "…" : accountId;
    button.title = accountId;
    message.textContent = "Connected on NEAR testnet: " + accountId + ". Signing a transaction still requires a separate wallet approval.";
    message.dataset.state = "ok";
  } catch (error) {
    button.textContent = "Connect wallet ↗";
    message.textContent = "Wallet connection wasn't completed. " + (error?.message || "Check your testnet wallet and try again.");
    message.dataset.state = "error";
  } finally {
    button.disabled = false;
  }
}

function savedDeployedCampaigns() {
  const drafts = [];
  try {
    const stored = JSON.parse(localStorage.getItem("pact-atlas-deployed-campaigns-v1") || "[]");
    if (Array.isArray(stored)) drafts.push(...stored.slice(0, 12));
  } catch {}
  try {
    const latest = JSON.parse(localStorage.getItem("pact-atlas-custom-campaign-v1") || "null");
    if (latest) drafts.push(latest);
  } catch {}

  const result = [], seen = new Set();
  for (const draft of drafts) {
    try {
      const contractId = draft?.deployment?.contractId;
      if (typeof contractId !== "string" || !contractId.endsWith(".testnet") || seen.has(contractId)) continue;
      if (!Number.isSafeInteger(draft?.deployment?.timing?.deadlineMs) || !Number.isSafeInteger(draft?.deployment?.timing?.activateAfterMs)) continue;
      const record = {
        id: "saved-" + result.length, origin: "local", label: String(draft.title || "Your campaign"),
        contract_id: contractId, contract_explorer: "https://testnet.nearblocks.io/address/" + encodeURIComponent(contractId),
        status: "UNKNOWN", share: draft, links: [], chain: null, rpcError: false,
      };
      if (validateEvidence(record)) { result.push(record); seen.add(contractId); }
    } catch {}
  }
  return result;
}

async function boot() {
  $("#connect-wallet").addEventListener("click", connectWallet);
  filterControls("[data-campaign-filter]", "campaignFilter", renderCampaigns);
  filterControls("[data-activity-filter]", "activityFilter", renderActivity);
  try {
    const response = await fetch("./data/testnet-proof.json", { cache: "no-store" });
    if (!response.ok) throw Error("HTTP " + response.status);
    const proof = await response.json();
    if (proof.network !== "NEAR testnet" || !Array.isArray(proof.campaigns)) throw Error("Invalid evidence index");
    const listed = proof.campaigns.filter(validateEvidence).map(campaign => ({ ...campaign, chain: null, rpcError: false, origin: "recorded" }));
    const known = new Set(listed.map(campaign => campaign.contract_id));
    const saved = savedDeployedCampaigns().filter(campaign => !known.has(campaign.contract_id));
    model.campaigns = [...saved, ...listed];
    renderSummary();
    renderCampaigns();
    renderActivity();
    $("#activity-note").textContent = "Recorded finalized receipts from the public campaign evidence index. This is not a live transaction feed.";
    // Provide immediate navigation, while independent RPC refresh runs in the
    // background. Historic receipts remain explicitly labelled as recorded.
    await Promise.all(model.campaigns.map(refreshCampaign));
  } catch {
    $("#campaign-list").replaceChildren(node("p", "empty-state", "Campaigns could not be loaded. Please refresh the page or try again."));
    $("#activity-list").replaceChildren(node("p", "empty-state", "Recorded activity is unavailable."));
    $("#campaign-list-status").hidden = true;
    $("#activity-note").textContent = "No live funding state is claimed while the evidence index is unavailable.";
  }
}

boot();
