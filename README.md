# PACT Atlas

**Conditional community funding, verified on NEAR.**

PACT Atlas helps a group fund projects that depend on each other. Contributors choose where their commitments may go and what else must be funded first. The contract accepts a valid allocation only when the conditions are met, with no pledge counted twice. If a campaign expires, unused contributions become refundable.

**Release status: testnet-only application preview.** Three real NEAR testnet campaigns prove activation, a full refund and a two-project dependency coalition. The current application has a campaign workspace, a clean creation flow, authenticated testnet campaign readers, and independently linked transaction activity. Its browser-wallet signing flow has **not** completed genuine extension signing, and an unresolved missing-withdrawal-callback issue prevents safe use with valuable funds. Do not use PACT Atlas for production deposits. This is not an independently audited financial service.

### Use the application

1. **Overview — `/console`.** See actual recorded NEAR testnet campaigns, a dependency-aware funding agreement, and links to public receipt history. No fictional funding is shown in the console.
2. **Campaigns — `/console#campaigns`.** Filter funded and expired campaigns. Each campaign link contains the recorded immutable configuration; opening it triggers a fresh code-hash and finalized-accounting check. If RPC fails, no unverified live state is claimed.
3. **Open a shared agreement.** Paste an organizer’s full campaign URL in the workspace. The app validates its public share-token format and opens the agreement on PACT’s own origin, where immutable contract checks are repeated; it never redirects to an arbitrary pasted host.
4. **Create — `/create.html`.** Start from a blank private draft, add projects and conditions, preview an exact bounded funding plan, then optionally authorize a testnet contract deployment through a real wallet. The deployment path is implemented but its browser-extension signing is not yet proven end-to-end.
5. **Activity — `/console#activity`.** Inspect genuine recorded testnet contributions, activation, withdrawals and refunds. Every receipt opens NEAR testnet explorer. Saved successful deployments appear in the same browser's campaign workspace, subject to independent live-contract checks.
6. **Verify — `/verify.html`.** Independently inspect finalized transactions and matching contract code. This requires no wallet.

The approved cinematic landing page remains at `/`. No user money moves merely by exploring or configuring a draft.

**What is proven:** three faucet-funded public testnet campaign lifecycles, including a two-project conditional coalition and an expiry/refund case. **What is not proven:** authentic browser-extension signing, independent security audit, public Sputnik governance execution and recovery when a withdrawal callback never arrives. Do not use valuable funds.

The recorded proof is in [the coalition manifest](evidence/pact-atlas-testnet-coalition-evidence-2026-11-10.json), [the settlement/refund manifest](evidence/pact-atlas-testnet-evidence-2026-11-10.json), and [the financial safety review](docs/FINAL_HARDENING_REVIEW_2026-11-12.md). GitHub Actions is blocked by account billing restrictions. The [latest isolated Chrome and Node verification](docs/RELEASE_QA_2026-11-13.md) documents the executed 118 checks and limitations.

## NEAR HACKATHON submission candidate

Primary track: **Social Money**. PACT Atlas is a native-NEAR, testnet-only
prototype for communities whose approved funding commitments become feasible
only when project dependencies and contributor conditions are satisfied
together. The contract verifies one-use pledge allocations and preserves an
inspectable activation certificate; the browser explains the counterfactual
before any wallet action. The public evidence is faucet-funded and bounded,
not production financial security or an external audit.

Judge the release with the [executed 118-test product audit](docs/RELEASE_QA_2026-11-13.md), [reproducible walkthrough](docs/JUDGE_WITNESS.md),
[submission description](docs/SUBMISSION_DESCRIPTION.md), and
[release checklist](docs/SUBMISSION_CHECKLIST_2026-11-10.md). The repository
must be made public before submission; no access or submission action is
performed by this checkout.

## Make your own campaign

From the workspace, select **Create campaign** or open /create.html directly. Set 1–5 projects, their funding requirements and dependencies, then enter 1–8 supporters with permitted destinations and optional conditions. Select **Check funding** to see a valid whole-contribution allocation or an explained blocked result.

The draft is stored only in your browser. Select **Export funding plan**, then independently check it with:

    npm run verify:campaign -- /path/to/pact-campaign-proof.json

An exact plan can continue into an explicitly labeled **Deploy this campaign to NEAR testnet** flow. That flow builds a multi-action account deployment request and waits for wallet finality before creating a shareable campaign link. No credentials are bundled. The original local NEAR sandbox receipts and separately recorded public testnet lifecycles remain distinct. See [the Campaign Lab judge guide](docs/CAMPAIGN_LAB.md).

## Share a live campaign (testnet path)

After an authorized wallet deploys a fundable campaign, open the generated `/campaign?contract=…&config=…` link. The page reads finalized `status()`, `accounting()` and certificate views from the free NEAR testnet RPC, shows project conditions, lets a contributor prepare a whole-pledge `commit`, and exposes activation, expiry and withdrawal actions only through explicit wallet approval. A candidate allocation is labeled model-derived until the contract accepts the authority activation; a wallet hash without finalized success is never presented as settled.

This path is implemented and browser-tested with deterministic RPC/wallet doubles, and it has now been exercised against three real faucet-funded testnet campaigns. The latest campaign accepted two independent pledges out of order, including a conditional beta pledge requiring alpha, activated both projects with the exact certificate retained by the contract, and settled both beneficiary withdrawals. These receipts are evidence for the bounded demonstration only, not a production-safety claim.

## Public coalition evidence (testnet)

The strongest public demonstration is [`coalition-20261110.beneficiary-20261110.testnet`](https://testnet.nearblocks.io/address/coalition-20261110.beneficiary-20261110.testnet). It contains two 1 NEAR projects: `beta` depends on `alpha`; the beta pledge was submitted first by `refund-supporter-20261110.testnet`, the alpha pledge second by `supporter-20261110.testnet`, and the configured authority later activated the accepted certificate `[1 → alpha, 0 → beta]`. Both beneficiaries withdrew, and the finalized contract accounting reconciled to zero liabilities.

Use the [machine-readable coalition evidence](evidence/pact-atlas-testnet-coalition-evidence-2026-11-10.json) and reproduce individual method proofs with:

```sh
npm run verify:testnet -- coalition-20261110.beneficiary-20261110.testnet refund-supporter-20261110.testnet 39QG8aueJBWZEcJYHZtVorjbyc9WJiJ1u9gdz9WjuDKN commit
npm run verify:testnet -- coalition-20261110.beneficiary-20261110.testnet supporter-20261110.testnet 8t22n71EQDb5WCswgLu7MUH3aVeyoFaCVdKgtQBUVje3 commit
npm run verify:testnet -- coalition-20261110.beneficiary-20261110.testnet beneficiary-20261110.testnet 31FxH2YE9FEm7iq49AH6eXMvZYiFv7Y3jeqd8rThK96v activate
```
## Verify public NEAR testnet evidence (read-only)

The new `/verify.html` page checks a supplied NEAR testnet transaction against the chain's finalized method execution and the current code hash of the deployed contract. Only the pinned PACT Wasm code hash is accepted. No funds or wallets are used by verification.

Reproduce independently with `npm run verify:testnet -- <contract.testnet> <signer.testnet> <hash> commit`. This verifies the named method execution, **not** an entire campaign lifecycle or secure delivery of payouts. The completed public campaign/refund evidence is recorded in [the baseline testnet manifest](evidence/pact-atlas-testnet-evidence-2026-11-10.json), and the multi-project dependency campaign is recorded in [the coalition manifest](evidence/pact-atlas-testnet-coalition-evidence-2026-11-10.json). See [testnet proof and release gates](docs/TESTNET_PROOF.md).

## First-use product journey

Run `npm run preview`, then open `/console`. The application opens on actual recorded public testnet campaigns, not on a seeded simulation. The funded coalition demonstrates two projects where Beta depends on Alpha. Open the campaign to read immutable conditions, finalized status and accounting. Follow the Activity receipts to independently inspect both contributions, activation and individual payouts. The expired campaign supplies a separate contribution → expiry → refund history.

Select **Create campaign** to begin a blank draft. Configure at least one named project, its beneficiary account and supporter conditions. A fundable local plan can be reviewed and exported; it is not itself a transaction. Onchain deployment requires a separate testnet wallet approval and remains an unverified browser E2E integration, so the product cannot claim that onboarding succeeds until an authentic wallet path is completed.

The approved cinematic homepage is preserved. The archived model and sandbox proof remain in this repository for reproducible engineering review, not as fictional user activity in the app.

## Experiment

Can independently funded, mutually dependent projects activate together, without using a contributor's money twice, and can all unmatched/expired contributions be recovered?

Our four-project example:

| Project | Need | Condition |
| --- | --- | --- |
| A training | 4 NEAR | B and C funded |
| B internet | 3 NEAR | A funded |
| C equipment | 3 NEAR | A funded |
| D events | 3 NEAR | none |

Five contributors put in 12 NEAR total. A flexible donor can pledge 3 NEAR to either A or D. The feasible coalition is A+B+C (10 NEAR allocated), while 2 NEAR committed to D remains recoverable. A sixth contributor adding 1 NEAR to D raises total commitments to 13 NEAR and makes all four feasible.

**Important distinction:** The scenario defeats naive *independent* evaluation of projects because A/B/C form a dependency cycle; it does not prove a novel general mathematical result. Conditional optimization and coalition financing have established prior art.

## Contents

- `contract/src/lib.rs`: first-pass near-sdk Rust native-NEAR contract for an immutable campaign, attached deposits, contract-verified coalition activation, timed expiry, refundable unused pledges, and asynchronous withdrawals with failure recovery.
- `reference/model.js`: independent, executable JavaScript financial reference model with an exhaustive bounded solver (not a NEAR virtual machine).
- `reference/competitive.js`: explicit independent/threshold/PACT benchmark semantics, bounded exact top-up search and separate exhaustive oracle.
- `tests/pact.test.js`: 26 conservation, coalition, timing and adversarial tests for the reference model.
- `scripts/certificate.js`: emits machine-readable reproducible offline allocation evidence, deliberately labeled OFFLINE-NOT-ONCHAIN.
- `scripts/sandbox-verification.js`: launches a fresh NEAR sandbox per scenario, deploys the compiled Wasm, attaches real native NEAR deposits, and writes receipt/balance evidence.
- `vendor/sputnik/sputnikdao2_original.wasm`: pinned official Sputnik v2 DAO Wasm used only by the local governance sandbox.
- `HACKATHON.md`: judge-facing reproducibility, evidence map, blockers and next milestone.
- `web/`: the Coalition Atlas product preview, exact counterfactual engine, self-service campaign deployment path, public campaign page, evidence viewer and wallet-safe workflow boundary.
- `docs/ARCHITECTURE.md`: data, contract, governance and evidence-boundary diagrams.
- `web/NEAR_WORKFLOW.md`: the explicit wallet adapter contract and testnet evidence requirements.
- `web/campaign-chain.mjs`: testnet-only campaign validation, multi-action deployment request, share token and contract call builders.
- `web/campaign-live.mjs`: authenticated finalized campaign state plus explicit commit, activation, expiry and withdrawal actions.
- `web/campaign-live-data.mjs`: immutable configuration authentication and chain-derived pledge certificate preparation.
- `web/near-rpc.mjs`: read-only testnet RPC transport, including finalized transaction and code-hash requests.
- `web/wallet-selector-host.mjs`: lazy Wallet Selector v10.1.4 testnet host integration for Meteor, Sender and Nightly; it never owns keys or retries unknown outcomes.
- `web/near-workflow.mjs`: explicit commit, Sputnik proposal, certificate, activation and withdrawal request builder.
- `web/near-adapter.mjs`: HOT Connect / Wallet Selector-compatible host bridge; it never owns keys or retries unknown outcomes.
- `docs/VERCEL_PREVIEW.md` and `vercel.json`: reproducible preview package and the verified sandbox-backed Vercel preview record.
- `docs/TESTNET_CHECKLIST.md`: exact remaining engineering gates.
- `.github/workflows/checks.yml`: CI recipe for Rust compile/test and Node model tests.
- `rust-toolchain.toml`, `scripts/verify-rust.sh`: pinned Rust toolchain and one-command WSL verification script.
- `docs/SECURITY_REVIEW.md`: honest audit blockers and changed contract policy.
- `docs/WITHDRAWAL_REVIEW.md`: callback non-execution analysis and rejected/possible redesigns.
- `docs/GITHUB_RELEASE.md` and `evidence/`: GitHub-ready CI/release instructions and preserved RC1 evidence/artifacts.
- `docs/COMPETITIVE_ADVANTAGE.md` and `evidence/competitive-benchmark.json`: reproducible prior-art comparison and honest capability results.
- `FINAL_ENGINEERING_REVIEW.md`: frozen final evidence review and release recommendation.
- `docs/VERIFICATION_2026-11-10.md`: latest isolated release-pass results, artifact hashes and CI limitation record.
- `docs/DESIGN_DIRECTION.md` and `docs/FRONTEND_REDESIGN_REPORT.md`: frontend design rationale, screenshot evidence, measured local performance and remaining UX issues.
- `docs/SUBMISSION_DESCRIPTION.md`, `docs/DEMO_STORYBOARD_2026-11-10.md`, `docs/SUBMISSION_CHECKLIST_2026-11-10.md` and `docs/X_DEMO_POST_DRAFT.md`: Social Money description, approval-required judge narrative and final release gates.

## Run immediately

```sh
npm ci
npm test
node scripts/certificate.js
node scripts/certificate.js --topup
npm run test:benchmark
npm run benchmark
npm run test:counterfactual
NPM_CONFIG_CACHE=/tmp/pact-npm-cache npm run preview
# Open http://127.0.0.1:4173 in a browser, then stop the preview server.
```

## Full local verification (requires Rust and Internet for crates/sandbox binary)

```sh
rustup toolchain install 1.93.0
rustup target add wasm32-unknown-unknown --toolchain 1.93.0
cargo +1.93.0 install cargo-near --version 0.22.0 --locked --no-default-features
npm ci
RUSTUP_TOOLCHAIN=1.93.0 bash scripts/verify-rust.sh
```

The script checks Rust formatting, the locked Wasm target, 16 unit tests and clippy, rebuilds the optimized Wasm and ABI with `wasm-opt`, runs the 38 core Node tests, 9 benchmark tests, 23 counterfactual tests, 8 workflow tests, 7 proof tests, 8 wallet-adapter tests, 5 pinned Wallet Selector/testnet compatibility tests and 9 chain/RPC/live-data/ABI tests, and runs five real sandbox scenarios plus the exact atomic deployment lifecycle. The sandbox runner uses `near-sandbox` 2.13.4 through the pinned `near-sandbox-modern` alias because the older binary bundled by `near-workspaces` 5.0.0 cannot prepare this SDK's Wasm.

The product checks are separate and reproducible with `npm run test:counterfactual` and `NPM_CONFIG_CACHE=/tmp/pact-npm-cache PLAYWRIGHT_BROWSERS_PATH=/tmp/pact-playwright-browsers npm run test:browser`. The browser campaign covers first-viewport comprehension, exact/blocked counterfactual states, evidence reconciliation, injected-adapter wallet safety, direct hosted routes, console/page errors, automated accessibility, graph keyboard interaction, evidence switching, narrow mobile layout and a local load-time budget. Fresh CI captures go to ignored `test-results/screenshots/`; the current redesign captures are in `docs/design-evidence/`.

The wallet request layer is covered with `npm run test:workflow` (8 tests), the campaign deployment/share/RPC/live-data/ABI boundary with `npm run test:chain` (9 tests), and the optional host bridge with `npm run test:wallet-adapter` (8 tests), without signing or submitting a transaction.

The competitive benchmark is separate from the product and chain evidence. It compares explicit baseline semantics with the bounded exact reference solver, checks small cases against an independent exhaustive oracle, and labels aggregate/independent results as uncertified whenever they cannot prove PACT's one-use, condition and dependency rules. See `docs/COMPETITIVE_ADVANTAGE.md`.

## Build contract (individual commands)

```sh
cargo fmt --manifest-path contract/Cargo.toml -- --check
RUSTFLAGS="--cfg near" cargo check --locked --manifest-path contract/Cargo.toml --target wasm32-unknown-unknown
cargo test --locked --manifest-path contract/Cargo.toml
RUSTFLAGS="--cfg near" cargo clippy --locked --manifest-path contract/Cargo.toml --all-targets -- -D warnings
cargo near abi --locked --manifest-path contract/Cargo.toml --out-dir contract/target/near-build
cargo near build non-reproducible-wasm --locked --no-abi --manifest-path contract/Cargo.toml --out-dir contract/target/near-build
npm run test:sandbox
```

SDK pinned to [`near-sdk = 5.29.1`](https://github.com/near/near-sdk-rs/releases). The verified Wasm artifact is `contract/target/near-build/pact_atlas_poc.wasm`; the sandbox evidence records its SHA-256 and receipt hashes.

## Contract methods / assumptions

- `new(projects, deadline_ms, activate_after_ms, min_funded_projects, required_for_activation, activation_authorities)` initializes ONE campaign. Initialization must be signed by the contract account itself or its exact direct namespace parent; this supports the tested atomic `CreateAccount → DeployContract → new` receipt without allowing an unrelated initializer. The project requirements/dependencies, mandatory funded projects, activation authorities and minimum activation count are immutable. `activate_after_ms` is the fundraising cutoff **and** earliest activation time; it must be in the future at initialization.
- `sponsor_storage()` accepts a **non-refundable storage subsidy**; in this prototype the developer must provide this funding in addition to customer deposits. Do not use customer pledge funds to sponsor storage. Sponsorship is not an investor contribution.
- `commit(allowed, requires)` is available **only before the funding cutoff**. It locks 100% of the attached native NEAR as the participant's refundable commitment. Allocation is all-or-nothing to one permitted project in this version. Each pledge receives an integer index.
- `activate(allocations)` accepts an off-chain solver certificate **after fundraising has closed** from one of the immutable `activation_authorities`. It independently checks each pledge used at most once, funding totals exactly matching project requirements, all dependency rules, contributor conditions, mandatory project IDs, campaign minimum count, and activation timing. Its accepted plan is retained by `activation_certificate()` for review. It credits funded beneficiaries and refunds unused contributors using pull-based balances.
- `campaign_config()` exposes immutable project and authority facts for share-link authentication; `pledge_records()` exposes canonical pledge indexes, owners, amounts, permissions and conditions for independent certificate construction. Both are read-only and do not weaken accounting or authorization.
- `expire()` converts all locked contributions to refunds if the campaign was not activated before deadline.
- `withdraw()` and its private callback distinguish successful transfers from failures; failures restore recoverable credit when the callback executes. **If the callback itself fails, recovery is not solved.** Use `claimable(account_id)`, `pending_withdrawal(account_id)`, `accounting()`, `status()`, and `activation_certificate()` to inspect positions. `accounting()` exposes the conservation identity and storage-reserve check for independent reconciliation.

**Limitations:** This is native NEAR only. One campaign per deployment. Beneficiaries receive funds upon valid activation, without a later real-world-delivery checkpoint. Sputnik DAO execution is verified in local sandbox only; it is not a testnet or production governance integration. No contract migration, MPC, NFT, confidential processing or NEAR Intents. Solver is bounded and potentially exponential. The Rust code has had no independent qualified audit. Sandbox coverage does not prove production safety.

Read `docs/SECURITY_REVIEW.md` for the risks and policy changes.

**Current security warning:** No mainnet usage, production funds, or user deposits. The bounded CLI-signed faucet-funded testnet campaigns are verified, but genuine browser-wallet signing (Meteor, Sender and Nightly attempts are recorded as unverified), public Sputnik governance, native-transfer failure injection, missing-callback recovery, and an independent qualified audit remain open gates. Never add a timeout retry or blind unlock for a pending withdrawal.

## Verified local criteria

1. Pinned Rust/near-sdk compilation, locked Wasm check, clippy and optimized Wasm build pass.
2. 16 Rust unit tests and 29 reference-model tests pass.
3. Real sandbox transactions use separate accounts and attached native NEAR.
4. Invalid allocations revert without changing phase, liabilities or storage stake.
5. A/B/C activation settles 4 + 3 + 3 NEAR and refunds the unused 2 NEAR pledge.
6. A sixth 1 NEAR pledge enables A+B+C+D; all four beneficiaries settle exactly.
7. Expiry refunds all five contributors and leaves liabilities at zero.
8. Two-council Sputnik DAO proposals are created, rejected when unauthorized/unapproved, approved, executed to fund PACT, and used to withdraw an expired DAO-owned refund in fresh sandbox state.
9. `accounting()` proves `locked_pledges + credits + pending == liabilities` and checks the developer-sponsored storage reserve at each exercised state.
10. The RC1 sandbox campaign exercises the configured 8-project/32-pledge capacity, exact boundary predicates in Rust VM tests, all settlement credits and repeated withdrawal rejection.
11. Three bounded faucet-funded testnet lifecycles are verified: two settlement/refund paths in `evidence/pact-atlas-testnet-evidence-2026-11-10.json` and one dependency-aware two-project coalition in `evidence/pact-atlas-testnet-coalition-evidence-2026-11-10.json`; Sputnik governance and genuine browser-wallet signing remain separate gates. The Sender/Nightly attempts and their exact blockers are recorded in `evidence/pact-atlas-alternate-wallet-attempt-2026-11-11.json`; the native-transfer failure-injection boundary is recorded in `evidence/pact-atlas-withdrawal-failure-attempt-2026-11-12.json`.

No testnet credentials or signing keys are included in this archive. Public transaction hashes are included only in the reproducible evidence manifest.

### Known security/UX risks that still block shipping
- A transfer callback that fails to execute (not just a transfer that returns `Failed`) could leave a `pending` withdrawal. No safely authenticated recovery path is implemented yet.
- Activation is restricted to immutable campaign-configured authorities, but the verifier still proves eligibility and conservation rather than global optimality or economic fairness. A future DAO-controlled coalition policy should select the approved certificate explicitly.
- The immutable campaign uses one-shot activation; later contributions or changing preferences require a new campaign.
- The storage sponsorship is deliberately nonrefundable for this limited proof of concept and requires independent security review.
