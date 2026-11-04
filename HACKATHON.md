# PACT Atlas hackathon readiness

PACT Atlas is a constrained, native-NEAR proof of coalition funding. It verifies an immutable campaign configuration, accepts attached refundable commitments, checks a dependency-aware allocation certificate on-chain, and settles or refunds liabilities with pull payments.

This is a serious technical checkpoint, not an externally audited or production-ready financial protocol.

## Judge-first demo — 60 seconds

Open `/console` and follow [the allocation witness](docs/JUDGE_WITNESS.md). The default full coalition is blocked: **12 NEAR is pledged, 13 NEAR is required**. Eligibility totals *appear* to be 15 NEAR because Donor 01's flexible commitment can count for either A or D; PACT cannot spend it twice. Click **Simulate +1 NEAR** to run a model-only counterfactual, then inspect the exact one-use allocation for all four projects and reproduce it with `node scripts/certificate.js --topup`.

This is a bounded, local reference-model demo accompanied by **separately obtained local NEAR sandbox evidence**. It is not a real wallet transfer, a public testnet deployment, or an independent audit. The approved cinematic homepage remains separate from the functional console.

## Coalition Atlas product

The `web/` application is the judge-facing product surface. Its first viewport explains the cooperation thesis in seconds, the constraint graph makes dependencies inspectable, and the counterfactual engine lets a judge switch between the feasible A+B+C core, the blocked full A+B+C+D coalition, and a model-only additional commitment. The commitment inspector, workflow rail and evidence ledger keep model state, contract state and future wallet state visually distinct. The frontend design rationale and measured local redesign report are in `docs/DESIGN_DIRECTION.md` and `docs/FRONTEND_REDESIGN_REPORT.md`; final desktop/mobile captures are in `docs/design-evidence/`.

Run `npm run preview` from the repository root to open it locally. The genuine sandbox evidence is loaded from `web/data/evidence.json`; the UI does not present simulated testnet activity. The browser campaign saves fresh local captures under `test-results/screenshots/`; the preserved RC1 captures are in `evidence/screenshots/`.

The exact solver is shared by `web/engine.mjs` and `web/tests/counterfactual.test.mjs`. Exhaustive results are labelled exact; a suggested condition change is labelled model-only and is never applied to a DAO.

### Design iterations

1. The first pass established the dark ink / lime / coral editorial system, the orbital dependency map and the five-step action rail.
2. Browser review tightened muted-label contrast, removed an inaccessible SVG image-role nesting, and kept the same visual language while making keyboard and automated accessibility checks pass.
3. The premium redesign introduced the signal/proof system: electric-blue dependency routes, staged product narrative, graph-to-inspector interaction, evidence phase/liability rows and a tighter responsive proof ledger. It remains frontend-only and sandbox-backed.

The result is deliberately a sandbox-backed Vercel product preview around verified evidence, not a claim that a wallet-connected public testnet workflow has already run. The verified preview URL and deployment record are in `docs/VERCEL_PREVIEW.md`.

## Do X, see Y

From the repository root:

```sh
npm ci
npm test
RUSTUP_TOOLCHAIN=1.93.0 bash scripts/verify-rust.sh
```

The last command compiles/tests the Rust contract, runs clippy with warnings denied, generates the ABI, builds optimized Wasm, runs the 26-case reference model and competitive benchmark suites, and launches five fresh NEAR sandbox campaigns. It writes reproducible evidence to `outputs/pact-atlas-sandbox-evidence.json`. The RC1 capacity campaign is separate:

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

- 14 Rust unit tests and 26 independent reference-model tests pass; the separate competitive benchmark has 9 passing tests and checks five bounded scenarios against an independent exhaustive oracle.
- The current frontend regression is 12/12 browser checks passing, including two redesign journeys; the local performance measurement is recorded in `docs/FRONTEND_REDESIGN_REPORT.md` and is not a Lighthouse claim.
- The explicit request builder passes 5 tests, and the optional HOT Connect / Wallet Selector-compatible bridge passes 4 deterministic tests; no wallet package, key or signature is bundled in the preview.
- The final Wasm and ABI are rebuilt from the current source state.
- Invalid allocation certificates preserve phase, liabilities and storage stake.
- Concurrent deposits are conserved; competing authorized activations yield one winner; repeated withdrawals and unauthorized private callbacks are rejected.
- Real Sputnik v2 council proposals require both configured council approvals, reject an unauthorized vote, execute a PACT funding call, and recover an expired DAO-owned refund through a second approved proposal.
- The public `accounting()` view demonstrates `locked_pledges + credits + pending == liabilities` and reports the storage reserve check at each exercised state.
- `docs/COMPETITIVE_ADVANTAGE.md` records explicit independent and threshold-pool baselines, bounded exact top-up results, prior art and the limits of the current differentiation claim.

## Remaining blockers

- No testnet run: no safe testnet credentials or explicit deployment authorization were present. No mainnet calls, production keys or real funds were used.
- The product now builds explicit wallet requests for commit, Sputnik proposal creation, local certificate generation, activation and settlement. The host bridge is verified with deterministic wallet doubles and requires a returned transaction hash; HOT Connect/Wallet Selector signing, multi-member Sputnik web-wallet approvals and public testnet settlement remain unverified until an authorized isolated testnet campaign is approved.
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
