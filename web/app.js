import { MODEL, exactPlans, evaluate } from "./engine.mjs";
import { fundingView } from "./funding-view.mjs";
import { buildWorkflowRequest, certificateFor, reconciliationViews } from "./near-workflow.mjs";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const near = (value) => `${value.toString()}N`;

function renderEngine() {
  const targetKey = $("#coalition-select").value;
  const topUp = $("#topup-toggle").checked;
  const condition = $("#condition-select").value;
  const view = fundingView(targetKey, topUp, condition);
  const feasible = view.status === "viable";
  document.body.dataset.coalitionState = view.status;
  $(".map-panel").dataset.state = view.status;
  $("#graph-state").textContent = feasible ? "Fundable" : "Blocked";

  const changed = topUp || condition !== "none";
  const action = $("#solve-gap");
  action.innerHTML = changed ? 'Remove change <span aria-hidden="true">↺</span>' : 'Add 1 NEAR <span aria-hidden="true">↗</span>';
  action.setAttribute("aria-pressed", String(changed));

  $("#committed-value").textContent = `${view.committed} NEAR`;
  $("#required-value").textContent = `${view.required} NEAR`;
  const gap = $("#gap-value");
  const gapLabel = gap.previousElementSibling;
  if (view.missing > 0n) {
    gapLabel.textContent = "Missing";
    gap.textContent = `${view.missing} NEAR`;
  } else if (feasible) {
    gapLabel.textContent = "Unassigned";
    gap.textContent = `${view.unassigned} NEAR`;
  } else {
    gapLabel.textContent = "Constraint";
    gap.textContent = "No valid plan";
  }

  for (const project of view.projects) {
    const node = $(`.map-node[data-project="${project.id}"]`);
    const shown = project.visible;
    const proportion = project.selected ? Number(shown) / Number(project.required) : 0;
    const ring = $(".node-progress", node);
    const circumference = 2 * Math.PI * Number(ring.getAttribute("r"));
    ring.setAttribute("stroke-dasharray", `${(Math.max(0,Math.min(1,proportion)) * circumference).toFixed(2)} ${circumference.toFixed(2)}`);
    node.dataset.inCoalition = String(project.selected);
    node.dataset.simulated = project.id === "d" && feasible && changed ? "added" : "baseline";
    node.dataset.coverage = `${shown}/${project.required}`;
    node.dataset.state = project.selected && shown === project.required ? "covered" : "gap";
    const caption = $(".node-caption", node);
    caption.textContent = `${project.label.toUpperCase()} · ${shown}/${project.required}N`;
    node.setAttribute("aria-label", `${project.label}: ${shown} of ${project.required} NEAR ${project.source}; ${feasible ? "fundable" : "not activated"}`);
  }
  $("#map-desc").textContent = `${view.targetLabel} dependency network. ${view.committed} NEAR committed, ${view.required} NEAR required. Local model: ${view.status}.`;

  const title = targetKey === "abcd"
    ? (feasible ? "All four projects can activate" : "1 NEAR is missing")
    : (feasible ? `${view.targetLabel} can activate` : `${view.targetLabel} cannot activate`);

  let detail = "";
  if (feasible) {
    const groups = view.projects.filter(project => project.selected).map(project => {
      const entries = view.rows.filter(row => row.project === project.id);
      return `<div class="proof-project"><div class="proof-project-head"><strong>${project.label}</strong><span>${project.required} NEAR</span></div>
        <p>${entries.map(row => `${row.donor} ${row.amount}N`).join(" + ")}</p></div>`;
    }).join("");
    const reproducible = topUp && condition === "none"
      ? '<p class="proof-repro">Reproduce locally: <code>node scripts/certificate.js --topup</code></p>'
      : '<p class="proof-repro">Reproduce locally: <code>npm run test:counterfactual</code></p>';
    detail = `<div class="allocation-overview"><strong>${view.validation.assigned} NEAR assigned</strong><span>${view.rows.length} unique commitments · ${view.targetIds.length} projects</span></div>
      <details class="allocation-proof" id="allocation-proof" open>
        <summary>Inspect exact allocation <span aria-hidden="true">↗</span></summary>
        <div class="proof-groups">${groups}</div>
        <div class="proof-checks" aria-label="Local reference-model checks"><span>One use</span><span>Permitted destinations</span><span>Conditions</span><span>Exact amounts</span><span>Conserved capital</span></div>
        ${reproducible}
        <p class="proof-limit">Local reference-model certificate. Not a signed or audited transaction.</p>
      </details>`;
  } else if (view.baseline) {
    detail = `<div class="blocker-detail">
      <p>Training, Internet and Equipment have a valid 10 NEAR candidate. Events has 2 of 3 NEAR available.</p>
      <details class="eligibility-explanation">
        <summary>Why not count all eligible funding?</summary>
        <p>Project-level eligibility sums to ${view.committed + view.eligibilityOvercount} NEAR, but only ${view.committed} NEAR exists. Donor 01 can fund Training <em>or</em> Events, not both. The allocation must use each commitment once.</p>
      </details>
    </div>`;
  } else {
    detail = `<p class="result-copy">${view.reasons[0] || "No exact allocation exists for these conditions."}</p>`;
  }

  $("#engine-result").innerHTML = `<h3 class="result-title">${title}</h3>${detail}`;
  const selected = $(".map-node.selected")?.dataset.project || "d";
  renderProjectInspector(selected, view);
}
function renderCommitments() {
  $("#commitment-list").innerHTML = MODEL.pledges.map((pledge) => `<article class="commitment-row" data-pledge="${pledge.id}" tabindex="0" role="button" aria-label="Inspect ${pledge.owner} commitment">
    <span class="pledge-index">${pledge.id}</span>
    <span class="pledge-name"><strong>${pledge.owner}</strong></span>
    <strong class="pledge-amount">${near(pledge.amount)}</strong>
    <span class="pledge-targets">${pledge.allowed.map(id => `<i class="target-pill">${id.toUpperCase()}</i>`).join("")}</span>
  </article>`).join("");
  $$(".commitment-row").forEach(row => {
    const select = () => {
      $$(".commitment-row").forEach(item => item.classList.remove("selected"));
      row.classList.add("selected");
      renderPledgeInspector(row.dataset.pledge);
    };
    row.addEventListener("click", select);
    row.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault(); select();
      }
    });
  });
}

function renderPledgeInspector(pledgeId) {
  const pledge = MODEL.pledges.find(item => item.id === pledgeId);
  if (!pledge) return;
  const destinations = pledge.allowed.map(id => MODEL.projects[id].label).join(" or ");
  const condition = pledge.requires.length
    ? `Requires ${pledge.requires.map(id => MODEL.projects[id].label).join(" and ")} to be funded.`
    : "";
  $("#commitment-detail").innerHTML = `<h3>${pledge.owner}</h3>
    <p>${near(pledge.amount)} toward ${destinations}.</p>
    ${condition ? `<p>${condition}</p>` : ""}
  `;
}

function renderProjectInspector(projectId, view = fundingView($("#coalition-select").value, $("#topup-toggle").checked, $("#condition-select").value)) {
  const project = MODEL.projects[projectId];
  if (!project) return;
  const dependencies = project.dependencies.map(id => MODEL.projects[id].label);
  const funding = view.projects.find(item => item.id === projectId);
  $("#project-inspector").innerHTML = `
    <div class="inspector-symbol">${project.short}</div>
    <div class="inspector-body">
      <strong>${project.label}</strong>
      <span>${near(project.required)} required · ${funding.visible}N ${view.status === "viable" ? "assigned" : "available in candidate"}</span>
      ${dependencies.length ? `<small>Needs ${dependencies.join(" + ")}</small>` : ""}
    </div>`;
  $$(".map-node").forEach(node => {
    const selected = node.dataset.project === projectId;
    node.classList.toggle("selected", selected);
    node.setAttribute("aria-pressed", String(selected));
  });
}

function renderEvidence(evidence) {
  if (!evidence) return;
  $("#scenario-count").textContent = evidence.scenarios.length;
  $("#evidence-date").textContent = new Date(evidence.generatedAt).toISOString().slice(0, 10);
  $("#wasm-hash").textContent = evidence.wasmSha256;
  $("#sandbox-version").textContent = evidence.sandboxVersion;
  const select = $("#evidence-select");
  select.innerHTML = evidence.scenarios.map((scenario, index) => `<option value="${index}">${String(index + 1).padStart(2, "0")} / ${scenario.name}</option>`).join("");
  const paint = () => {
    const scenario = evidence.scenarios[Number(select.value)];
    $("#receipt-title").textContent = scenario.name;
    const receipts = [];
    if (scenario.contract) receipts.push(["PACT address", scenario.contract]);
    if (scenario.contracts?.funded) receipts.push(["PACT funded", scenario.contracts.funded]);
    if (scenario.contracts?.refund) receipts.push(["PACT refund", scenario.contracts.refund]);
    if (scenario.dao) receipts.push(["DAO address", scenario.dao]);
    const activation = scenario.receipts?.activation || scenario.receipts?.activation?.hash;
    if (activation) receipts.push(["activation", activation]);
    if (scenario.receipts?.expiry) receipts.push(["expiry", scenario.receipts.expiry]);
    if (scenario.receipts?.dao?.initialize) receipts.push(["DAO initialize", scenario.receipts.dao.initialize]);
    const finalPhase = scenario.finalStatus?.phase || scenario.finalStatuses?.funded?.phase;
    const finalLiabilities = scenario.finalStatus?.liabilities || scenario.finalStatuses?.funded?.liabilities;
    if (finalPhase) receipts.push(["final phase", finalPhase]);
    if (finalLiabilities !== undefined) receipts.push(["liabilities", `${finalLiabilities} yoctoNEAR`]);
    $("#receipt-list").innerHTML = receipts.map(([label, value]) => `<div class="receipt-item"><span>${label}</span><code title="${value}">${value}</code></div>`).join("");
  };
  select.addEventListener("change", paint); paint();
}

function toast(message) {
  const element = $("#toast"); element.textContent = message; element.classList.add("show"); window.clearTimeout(toast.timer); toast.timer = window.setTimeout(() => element.classList.remove("show"), 4200);
}

function workflowResult(message, tone = "neutral") {
  const element = $("#workflow-result");
  if (!element) return;
  element.dataset.tone = tone;
  element.textContent = message;
}

async function connectWallet() {
  const adapter = window.PACT_NEAR_ADAPTER;
  if (!adapter || typeof adapter.connect !== "function") { toast("Read-only evidence mode: no authorized NEAR wallet adapter is connected."); return; }
  try {
    const account = await adapter.connect();
    $("#connect-wallet").textContent = account ? `${account.slice(0, 6)}…${account.slice(-5)}` : "Wallet connected";
    $("#wallet-status").innerHTML = `<span class="status-dot"></span><strong>Wallet connected</strong><span>Actions require explicit transaction approval in the wallet.</span>`;
    if (window.PACT_NEAR_CONFIG?.network) $("#network-label").textContent = `NEAR ${window.PACT_NEAR_CONFIG.network}`;
    workflowResult(`Connected as ${account || "wallet account"}. Choose an action and review its exact request before signing.`);
    toast("Wallet connected. Review every transaction before signing.");
  } catch (error) { toast(`Wallet connection cancelled: ${error.message || "no account returned"}`); }
}

async function workflowAction(action) {
  const adapter = window.PACT_NEAR_ADAPTER;
  const title = action[0].toUpperCase() + action.slice(1);
  if (action === "certify") {
    try {
      const certificate = certificateFor($("#coalition-select").value);
      workflowResult(`Exact certificate ready: ${certificate.length} allocation${certificate.length === 1 ? "" : "s"}. It is local evidence until an authority submits activate().`, "success");
      toast("Certificate generated locally. No wallet transaction was requested.");
    } catch (error) { workflowResult(error.message, "error"); toast(error.message); }
    return;
  }
  if (!adapter || typeof adapter.call !== "function") {
    const message = `${title} is prepared but not submitted: no wallet adapter or authorized testnet configuration is present.`;
    workflowResult(message, "warning"); toast(message); return;
  }
  let request;
  try { request = buildWorkflowRequest(action, { config: window.PACT_NEAR_CONFIG, targetKey: $("#coalition-select").value }); }
  catch (error) { workflowResult(error.message, "warning"); toast(error.message); return; }
  workflowResult(`${title} request prepared for ${request.contractId}. The wallet must show and approve this exact request.`, "warning");
  toast(`${title} is ready for explicit wallet approval. No automatic signing occurs.`);
  try {
    const result = await adapter.call(request);
    const hash = result?.transactionHash ?? result?.txHash ?? result?.hash ?? result?.transaction?.hash;
    if (!hash) {
      workflowResult(`${title} returned without a transaction hash; nothing is marked confirmed.`, "error");
      return;
    }
    let reconciliation = "receipt received";
    if (typeof adapter.view === "function") {
      const views = await Promise.all(reconciliationViews(window.PACT_NEAR_CONFIG).map((view) => adapter.view(view)));
      reconciliation = `receipt received; status/accounting views refreshed (${views.length})`;
    }
    workflowResult(`${title} submitted: ${hash} · ${reconciliation}.`, "success");
  } catch (error) {
    workflowResult(`${title} was not confirmed: ${error.message || "wallet rejected or transaction failed"}`, "error");
    toast(`${title} was not confirmed.`);
  }
}

function init() {
  renderCommitments(); renderProjectInspector("d"); renderEngine();
  $("#coalition-select").addEventListener("change", renderEngine); $("#topup-toggle").addEventListener("change", renderEngine); $("#condition-select").addEventListener("change", renderEngine);
  const setScenario = (targetKey,topUp=false,condition="none") => {
    $("#coalition-select").value=targetKey;
    $("#topup-toggle").checked=topUp;
    $("#condition-select").value=condition;
    renderEngine();
  };
  $("#solve-gap").addEventListener("click", () => {
    const changed = $("#topup-toggle").checked || $("#condition-select").value !== "none";
    setScenario("abcd", !changed);
  });
  $("#connect-wallet").addEventListener("click", connectWallet); $$(".step-action").forEach((button) => button.addEventListener("click", () => workflowAction(button.dataset.action)));
  $$(".map-node").forEach((node) => { const select = () => renderProjectInspector(node.dataset.project); node.addEventListener("click", select); node.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select(); } }); });
  fetch("./data/evidence.json").then((response) => response.ok ? response.json() : null).then(renderEvidence).catch(() => { $("#evidence-date").textContent = "evidence unavailable"; });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();

export { MODEL, exactPlans, evaluate };
