import { validateProofInput } from "./testnet-proof.mjs";

const $ = selector => document.querySelector(selector);
const form = $("#proof-form");
const button = $("#proof-check");
const panel = $("#proof-result");
const verdict = $("#proof-verdict");
const explanation = $("#proof-explanation");
const symbol = $("#proof-symbol");
const details = $("#proof-details");
const explorer = $("#proof-explorer");

function show(state, title, message, proof = null) {
  panel.dataset.state = state;
  verdict.textContent = title;
  explanation.textContent = message;
  symbol.textContent = state === "verified" ? "✓" : state === "failed" ? "!" : "✳";
  details.hidden = state !== "verified";
  explorer.hidden = state !== "verified";
  if (state === "verified" && proof) {
    $("#proof-method-output").textContent = proof.method;
    explorer.href = proof.explorerUrl;
  } else {
    explorer.removeAttribute("href");
  }
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  if (button.disabled) return;
  const input = {
    contractId: $("#proof-contract").value.trim(),
    signerId: $("#proof-signer").value.trim(),
    transactionHash: $("#proof-hash").value.trim(),
    method: $("#proof-method").value
  };
  const error = validateProofInput(input);
  if (error) { show("failed", "Not verified", error); return; }
  button.disabled = true;
  button.textContent = "Checking testnet…";
  show("checking", "Checking NEAR testnet", "Looking up the finalized transaction and PACT code hash.");
  try {
    const response = await fetch("/api/verify-testnet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });
    const result = await response.json();
    if (!response.ok || !result.verified) {
      show("failed", "Not verified", result.reason || "The testnet evidence could not be confirmed.");
    } else {
      show("verified", "Verified on NEAR testnet",
        "The named method completed with finalized receipts, and the contract's current Wasm matches the preserved PACT build.",
        result);
    }
  } catch {
    show("failed", "Verification unavailable", "The proof endpoint could not be reached. No transaction was treated as verified.");
  } finally {
    button.disabled = false;
    button.replaceChildren("Verify on NEAR ", Object.assign(document.createElement("span"), { textContent: "↗" }));
  }
});
