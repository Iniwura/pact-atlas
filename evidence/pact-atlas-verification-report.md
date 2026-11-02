# PACT Atlas verification report

Date: 2026-11-02

## Result

Local RC1 verification is green. No NEAR testnet or mainnet deployment was attempted, and no real funds were spent.

- Rust toolchain: `1.93.0`
- near-sdk: `5.29.1`
- cargo-near: `0.22.0`
- NEAR sandbox: `2.13.4`
- Rust unit tests: `13 passed`
- JavaScript reference tests: `26 passed`
- Clippy: passed with `-D warnings`
- ABI generation: passed
- Real sandbox scenarios: `5 baseline passed`; separate RC1 maximum-capacity campaign passed
- Exact Coalition Atlas counterfactual tests: `6 passed`
- Wallet request-builder tests: `5 passed`
- Wallet adapter tests: `4 passed`
- Playwright browser checks: `10 passed`
- Accessibility: no critical or serious axe violations
- Browser performance: local DOM-content-loaded and load budgets passed
- Canonical Wasm/ABI replay: exact byte comparison passed under Rust `1.93.0` and cargo-near `0.22.0`

## Verified artifacts

- PACT Wasm: [pact_atlas_poc.wasm](./pact_atlas_poc.wasm), 204,760 bytes
- PACT Wasm SHA-256: `8ea872ef10f44241840d70ad2ac0bbdd25289d0c770098f158900975e5c8b35c`
- NEAR code hash (base58): `AbssULo2nfejWq1WjWFExt6xsTHSd9grj9XcxJEnuifm`
- ABI: [pact_atlas_poc_abi.json](./pact_atlas_poc_abi.json)
- ABI JSON SHA-256: `4f9d6ea16bbc8986e304f5b894403501c262b409379efa3eef2f1dd248201075`
- Official Sputnik v2 Wasm SHA-256: `6e3f1814d40769d8f57b9a7af689d22aaab96d3232cec4d861311829c1d2318f`

## Sandbox accounting results

Each scenario used a fresh local chain, a separately deployed contract account, independent signer accounts, attached native NEAR deposits, and actual receipts. Every recorded accounting snapshot satisfied `locked_pledges + credits + pending == liabilities` and reported `solvent: true`.

1. A+B+C dependency-cycle campaign: 12 NEAR committed; premature, duplicate, underfunded, disallowed-target and dependency-broken plans reverted; A+B+C settled 4 + 3 + 3 NEAR and the unused 2 NEAR pledge; final liabilities `0`.
2. Sixth-donor top-up: 13 NEAR committed; A+B+C+D settled 4 + 3 + 3 + 3 NEAR; final liabilities `0`.
3. Expiry: five contributors reclaimed 3 + 1 + 3 + 3 + 2 NEAR; final liabilities `0`.
4. Concurrent/adversarial state transitions: concurrent deposits were conserved; two configured authorities raced activation and exactly one won; an unauthorized activation, repeated withdrawal and external callback call were rejected; final liabilities `0`.
5. Sputnik DAO: the official DAO Wasm was deployed in sandbox; a non-council vote was rejected; both council approvals were required; approved proposals funded PACT, an unapproved proposal remained inert, and a second approved DAO proposal withdrew an expired DAO-owned refund; both PACT campaigns ended with liabilities `0`.

6. RC1 maximum capacity: [pact-atlas-rc1-sandbox-evidence.json](./pact-atlas-rc1-sandbox-evidence.json) records contract `dev-10452-66528.test.near`, 32 attached-deposit commits, all 8 configured projects, activation receipt `5PtThUWGWTQiufSkL9KNZd7mbgzFVsL2XKptsf99PR9j`, 32 successful withdrawals, repeated-withdrawal rejection `BSUVy3KwwnMwaUEsmmBtfsx99XaYYHFuLABpybVF41Kr`, measured storage reserve and final liabilities `0`.

The complete evidence file contains contract addresses, receipt hashes, state transitions, accounting snapshots and balance reconciliation: [pact-atlas-sandbox-evidence.json](./pact-atlas-sandbox-evidence.json).

The product-phase evidence snapshot was synchronized to the fresh baseline run at `2026-11-02T07:18:18.229Z`; its Wasm SHA-256 is the same `8ea872ef10f44241840d70ad2ac0bbdd25289d0c770098f158900975e5c8b35c`. The browser preview loads that snapshot from `web/data/evidence.json` and writes [pact-atlas-desktop-preview.png](./pact-atlas-desktop-preview.png) and [pact-atlas-mobile-preview.png](./pact-atlas-mobile-preview.png). The 10-check browser campaign also verifies direct module/evidence routes, the wallet boundary, no console/page errors, accessibility and the measured local performance budget.

## Reproduction

From the extracted checkpoint directory:

```sh
rustup toolchain install 1.93.0
rustup target add wasm32-unknown-unknown --toolchain 1.93.0
cargo +1.93.0 install cargo-near --version 0.22.0 --locked --no-default-features
npm ci
bash scripts/verify-rust.sh
```

`verify-rust.sh` runs formatting, locked Wasm checking, 13 Rust tests, clippy, ABI generation, optimized Wasm build, 26 reference tests, and `npm run test:sandbox` with all five baseline scenarios. The RC1 capacity campaign is reproducible with `PACT_SCENARIOS=max-capacity PACT_EVIDENCE_PATH=../../outputs/pact-atlas-rc1-sandbox-evidence.json npm run test:sandbox` from the checkpoint directory.

For the product surface, run `npm run test:counterfactual` and `NPM_CONFIG_CACHE=/tmp/pact-npm-cache PLAYWRIGHT_BROWSERS_PATH=/tmp/pact-playwright-browsers npm run test:browser`. The latter uses a real Chromium browser against the local preview and saves the two captures above.

## Security disposition

- Initialization front-running is mitigated by requiring the contract account to initialize itself; a Rust regression test covers the attacker predecessor.
- Activation is restricted to immutable authorities, and sandbox evidence covers unauthorized rejection and competing authorized requests.
- Liability conservation and storage-reserve checks are both machine-readable through `accounting()` and exercised after each major transition.
- Missing callback execution remains unresolved. No timeout retry, blind unlock or double-pay path was added. This is a hard blocker for valuable funds.
- Native transfer failure injection through a real predecessor was not safely reachable in this harness; the explicit `PromiseResult::Failed` callback branch is covered by Rust VM tests.
- Exact timestamp equality is covered at both inclusive/exclusive boundaries by Rust VM tests. near-workspaces sandbox fast-forward crosses but does not set exact block timestamps. Maximum configured capacity and storage growth are covered by the separate RC1 sandbox evidence.
- An independent adversarial engineering review was performed, but no independent qualified auditor has reviewed the contract. It must not be described as externally audited.

## Network status and repository status

Testnet is **NOT VERIFIED**: no safe testnet credentials or deployment authorization were present. Mainnet deployment, production keys and real-fund use remain prohibited without explicit approval.

The environment ran Node `20.19.5`; the pinned modern sandbox package declares Node `>=22.22.2`. The run passed here, but reproduction should use Node `22.22.2+` (or the project’s Node 26 baseline). `npm install` reported 15 dependency advisories; no automated audit-fix was applied.

The local release candidate has a reproducibility-only Git history with no remote, and no commit or pull request was pushed. A sandbox-backed Vercel preview was created and route-verified at `https://pact-atlas-rc1-preview-jefkdeu59-iniwura-akurus-projects.vercel.app/` (`dpl_HtLj32D896dfqgY7vUGztjSj36dS`). The first API request created a production-target artifact by mistake; it was not promoted, was quarantined by pausing the project, and is not release evidence. The valid preview contains no testnet credentials. The exact Wasm/ABI comparison is reproducible with the canonical `CARGO_HOME=/tmp/pact-atlas-cargo-final` path documented in `docs/GITHUB_RELEASE.md`.

## Product-phase implementation disposition

The Coalition Atlas UI, shared exact bounded solver, evidence viewer, responsive visual system, architecture documentation and reproducible browser checks are implemented. `web/near-workflow.mjs` now builds explicit commit, Sputnik proposal, certificate, activation and withdrawal requests; the UI submits them only through an explicitly injected host adapter and requires a returned transaction hash before confirmation. No testnet signature, public transaction hash or DAO web-wallet action is claimed by this product run.
