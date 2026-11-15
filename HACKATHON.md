# PACT Atlas hackathon readiness

> **Submitted 14 November 2026.** [Launch the NEAR testnet product](https://pact-atlas-near-connect.vercel.app/) · [Watch the submitted X demo](https://x.com/saitama_xc/status/2121722670546919654) · [Inspect public transaction evidence](docs/TESTNET_PROOF.md). The repository includes pinned contract artifacts, a reproducible allocation model, sandbox tests and public testnet campaign lifecycles. This is an experimental build, not a production financial service.

PACT Atlas is a constrained, native-NEAR proof of coalition funding. It verifies an immutable campaign configuration, accepts attached refundable commitments, checks a dependency-aware allocation certificate on-chain, and settles or refunds liabilities with pull payments.

This is a serious technical checkpoint, not an externally audited or production-ready financial protocol.

## Self-service campaign creation

Open /create.html from the **Create campaign** action in /console. Every new visitor starts with a blank draft. They can set their own project goals, dependencies, contributor constraints and amounts, then inspect or export an exact allocation result. A fundable plan also exposes a testnet-only deployment request requiring an explicit wallet approval; the exported JSON and local plan remain usable without a wallet. The full path is documented in [docs/CAMPAIGN_LAB.md](docs/CAMPAIGN_LAB.md).

The custom planner and the deployed campaign share deterministic public inputs, but the contract remains authoritative for onchain activation. Three minimal campaigns have now been signed and settled on public NEAR testnet: an activated single-project campaign, an expired/refunded campaign, and a two-project dependency coalition with independent out-of-order contributions and an accepted activation certificate. Local sandbox evidence remains independently recorded in the repository, separate from public-chain receipts.
## Judge-first product walkthrough

Open `/console` as a first-time user. This is a consumer workspace, not a simulation or a developer evidence board. Browse actual recorded testnet campaigns; see the conditional two-project coalition at the top, and use **Campaigns** to open its signed immutable public configuration. The campaign page reads finalized chain state when testnet RPC is available and fails closed otherwise.

Open **Activity** to inspect independent contribution, activation, payout, expiry and refund receipts. Each transaction is clickable. Visit **Create campaign** to begin a blank draft and set project dependencies and contribution conditions. A funding plan can be checked locally before wallet approval. No production funds are supported.

The cinematic marketing homepage at `/` retains its approved design and now leads to **Open App**.

## What the first-time user can do

1. Browse recorded real NEAR testnet campaigns, with separate chain-verified versus archived status.
2. See project dependency rules and the real two-project activation certificate.
3. Create a blank campaign, configure beneficiaries, goals and contributor restrictions, and check an exact local funding plan.
4. Inspect a real campaign, where immutable contract state is checked on load.
5. Follow each recorded contribution, beneficiary withdrawal and refund directly in the explorer.
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
- The latest **executed** release QA is **118/118 Chromium browser tests** (zero retries) and **109/109 Node tests** across eight scripts, on the NEAR Connect implementation, 14 November 2026. Earlier 58- and 116-test checkpoints are historical. Account-selection tests do not prove completed extension authorization, signed transactions or mainnet safety.
- The request/workflow, RPC, chain and wallet adapters passed their current automated suites. **NEAR Connect** is lazy-loaded after the user selects Connect; its initial account sign-in deliberately omits function-call access-key creation. Funds are not transferred or approved by merely opening the chooser.
- The final Wasm and ABI are rebuilt from the current source state.
- Invalid allocation certificates preserve phase, liabilities and storage stake.
- Concurrent deposits are conserved; competing authorized activations yield one winner; repeated withdrawals and unauthorized private callbacks are rejected.
- Real Sputnik v2 council proposals require both configured council approvals, reject an unauthorized vote, execute a PACT funding call, and recover an expired DAO-owned refund through a second approved proposal.
- The public `accounting()` view demonstrates `locked_pledges + credits + pending == liabilities` and reports the storage reserve check at each exercised state.
- `docs/COMPETITIVE_ADVANTAGE.md` records explicit independent and threshold-pool baselines, bounded exact top-up results, prior art and the limits of the current differentiation claim.

## Remaining blockers

- The bounded faucet-funded testnet run is complete for three campaigns: one activation/withdrawal, one expiry/refund, and one two-project dependency coalition with two beneficiary withdrawals. No mainnet calls, production keys or real funds were used.
- The product now builds explicit wallet requests for campaign deployment, commit, Sputnik proposal creation, local certificate generation, activation and settlement. The host bridge is verified with deterministic wallet doubles and requires a returned transaction hash. The live route uses the corrected `tx` finality RPC, authenticates immutable contract configuration and derives certificates from `pledge_records()` rather than planned supporters. Meteor endpoint compatibility is verified read-only; real Meteor wallet signing and multi-member Sputnik web-wallet approvals remain unverified. The three public campaigns are independently recorded in `evidence/pact-atlas-testnet-evidence-2026-11-10.json` and `evidence/pact-atlas-testnet-coalition-evidence-2026-11-10.json`.
- Missing callback execution is unresolved. A timeout retry or blind unlock is unsafe because the native transfer may already have succeeded. Pending withdrawals remain fail-closed until a proven authenticated reconciliation design exists.
- Native transfer failure injection through a genuine sandbox predecessor was not reachable without losing the signer needed to initiate withdrawal; the callback `PromiseResult::Failed` branch is covered in Rust VM tests.
- Exact timestamp equality is verified in Rust VM tests; near-workspaces crosses but does not set exact sandbox timestamps. The configured 8-project/32-pledge capacity is verified in `outputs/pact-atlas-rc1-sandbox-evidence.json`.
- The latest public testnet review is `https://pact-atlas-near-connect.vercel.app/` and the rendered NEAR Connect host matches the tested wallet integration. This replaces earlier design and legacy wallet previews.
- The public preview matches the last tested UI revision. Documentation-only commits made afterwards do not change rendered assets or onchain code. The project-wide production alias and GitHub `main` are **not yet** the consolidated release; keep this distinction until approved.
- The code has received an independent adversarial engineering review, but no independent qualified auditor has reviewed it. It must not be described as externally audited.
- This project now has a public GitHub remote, source branch, exact UI and documentation commits, and independently inspectable testnet evidence. The default `main` is an older checkpoint until PR #22 is merged.
- Browser captures are local preview evidence, not chain evidence. The product's browser test verifies that visible balances and scenario counts reconcile with the raw sandbox JSON; it does not replace on-chain receipts.

## Minimal next product milestone

Implement a real multi-DAO coalition activation flow. Each DAO should approve a commitment and the exact activation certificate (or a certificate hash) through Sputnik; the PACT campaign should configure the DAO accounts as activation authorities; and the demo should show:

1. two or more DAOs approve their conditional commitments;
2. a coalition certificate is proposed and approved;
3. the approved certificate activates once, with every pledge used at most once;
4. the UI explains the counterfactual funding: which project would remain unfunded without each DAO, which alternative allocations fail, and why the selected coalition is eligible rather than merely convenient.

That milestone extends the verified accounting and governance primitives without pretending that feasibility verification proves global optimality, delivery, confidentiality or production safety.
