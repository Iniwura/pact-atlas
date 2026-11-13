// Recorded historical transactions for the two public PACT examples.
// These receipt links are not live payment events or a substitute for
// the campaign page's separately verified finalized onchain state.
const contractId = new URLSearchParams(window.location.search).get("contract");
const section = document.querySelector("#campaign-activity");
const list = document.querySelector("#campaign-activity-timeline");
const status = document.querySelector("#campaign-activity-status");

async function loadRecordedActivity() {
  if (!section || !list || !contractId) return;
  try {
    const response = await fetch("./data/testnet-proof.json", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    const campaign = data.campaigns?.find(item => item.contract_id === contractId);
    if (!campaign) return;
    section.hidden = false;
    list.replaceChildren();
    campaign.links.forEach((receipt, index) => {
      const item = document.createElement("li");
      item.className = "campaign-activity-item";
      const step = document.createElement("span");
      step.className = "campaign-activity-step";
      step.textContent = String(index + 1).padStart(2, "0");
      const content = document.createElement("div");
      const label = document.createElement("strong");
      label.textContent = receipt.label;
      const hash = document.createElement("code");
      hash.textContent = receipt.hash;
      content.append(label, hash);
      const anchor = document.createElement("a");
      anchor.href = receipt.url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.textContent = "View receipt ↗";
      item.append(step, content, anchor);
      list.append(item);
    });
    status.textContent = "Recorded faucet-funded NEAR testnet receipts. These historical links are not a live RPC query or a browser-wallet signing claim.";
  } catch {
    section.hidden = false;
    status.textContent = "Historical receipt index is temporarily unavailable. No payment status is inferred.";
  }
}

loadRecordedActivity();
