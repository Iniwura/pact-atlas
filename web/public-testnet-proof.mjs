const $ = selector => document.querySelector(selector);
const node = (tag, className = "", text = undefined) => {
  const value = document.createElement(tag);
  if (className) value.className = className;
  if (text !== undefined) value.textContent = String(text);
  return value;
};

function link(label, url) {
  const anchor = node("a", "text-link", `${label} ↗`);
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  return anchor;
}

function renderProof(proof) {
  const card = node("article", "evidence-card public-proof-card");
  const head = node("div", "evidence-card-head");
  head.append(node("span", "live-tag", "FINALIZED TESTNET EVIDENCE"), node("span", "proof-source", proof.id));
  const title = node("h3", "public-proof-title", proof.label);
  const description = node("p", "public-proof-description", proof.summary);
  const facts = node("ul", "public-proof-facts");
  for (const fact of proof.facts) facts.append(node("li", "", fact));
  const links = node("div", "public-proof-links");
  links.append(link("Open campaign account", proof.contract_explorer));
  for (const receipt of proof.links) links.append(link(receipt.label, receipt.url));
  card.append(head, title, description, facts, links);
  return card;
}

async function boot() {
  const holder = $("#public-proof-list");
  const status = $("#public-proof-status");
  try {
    const response = await fetch("./data/testnet-proof.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const proof = await response.json();
    holder.replaceChildren(...proof.campaigns.map(renderProof));
    status.textContent = `${proof.campaigns.length} public campaigns · ${proof.network} · verified against ${proof.rpc}. ${proof.wallet_signing}.`;
    status.dataset.state = "ready";
  } catch (error) {
    holder.replaceChildren(node("p", "public-proof-error", "Public evidence could not be loaded. No live activity is shown."));
    status.textContent = `Public evidence unavailable: ${error.message}`;
    status.dataset.state = "error";
  }
}

boot();
