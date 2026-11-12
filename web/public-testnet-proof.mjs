import { campaignUrl } from "./campaign-chain.mjs";

const $ = selector => document.querySelector(selector);
const node = (tag, className = "", text = undefined) => {
  const value = document.createElement(tag);
  if (className) value.className = className;
  if (text !== undefined) value.textContent = String(text);
  return value;
};

function link(label, url, className = "text-link") {
  const anchor = node("a", className, label);
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  return anchor;
}

function verifiedCampaignUrl(proof) {
  if (!proof?.share || !proof.contract_id?.endsWith(".testnet")) return null;
  // The share token is derived from the exact recorded immutable onchain
  // configuration, not a guessed address or a fabricated wallet session.
  return campaignUrl(proof.contract_id, proof.share, window.location.href);
}

function renderProof(proof) {
  const card = node("article", "evidence-card public-proof-card");
  const head = node("div", "evidence-card-head");
  head.append(
    node("span", "live-tag", "RECORDED TESTNET SETTLEMENT"),
    node("span", "proof-source", proof.status || proof.id),
  );
  const title = node("h3", "public-proof-title", proof.label);
  const description = node("p", "public-proof-description", proof.summary);
  const facts = node("ul", "public-proof-facts");
  for (const fact of proof.facts) facts.append(node("li", "", fact));
  const links = node("div", "public-proof-links");
  links.append(link("Contract explorer ↗", proof.contract_explorer));
  const shareUrl = verifiedCampaignUrl(proof);
  if (shareUrl) links.append(link("Open authenticated campaign ↗", shareUrl, "proof-main-link"));
  for (const receipt of proof.links) links.append(link(receipt.label + " ↗", receipt.url));
  const label = node("p", "evidence-footnote", "These are historical public testnet receipts, not a live payment feed. Opening the campaign triggers a new finalized state and contract-code check.");
  card.append(head, title, description, facts, links, label);
  return card;
}

async function boot() {
  const holder = $("#public-proof-list");
  const status = $("#public-proof-status");
  try {
    const response = await fetch("./data/testnet-proof.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const proof = await response.json();
    if (!Array.isArray(proof.campaigns) || !proof.campaigns.length) throw new Error("No valid campaign evidence");
    holder.replaceChildren(...proof.campaigns.map(renderProof));

    const main = proof.campaigns.find(item => item.id === "coalition");
    const spotlight = $("#featured-campaign-link");
    const liveCampaign = verifiedCampaignUrl(main);
    if (spotlight && liveCampaign) spotlight.href = liveCampaign;
    if (spotlight && !liveCampaign) {
      spotlight.textContent = "Open contract explorer ↗";
      spotlight.setAttribute("aria-label", "Open the recorded coalition contract in NEAR explorer");
    }

    const recorded = proof.recorded_at ? new Date(proof.recorded_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "Nov 2026";
    status.textContent = `${proof.campaigns.length} recorded public testnet cases · captured ${recorded}. ${proof.wallet_signing}. These links are archival evidence, not a fresh RPC verification.`;
    status.dataset.state = "ready";
  } catch (error) {
    holder.replaceChildren(node("p", "public-proof-error", "Recorded testnet evidence could not be loaded. No live outcome is claimed."));
    status.textContent = `Public evidence unavailable: ${error.message}`;
    status.dataset.state = "error";
  }
}

boot();
