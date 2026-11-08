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
  const viable = view.status === "viable";
  const isFull = targetKey === "abcd";
  const changed = topUp || condition !== "none";
  document.body.dataset.coalitionState = view.status;
  $(".map-panel").dataset.state = view.status;
  $(".decision-panel").dataset.state = view.status;

  $("#graph-state").textContent = viable
    ? (isFull ? "All four possible" : "Valid funding plan")
    : (isFull && view.missing === 1n ? "One project short" : "Cannot activate");
  $("#decision-status").innerHTML = viable
    ? '<span aria-hidden="true">●</span> PLAN FOUND'
    : '<span aria-hidden="true">●</span> NEEDS FUNDING';
  $("#decision-heading").innerHTML = isFull
    ? (viable ? 'All four <span class="accent-text">are possible.</span>' : 'Just <span class="accent-text">1 NEAR</span> short.')
    : (viable ? 'This group <span class="accent-text">can work.</span>' : 'This group <span class="accent-text">cannot activate.</span>');
  $("#committed-value").textContent = view.committed.toString();
  $("#required-value").textContent = view.required.toString();
  $("#gap-value").textContent = viable
    ? (view.unassigned ? `${view.unassigned} NEAR unassigned` : "No funding gap")
    : (view.missing ? `${view.missing} NEAR still needed` : "Funding rules not met");
  const progress = $(".money-track");
  progress.setAttribute("aria-valuemax", view.required.toString());
  progress.setAttribute("aria-valuenow", (view.committed < view.required ? view.committed : view.required).toString());
  $("#money-fill").style.width = `${view.required === 0n ? 0 : Math.min(100, Number(view.committed * 100n / view.required))}%`;

  const statusText = (project) => {
    if (!project.selected) return "Not in this plan";
    if (viable) return "Can be funded";
    if (project.visible < project.required) return `Needs ${project.required - project.visible} NEAR`;
    return "Covered in a possible plan";
  };
  for (const project of view.projects) {
    const card = $(`.project-card[data-project="${project.id}"]`);
    if (!card) continue;
    const covered = project.visible === project.required && project.selected;
    card.dataset.inCoalition = String(project.selected);
    card.dataset.state = covered ? "covered" : "gap";
    card.dataset.coverage = `${project.visible}/${project.required}`;
    $(".project-current", card).textContent = project.visible.toString();
    $(".project-required", card).textContent = project.required.toString();
    $(".project-track i", card).style.width = `${project.selected ? Math.round(Number(project.visible * 100n / project.required)) : 0}%`;
    $(".project-state", card).textContent = statusText(project);
    card.setAttribute("aria-label", `${project.label}: ${project.visible} of ${project.required} NEAR; ${statusText(project)}. Select to inspect.`);
  }
  $("#coverage-caption").textContent = viable
    ? "Exact funding plan from the local model. No funds have moved."
    : "Possible coverage, not payments made or projects activated.";

  let explanation = "";
  if (viable) {
    const allocationCards = view.projects.filter(project => project.selected).map(project => {
      const rows = view.rows.filter(row => row.project === project.id);
      return `<div class="proof-project">
        <div class="proof-project-head"><strong>${project.label}</strong><span>${project.required} NEAR</span></div>
        <p>${rows.map(row => `${row.donor.replace(/^Donor /, "Supporter ")} · ${row.amount} NEAR`).join(" + ")}</p>
      </div>`;
    }).join("");
    explanation = `<div class="allocation-overview">
        <strong>Where the money goes</strong><span>${view.rows.length} contributions · ${view.targetIds.length} projects</span>
      </div>
      <div id="allocation-proof" class="allocation-proof">
        <div class="proof-groups">${allocationCards}</div>
        <div class="proof-checks" aria-label="What the local model checks">
          <span>Each pledge used once</span><span>Supporter rules met</span><span>Dependencies met</span>
        </div>
        <p class="proof-limit">Checked against the local model, not an onchain transaction.</p>
      </div>`;
  } else if (view.baseline) {
    explanation = `<p class="result-brief"><strong>Events needs 1 more NEAR.</strong> The other three projects can be covered together, but they can't activate the full group yet.</p>
      <details class="why-disclosure">
        <summary>Why can't we use the existing money?</summary>
        <p>Supporter 01 offered 3 NEAR for either Training or Events. It cannot pay for both. PACT finds a plan that respects that choice.</p>
      </details>`;
  } else {
    explanation = `<p class="result-brief">${view.reasons[0] || "These commitments cannot fund this combination of projects."}</p>`;
  }
  $("#engine-result").innerHTML = explanation;
  const button = $("#solve-gap");
  button.innerHTML = changed
    ? '<span>Reset example</span><span class="action-arrow" aria-hidden="true">↺</span>'
    : '<span>Simulate +1 NEAR</span><span class="action-arrow" aria-hidden="true">↗</span>';
  button.setAttribute("aria-pressed", String(changed));
  const selected = $(".project-card[aria-pressed=true]")?.dataset.project || "d";
  renderProjectInspector(selected, view);
}
function renderCommitments() {
  $("#commitment-list").innerHTML = MODEL.pledges.map(pledge => `<article class="commitment-row" data-pledge="${pledge.id}" role="button" tabindex="0" aria-label="Inspect supporter ${pledge.id}">
    <span class="pledge-index">${pledge.id}</span>
    <span class="pledge-name"><strong>${pledge.owner.replace(/^Donor /, "Supporter ")}</strong><span>${pledge.requires.length ? "Only if related projects are funded" : "Flexible commitment"}</span></span>
    <strong class="pledge-amount">${pledge.amount} NEAR</strong>
    <span class="pledge-targets">${pledge.allowed.map(id => `<i class="target-pill" title="${MODEL.projects[id].label}">${id.toUpperCase()}</i>`).join("")}</span>
  </article>`).join("");
  $$(".commitment-row").forEach(row => {
    const choose = () => {
      $$(".commitment-row").forEach(item => item.classList.remove("selected"));
      row.classList.add("selected");
      renderPledgeInspector(row.dataset.pledge);
    };
    row.addEventListener("click", choose);
    row.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose(); }
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
  $("#commitment-detail").innerHTML = `<h3>${pledge.owner.replace(/^Donor /, "Supporter ")}</h3>
    <p>${pledge.amount} NEAR can go to ${destinations}.</p>
    ${condition ? `<p>${condition}</p>` : ""}
  `;
}

function renderProjectInspector(projectId, view = fundingView($("#coalition-select").value, $("#topup-toggle").checked, $("#condition-select").value)) {
  const project = MODEL.projects[projectId];
  const funding = view.projects.find(item => item.id === projectId);
  if (!project || !funding) return;
  const deps = project.dependencies.map(id => MODEL.projects[id].label);
  const amount = `${funding.visible} of ${funding.required} NEAR`;
  const relationship = deps.length ? `Needs ${deps.join(" and ")}` : "Can run independently";
  $("#project-inspector").innerHTML = `<span class="inspector-symbol">${project.short}</span>
    <span class="inspector-body"><strong>${project.label}</strong>
      <span>${amount} ${view.status === "viable" ? "assigned in the plan" : "available in a possible plan"}</span>
      <small>${relationship}</small></span>`;
  $$(".project-card").forEach(card => {
    const selected = card.dataset.project === projectId;
    card.setAttribute("aria-pressed", String(selected));
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
  renderCommitments(); renderEngine();
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
  $(".project-card").forEach(card => card.addEventListener("click", () => renderProjectInspector(card.dataset.project)));
  fetch("./data/evidence.json").then((response) => response.ok ? response.json() : null).then(renderEvidence).catch(() => { $("#evidence-date").textContent = "evidence unavailable"; });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();

export { MODEL, exactPlans, evaluate };
