# PACT Atlas hackathon readiness

PACT Atlas is a constrained, native-NEAR proof of coalition funding. It verifies an immutable campaign configuration, accepts attached refundable commitments, checks a dependency-aware allocation certificate on-chain, and settles or refunds liabilities with pull payments.

This is a serious technical checkpoint, not an externally audited or production-ready financial protocol.

## Self-service experiment for independent judges

Open /create.html from the **Build your own funding plan** link in /console. A judge can start blank or edit the prepared Community Hub scenario. They can set their own project goals, dependencies, contributor constraints and amounts, then inspect or export an exact allocation result. A fundable plan also exposes a testnet-only deployment request requiring an explicit wallet approval; the exported JSON and local plan remain usable without a wallet. The full path is documented in [docs/CAMPAIGN_LAB.md](docs/CAMPAIGN_LAB.md).

The custom planner and the deployed campaign share deterministic public inputs, but the contract remains authoritative for onchain activation. A minimal custom campaign has now been signed and settled on public NEAR testnet, with a separate expired campaign proving refund settlement. The local sandbox evidence in /console remains independently recorded from the public receipts.
## Judge-first demo — 60 seconds

Open `/console`. It begins with one question: **Can we fund all four?** The four named project cards show possible funding coverage, not payments or activations. Five supporters offered 12 NEAR, but the total requirement is 13 NEAR. Events has 2/3 NEAR available.

Click **Simulate +1 NEAR**. The existing bounded exact solver finds a one-use allocation for all four projects and displays the precise supporter-to-project assignments immediately beside the result. Click **Reset example** to return to the blocked case. No wallet is needed and no money moves.

The detailed [judge walkthrough](docs/JUDGE_WITNESS.md) explains the flexible supporter restriction, demonstrates what the model checks, and gives exact reproduction commands. The **Supporters** section explains individual restrictions in plain English. The **Local sandbox evidence** section separately shows preserved NEAR sandbox receipts. The collapsed **Developer tools** section contains optional authorization-gated wallet workflows, not pre-authorized funding.

This is an experimental hackathon prototype with a bounded faucet-funded testnet demonstration, **not** audited production software or a guarantee of project delivery. The cinematic homepage at `/` is preserved; the functional demonstration lives at `/console`.

## What the first-time user can do

1. See project amounts and real dependency requirements without interpreting anonymous network nodes.
2. See why the current commitments cannot fund the full group, including a plain-English explanation of why one pledge cannot pay twice.
3. Preview the extra 1 NEAR safely, watch the funding totals change, and inspect the exact proposed allocation.
4. Select any project or supporter to view its conditions and intended funding choices.
5. Review reproducible model checks and separately recorded local NEAR sandbox receipts.
6. If authorized testnet credentials are available, deploy a dedicated campaign account, share its public link, inspect finalized state and use the wallet-approved commit/activation/settlement actions.

Run `npm run preview` from the repository root and visit `/console`. The browser checks capture desktop/mobile before-and-after screenshots under `test-results/screenshots/`. The evidence viewer loads `web/data/evidence.json` without pretending those receipts came from the browser simulation.

The exact model in `web/engine.mjs` remains unchanged. `web/funding-view.mjs` derives the displayed amounts and checks a candidate allocation. Neither component replaces the contract's authoritative onchain validation. The UI and financial engineering have deliberately separate trust boundaries.

## Do X, see Y

From the repository root:

```sh
npm ci
npm test
RUSTUP_TOOLCHAIN=1.93.0 bash scripts/verify-rust.sh
```

The last command compiles/tests the Rust contract, runs clippy with warnings denied, regenerates the ABI and optimized Wasm, runs the full local JavaScript matrix, launches five fresh NEAR sandbox campaigns, and runs the exact atomic self-service deployment lifecycle. It writes reproducible evidence to `outputs/pact-atlas-sandbox-evidence.json`; checked-in copies are retained under `evidence/`. The RC1 capacity campaign is separate:

```sh
PACT_SCENARIOS=max-capacity PACT_EVIDENCE_PATH=outputs/pact-atlas-rc1-sandbox-evidence.json npm run test:sandbox
```

It exercises 8 projects, 32 pledges, measured storage, activation, settlement and repeated withdrawal rejection without replacing the baseline evidence.

Inspect:

- `outputs/pact-atlas-sandbox-evidence.json` for transaction/receipt hashes, sandbox version, PACT and Sputnik Wasm hashes, contract addresses, state transitions, accounting identities and final balances.
- `outputs/pact_atlas_poc.wasm` and `outputs/pact_atlas_poc_abi.json` for the exact artifacts used by the final evidence.
- `docs/SECURITY_REVIEW.md` for adversarial findings and explicit unresolved risks.
- `docs/TESTNET_CHECKLIST.md` for the network gate and native-transfer limitations.
- `docs/WITHDRAWAL_REVIEW.md` for callback non-execution analysis and safe redesign constraints.

To run one campaign while debugging the harness:

```sh
PACT_SCENARIOS=concurrent npm run test:sandbox
PACT_SCENARIOS=sputnik npm run test:sandbox
```

For the product surface:

```sh
npm run test:counterfactual
NPM_CONFIG_CACHE=/tmp/pact-npm-cache PLAYWRIGHT_BROWSERS_PATH=/tmp/pact-playwright-browsers npm run test:browser
npm run test:workflow
npm run test:wallet-adapter
```

The default is all scenarios: `cycle,all-four,expiry,concurrent,sputnik`.

## Verified behaviors

- 16 Rust unit tests and 35 core Node tests pass; the separate competitive benchmark has 9 passing tests and checks five bounded scenarios against an independent exhaustive oracle.
- The latest local Chromium run has 54 passing tests, covering blocked/viable states, the preserved homepage, public campaign routing, finalized-view rendering with mocked RPC, immutable-config and chain-pledge fail-closed checks, forged-link/RPC-stale wallet blocking, malformed-link rejection, mobile widths, keyboard accessibility and wallet safety. Source artifacts remain pinned; this is not a Lighthouse or production-traffic claim.
- The explicit request/workflow builders pass 8 workflow, 9 live-chain transport/evidence, 8 wallet-adapter and 3 Meteor/testnet-probe tests; no wallet key or signature is bundled in the preview. Wallet Selector modules are loaded only after an action is requested.
- The final Wasm and ABI are rebuilt from the current source state.
- Invalid allocation certificates preserve phase, liabilities and storage stake.
- Concurrent deposits are conserved; competing authorized activations yield one winner; repeated withdrawals and unauthorized private callbacks are rejected.
- Real Sputnik v2 council proposals require both configured council approvals, reject an unauthorized vote, execute a PACT funding call, and recover an expired DAO-owned refund through a second approved proposal.
- The public `accounting()` view demonstrates `locked_pledges + credits + pending == liabilities` and reports the storage reserve check at each exercised state.
- `docs/COMPETITIVE_ADVANTAGE.md` records explicit independent and threshold-pool baselines, bounded exact top-up results, prior art and the limits of the current differentiation claim.

## Remaining blockers

- The bounded faucet-funded testnet run is complete for one activated campaign and one expired/refunded campaign. No mainnet calls, production keys or real funds were used.
- The product now builds explicit wallet requests for campaign deployment, commit, Sputnik proposal creation, local certificate generation, activation and settlement. The host bridge is verified with deterministic wallet doubles and requires a returned transaction hash. The live route uses the corrected `tx` finality RPC, authenticates immutable contract configuration and derives certificates from `pledge_records()` rather than planned supporters. Meteor endpoint compatibility is verified read-only; real Meteor wallet signing and multi-member Sputnik web-wallet approvals remain unverified. A faucet-funded public testnet campaign and a separate expiry/refund campaign are independently recorded in `evidence/pact-atlas-testnet-evidence-2026-11-10.json`.
- Missing callback execution is unresolved. A timeout retry or blind unlock is unsafe because the native transfer may already have succeeded. Pending withdrawals remain fail-closed until a proven authenticated reconciliation design exists.
- Native transfer failure injection through a genuine sandbox predecessor was not reachable without losing the signer needed to initiate withdrawal; the callback `PromiseResult::Failed` branch is covered in Rust VM tests.
- Exact timestamp equality is verified in Rust VM tests; near-workspaces crosses but does not set exact sandbox timestamps. The configured 8-project/32-pledge capacity is verified in `outputs/pact-atlas-rc1-sandbox-evidence.json`.
- A sandbox-backed Vercel preview is route-verified at `https://pact-atlas-rc1-preview-lbtitxcri-iniwura-akurus-projects.vercel.app/` (`dpl_956XYXB54TgehyFobxguQVqFyU1a`). It contains no testnet credentials and is not live-chain evidence.
- The final local evidence/Wasm refresh occurred after that recorded preview. A current preview redeploy is still required before calling the hosted URL the final artifact; it must preserve SSO protection and use preview mode only.
- The code has received an independent adversarial engineering review, but no independent qualified auditor has reviewed it. It must not be described as externally audited.
- The supplied archive has no Git revision/remote, so reproducibility is artifact- and command-based rather than commit-pinned.
- Browser captures are local preview evidence, not chain evidence. The product's browser test verifies that visible balances and scenario counts reconcile with the raw sandbox JSON; it does not replace on-chain receipts.

## Minimal next product milestone

Implement a real multi-DAO coalition activation flow. Each DAO should approve a commitment and the exact activation certificate (or a certificate hash) through Sputnik; the PACT campaign should configure the DAO accounts as activation authorities; and the demo should show:

1. two or more DAOs approve their conditional commitments;
2. a coalition certificate is proposed and approved;
3. the approved certificate activates once, with every pledge used at most once;
4. the UI explains the counterfactual funding: which project would remain unfunded without each DAO, which alternative allocations fail, and why the selected coalition is eligible rather than merely convenient.

That milestone extends the verified accounting and governance primitives without pretending that feasibility verification proves global optimality, delivery, confidentiality or production safety.
