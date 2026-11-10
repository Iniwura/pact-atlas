# PACT Atlas Campaign Lab — judge reproduction

The Campaign Lab at `/create.html` has two explicit modes:

- **Offline planning:** create arbitrary project and supporter constraints, run the bounded exact solver, and export a reproducible model-only certificate without a wallet or network call.
- **Testnet campaign launch:** after a fundable plan is complete, connect an explicit named `*.testnet` wallet, fetch the preserved PACT Wasm, and prepare one atomic multi-action account deployment. The exact parent-owned namespace check permits the tested `CreateAccount → Transfer → DeployContract → new → sponsor_storage` receipt without opening initialization to unrelated accounts. Signing is always wallet-approved and is not available in read-only mode.

The bounded public demonstration is recorded in [`evidence/pact-atlas-testnet-evidence-2026-11-10.json`](../evidence/pact-atlas-testnet-evidence-2026-11-10.json) and [`evidence/pact-atlas-testnet-coalition-evidence-2026-11-10.json`](../evidence/pact-atlas-testnet-coalition-evidence-2026-11-10.json). The latest campaign has two projects, two independent contributors, an out-of-order conditional beta pledge requiring alpha, an accepted two-entry certificate, two beneficiary withdrawals and zero final liabilities. It uses disposable faucet-funded accounts only. Sputnik web-wallet approvals, real Meteor signing and production use remain outside this evidence.

## Offline workflow

1. From `/console`, select **Build your own funding plan**.
2. Choose **Start blank**, name the campaign, and add 1–5 projects. Set whole-NEAR goals, dependency requirements, and (for a future deployment) beneficiary `*.testnet` accounts.
3. Under **Supporters**, enter 1–8 contribution amounts, permitted destinations, and optional conditions requiring particular projects to be funded.
4. Select **Check funding**. The bounded exact allocator returns a valid one-use arrangement or an honest blocked/undetermined result.
5. Select **Download scenario and verification JSON**. The file contains campaign inputs, a model-only status and an exact allocation certificate only when one exists.
6. Independently verify the downloaded file from a clean checkout:

   ```sh
   npm ci
   npm run test:counterfactual
   npm run verify:campaign -- /path/to/pact-campaign-proof.json
   ```

The verifier recomputes the arrangement, rejects tampered, duplicate, partial or unauthorized allocations, and uses no wallet or network calls.

## Testnet launch workflow (prepared, not evidenced)

When an authorized named testnet wallet is connected on a fundable plan:

1. Enter a lowercase campaign slug, activation authority and future activation/deadline windows.
2. The browser downloads `/api/pact-wasm` and checks the SHA-256 against the preserved artifact before creating a wallet request.
3. The request contains `CreateAccount`, a separately funded 3 NEAR `Transfer` before `DeployContract`, contract `new`, and a separately funded 2 NEAR `sponsor_storage` action. The preserved 207 KiB Wasm cannot be covered by the earlier 0.3 NEAR estimate. Pledge funds are never used as the storage reserve.
4. After wallet finality, the UI stores the dedicated campaign account and creates a public `/campaign?contract=…&config=…` link. The share token contains public campaign configuration only.
5. The public page reads finalized `status()`, `accounting()` and `activation_certificate()` views from the free testnet RPC. A contributor chooses whole-project permissions and signs `commit` only after the wallet displays the exact request.
6. A candidate certificate is visibly labeled as model-derived until the configured activation authority submits it. After activation, the page displays the certificate read from finalized contract state.
7. Expiry, withdrawals and pending balances remain explicit. Missing or unknown finality never triggers an automatic retry.

Use `web/campaign-chain.mjs` for deterministic request construction and `web/campaign-live.mjs` for the read/commit/activation/settlement boundary. `web/wallet-selector-host.mjs` loads pinned Wallet Selector v10 Meteor modules only after a user presses a wallet action; the default preview has no credentials. Read-only endpoint checks do not prove a real wallet signature.

## Demonstrate the difference

Open **Use example**: four community projects require 13 NEAR; five supporters offer 12. Add a sixth supporter for 1 NEAR restricted to Events and check funding. PACT finds a valid allocation across the four projects. Remove that permission and the plan fails. The more interesting case is when total available capital is high enough but exact supporter restrictions prevent any valid arrangement.

## Accuracy and safety limits

- The custom planner handles 1–5 projects and 1–8 supporters, with whole contributions and goals of 1–100 NEAR. An expensive search returns **undetermined**, never a fabricated impossibility.
- A contribution is assigned whole to one permitted project or remains unassigned. The planner does not split pledges or pay out unused capital.
- Drafts remain local to the browser. The public campaign link is a shareable configuration plus a deployed account ID; it is not a server campaign registry.
- The immutable Rust contract is one campaign per deployment. It validates the final certificate independently, but it does not prove global optimality or delivery by a beneficiary.
- Existing local NEAR sandbox evidence is separate from browser calculations and public testnet proof.
- The contract is not externally audited. Callback non-execution recovery remains a production blocker; no timeout retry or blind unlock is implemented.

## What makes this different

PACT provides an inspectable one-use funding allocation and an optional contract-backed settlement path that respect contributor destination permissions, conditional funding requirements, project dependencies, exact goals and capital conservation. Judges can create unfamiliar scenarios and independently verify model results. This is a product capability claim, not a claim of novel mathematics or universal superiority over prior coalition/allocation systems.
