import { MODEL, exactPlans, evaluate } from "./engine.mjs";
import { buildWorkflowRequest, certificateFor, reconciliationViews } from "./near-workflow.mjs";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const near = (value) => `${value.toString()}N`;

function renderEngine() {
  const targetKey = $("#coalition-select").value;
  const topUp = $("#topup-toggle").checked;
  const condition = $("#condition-select").value;
  const result = evaluate(targetKey, topUp, condition);
  const feasible = result.plans.length > 0;
  document.body.dataset.coalitionState = feasible ? "viable" : "blocked";
  // Presentation-only feedback. The solver result and wallet boundary are unchanged.
  const graphState = document.getElementById("graph-state");
  if (graphState) {
    graphState.dataset.state = feasible ? "viable" : "blocked";
    graphState.textContent = feasible ? "Certificate found" : "No exact certificate";
  }
  const indicator = document.getElementById("result-indicator");
  if (indicator) {
    indicator.dataset.state = feasible ? "viable" : "blocked";
    indicator.textContent = feasible ? "VIABLE" : "BLOCKED";
  }
  $(".map-node").forEach(node => {
    node.dataset.inCoalition = String(targetKey.includes(node.dataset.project));
    node.dataset.simulated = node.dataset.project === "d" && targetKey.includes("d") && topUp ? "added" : "baseline";
  });
  const plan = result.plans[0];
  const allocationText = plan ? plan.allocations.filter(Boolean).map((item) => `${item.pledge}→${item.project.toUpperCase()}`).join(" · ") : "No exact certificate";
  const headline = feasible ? `${result.targetLabel} becomes <em>viable.</em>` : `${result.targetLabel} is still <em>blocked.</em>`;
  const copy = feasible ? `The bounded search found ${result.plans.length} exact allocation certificate${result.plans.length === 1 ? "" : "s"}. Every used pledge lands on one allowed project, and every dependency closes.` : "This is not a vague shortage. The engine can point to the exact permission, amount or dependency that prevents activation.";
  $("#engine-result").innerHTML = `<div class="result-main">
    <p class="result-kicker">${feasible ? "exact / certificate found" : "exact search / no certificate"}</p>
    <h3 class="result-title">${headline}</h3>
    <p class="result-copy">${copy}</p>
    <div class="result-badges"><span class="result-badge ${feasible ? "" : "warn"}">${feasible ? "exact result" : "blocked state"}</span><span class="result-badge">${result.plans.length ? `${result.plans.length} allocation${result.plans.length === 1 ? "" : "s"}` : "heuristic next move"}</span><span class="result-badge">${condition === "none" ? "approved conditions unchanged" : "model-only change"}</span></div>
    ${plan ? `<div class="result-certificate"><span>allocation certificate</span><strong>${allocationText}</strong></div>` : ""}
  </div><div class="result-side">
    <p class="result-side-label">minimum additional funding</p>
    <p class="result-number">${near(result.minimum)}<small>${result.minimum === 0n ? "already reachable" : "to unblock"}</small></p>
    <ul class="reason-list">${(feasible ? [`${result.targetLabel} satisfies the mandatory coalition rule.`, "Liability conservation is exact.", "This is a model result; it does not submit or alter a DAO proposal."] : result.reasons).map((reason) => `<li>${reason}</li>`).join("")}</ul>
  </div>`;
}

function renderCommitments() {
  $("#commitment-list").innerHTML = MODEL.pledges.map((pledge, index) => `<article class="commitment-row" data-pledge="${pledge.id}" tabindex="0" role="button" aria-label="Inspect ${pledge.owner} commitment">
    <span class="pledge-index">${pledge.id}</span><span class="pledge-name"><strong>${pledge.owner}</strong><span>${pledge.note}</span></span><strong class="pledge-amount">${near(pledge.amount)}</strong><span class="pledge-targets">${pledge.allowed.map((id) => `<i class="target-pill ${pledge.requires.length ? "conditioned" : ""}">${id.toUpperCase()}</i>`).join("")}</span>
  </article>`).join("");
  $$(".commitment-row").forEach((row) => {
    const select = () => { $$(".commitment-row").forEach((item) => item.classList.remove("selected")); row.classList.add("selected"); renderPledgeInspector(row.dataset.pledge); };
    row.addEventListener("click", select); row.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select(); } });
  });
}

function renderPledgeInspector(pledgeId) {
  const pledge = MODEL.pledges.find((item) => item.id === pledgeId);
  if (!pledge) return;
  $(".map-node").forEach(node => { node.classList.remove("selected"); node.setAttribute("aria-pressed","false"); });
  const detail = document.getElementById("commitment-detail");
  if (detail) detail.innerHTML = `<p class="inspector-kicker">COMMITMENT ${pledge.id}</p><h3>${pledge.owner}</h3><p>${near(pledge.amount)} permitted toward ${pledge.allowed.map(id=>MODEL.projects[id].label).join(" or ")}. ${pledge.requires.length?`Usable only if ${pledge.requires.map(id=>MODEL.projects[id].short).join(" + ")} are funded.`:"No additional dependency condition."}</p><div class="inspector-stat"><span>Amount</span><strong>${near(pledge.amount)}</strong></div><div class="inspector-stat"><span>Eligible routes</span><strong>${pledge.allowed.map(id=>id.toUpperCase()).join(" / ")}</strong></div>`;
  $("#project-inspector").innerHTML = `<p class="inspector-kicker">Commitment ${pledge.id} / ${pledge.note}</p><div class="inspector-symbol">${pledge.id}</div><h3>${pledge.owner}</h3><p>${near(pledge.amount)} permitted toward ${pledge.allowed.map((id) => MODEL.projects[id].label).join(" or ")}. ${pledge.requires.length ? `It becomes usable only when ${pledge.requires.map((id) => MODEL.projects[id].short).join(" + ")} are funded.` : "It has no additional dependency condition."}</p><div class="inspector-stat"><span>Amount</span><strong>${near(pledge.amount)}</strong></div><div class="inspector-stat"><span>Allowed routes</span><strong>${pledge.allowed.map((id) => id.toUpperCase()).join(" / ")}</strong></div><div class="inspector-stat"><span>Requires</span><strong>${pledge.requires.length ? pledge.requires.map((id) => id.toUpperCase()).join(" + ") : "None"}</strong></div>`;
}

function renderProjectInspector(projectId) {
  $(".commitment-row").forEach(item => item.classList.remove("selected"));
  const project = MODEL.projects[projectId];
  if (!project) return;
  $("#project-inspector").innerHTML = `<p class="inspector-kicker">Project node / ${project.short}</p><div class="inspector-symbol">${project.short}</div><h3>${project.label}</h3><p>${project.copy}</p><div class="inspector-stat"><span>Required</span><strong>${near(project.required)}</strong></div><div class="inspector-stat"><span>Dependencies</span><strong>${project.dependencies.length ? project.dependencies.map((id) => id.toUpperCase()).join(" + ") : "None"}</strong></div><div class="inspector-stat"><span>Current coverage</span><strong>${near(MODEL.pledges.filter((pledge) => pledge.allowed.includes(projectId)).reduce((sum, pledge) => sum + pledge.amount, 0n))}</strong></div>`;
  $$(".map-node").forEach((node) => {
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
  renderEngine(); renderCommitments(); renderProjectInspector("a");
  $("#coalition-select").addEventListener("change", renderEngine); $("#topup-toggle").addEventListener("change", renderEngine); $("#condition-select").addEventListener("change", renderEngine);
  const setScenario = (targetKey,topUp=false,condition="none") => {
    $("#coalition-select").value=targetKey;
    $("#topup-toggle").checked=topUp;
    $("#condition-select").value=condition;
    renderEngine();
  };
  $("#show-gap")?.addEventListener("click",()=>setScenario("abcd",false));
  $("#solve-gap")?.addEventListener("click",()=>setScenario("abcd",true));
  $("#reset-scenario")?.addEventListener("click",()=>setScenario("abc"));
  $("#connect-wallet").addEventListener("click", connectWallet); $$(".step-action").forEach((button) => button.addEventListener("click", () => workflowAction(button.dataset.action)));
  $$(".map-node").forEach((node) => { const select = () => renderProjectInspector(node.dataset.project); node.addEventListener("click", select); node.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select(); } }); });
  fetch("./data/evidence.json").then((response) => response.ok ? response.json() : null).then(renderEvidence).catch(() => { $("#evidence-date").textContent = "evidence unavailable"; });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();

export { MODEL, exactPlans, evaluate };
