# PACT Atlas — executable technical checkpoint

**Status (2026-11-02): RC1 verification green.** The Rust contract compiles with the pinned SDK, 13/13 Rust unit tests pass, clippy is clean with warnings denied, the nearcore-compatible Wasm and ABI builds pass, 5 fresh baseline real-NEAR sandbox campaigns pass plus a separate maximum-capacity RC1 campaign, 6 exact counterfactual tests pass, 5 request-builder tests and 4 wallet-adapter tests pass, and 10 Chromium product checks pass. A static Vercel preview is live and route-verified; it is sandbox-backed only. Testnet is not verified.

This archive is a **feasibility experiment**, not a commercial product or an audited smart contract.

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
- `tests/pact.test.js`: 26 conservation, coalition, timing and adversarial tests for the reference model.
- `scripts/certificate.js`: emits machine-readable reproducible offline allocation evidence, deliberately labeled OFFLINE-NOT-ONCHAIN.
- `scripts/sandbox-verification.js`: launches a fresh NEAR sandbox per scenario, deploys the compiled Wasm, attaches real native NEAR deposits, and writes receipt/balance evidence.
- `vendor/sputnik/sputnikdao2_original.wasm`: pinned official Sputnik v2 DAO Wasm used only by the local governance sandbox.
- `HACKATHON.md`: judge-facing reproducibility, evidence map, blockers and next milestone.
- `web/`: the Coalition Atlas product preview, exact counterfactual engine, evidence viewer and wallet-safe workflow boundary.
- `docs/ARCHITECTURE.md`: data, contract, governance and evidence-boundary diagrams.
- `web/NEAR_WORKFLOW.md`: the explicit wallet adapter contract and testnet evidence requirements.
- `web/near-workflow.mjs`: explicit commit, Sputnik proposal, certificate, activation and withdrawal request builder.
- `web/near-adapter.mjs`: optional HOT Connect / Wallet Selector-compatible host bridge; it never owns keys or retries unknown outcomes.
- `docs/VERCEL_PREVIEW.md` and `vercel.json`: reproducible preview package and the verified sandbox-backed Vercel preview record.
- `docs/TESTNET_CHECKLIST.md`: exact remaining engineering gates.
- `.github/workflows/checks.yml`: CI recipe for Rust compile/test and Node model tests.
- `rust-toolchain.toml`, `scripts/verify-rust.sh`: pinned Rust toolchain and one-command WSL verification script.
- `docs/SECURITY_REVIEW.md`: honest audit blockers and changed contract policy.
- `docs/WITHDRAWAL_REVIEW.md`: callback non-execution analysis and rejected/possible redesigns.
- `docs/GITHUB_RELEASE.md` and `evidence/`: GitHub-ready CI/release instructions and preserved RC1 evidence/artifacts.

## Run immediately

```sh
npm ci
npm test
node scripts/certificate.js
node scripts/certificate.js --topup
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

The script checks Rust formatting, the locked Wasm target, unit tests and clippy, builds optimized Wasm with `wasm-opt`, runs the 26-case reference suite, and runs five real sandbox scenarios. The sandbox runner uses `near-sandbox` 2.13.4 through the pinned `near-sandbox-modern` alias because the older binary bundled by `near-workspaces` 5.0.0 cannot prepare this SDK's Wasm.

The product checks are separate and reproducible with `npm run test:counterfactual` and `NPM_CONFIG_CACHE=/tmp/pact-npm-cache PLAYWRIGHT_BROWSERS_PATH=/tmp/pact-playwright-browsers npm run test:browser`. The browser campaign covers first-viewport comprehension, exact/blocked counterfactual states, evidence reconciliation, injected-adapter wallet safety, direct hosted routes, console/page errors, automated accessibility, narrow mobile layout and a local load-time budget. Fresh CI captures go to ignored `test-results/screenshots/`; the preserved RC1 captures are in `evidence/screenshots/`.

The wallet request layer is covered with `npm run test:workflow` (5 tests), and the optional host bridge with `npm run test:wallet-adapter` (4 tests), without signing or submitting a transaction.

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

- `new(projects, deadline_ms, activate_after_ms, min_funded_projects, required_for_activation, activation_authorities)` initializes ONE campaign. Initialization must be signed by the contract account itself, preventing a separate deploy/init front-run. The project requirements/dependencies, mandatory funded projects, activation authorities and minimum activation count are immutable. `activate_after_ms` is the fundraising cutoff **and** earliest activation time; it must be in the future at initialization.
- `sponsor_storage()` accepts a **non-refundable storage subsidy**; in this prototype the developer must provide this funding in addition to customer deposits. Do not use customer pledge funds to sponsor storage. Sponsorship is not an investor contribution.
- `commit(allowed, requires)` is available **only before the funding cutoff**. It locks 100% of the attached native NEAR as the participant's refundable commitment. Allocation is all-or-nothing to one permitted project in this version. Each pledge receives an integer index.
- `activate(allocations)` accepts an off-chain solver certificate **after fundraising has closed** from one of the immutable `activation_authorities`. It independently checks each pledge used at most once, funding totals exactly matching project requirements, all dependency rules, contributor conditions, mandatory project IDs, campaign minimum count, and activation timing. Its accepted plan is retained by `activation_certificate()` for review. It credits funded beneficiaries and refunds unused contributors using pull-based balances.
- `expire()` converts all locked contributions to refunds if the campaign was not activated before deadline.
- `withdraw()` and its private callback distinguish successful transfers from failures; failures restore recoverable credit when the callback executes. **If the callback itself fails, recovery is not solved.** Use `claimable(account_id)`, `pending_withdrawal(account_id)`, `accounting()`, `status()`, and `activation_certificate()` to inspect positions. `accounting()` exposes the conservation identity and storage-reserve check for independent reconciliation.

**Limitations:** This is native NEAR only. One campaign per deployment. Beneficiaries receive funds upon valid activation, without a later real-world-delivery checkpoint. Sputnik DAO execution is verified in local sandbox only; it is not a testnet or production governance integration. No contract migration, MPC, NFT, confidential processing or NEAR Intents. Solver is bounded and potentially exponential. The Rust code has had no independent qualified audit. Sandbox coverage does not prove production safety.

Read `docs/SECURITY_REVIEW.md` for the risks and policy changes.

**Current security warning:** No mainnet usage, production funds, or user deposits. Testnet execution, an independent qualified audit, native-transfer failure injection, and missing-callback recovery remain open gates. Never add a timeout retry or blind unlock for a pending withdrawal.

## Verified local criteria

1. Pinned Rust/near-sdk compilation, locked Wasm check, clippy and optimized Wasm build pass.
2. Thirteen Rust unit tests and 26 reference-model tests pass.
3. Real sandbox transactions use separate accounts and attached native NEAR.
4. Invalid allocations revert without changing phase, liabilities or storage stake.
5. A/B/C activation settles 4 + 3 + 3 NEAR and refunds the unused 2 NEAR pledge.
6. A sixth 1 NEAR pledge enables A+B+C+D; all four beneficiaries settle exactly.
7. Expiry refunds all five contributors and leaves liabilities at zero.
8. Two-council Sputnik DAO proposals are created, rejected when unauthorized/unapproved, approved, executed to fund PACT, and used to withdraw an expired DAO-owned refund in fresh sandbox state.
9. `accounting()` proves `locked_pledges + credits + pending == liabilities` and checks the developer-sponsored storage reserve at each exercised state.
10. The RC1 sandbox campaign exercises the configured 8-project/32-pledge capacity, exact boundary predicates in Rust VM tests, all settlement credits and repeated withdrawal rejection.
11. Testnet deployment is **NOT VERIFIED** because no authorized credentials were present.

No testnet credentials, signing keys or NEAR transactions are included in this archive.

### Known security/UX risks that still block shipping
- A transfer callback that fails to execute (not just a transfer that returns `Failed`) could leave a `pending` withdrawal. No safely authenticated recovery path is implemented yet.
- Activation is restricted to immutable campaign-configured authorities, but the verifier still proves eligibility and conservation rather than global optimality or economic fairness. A future DAO-controlled coalition policy should select the approved certificate explicitly.
- The immutable campaign uses one-shot activation; later contributions or changing preferences require a new campaign.
- The storage sponsorship is deliberately nonrefundable for this limited proof of concept and requires independent security review.
