# PACT Atlas Release Candidate 1 report

Date: 2026-11-10
Submission target: NEAR Hackathon, Social Money track, 2026-11-14 23:59 UTC

## Executive result

PACT Atlas RC1 is locally reproducible and safe to demonstrate as a sandbox-backed product preview. The contract, bounded counterfactual engine, real Sputnik sandbox integration, maximum configured state campaign, evidence viewer, responsive UI and explicit wallet-request layer are working. No testnet or mainnet deployment was attempted, no production key was used, and no real funds were spent.

RC1 is not a production financial release. The missing-withdrawal-callback recovery problem remains unresolved, so valuable funds must not be used. The contract has not been independently audited by a qualified external auditor and must not be described as externally audited.

## Verified local matrix

| Surface | Result | Evidence |
| --- | ---: | --- |
| Rust contract unit tests | **15 passed** | exact activation/deadline boundaries, 8-project/32-pledge capacity, conservation, callback amount validation, canonical read-only views, callbacks and repeated transactions |
| JavaScript reference tests | **26 passed** | independent financial and adversarial model |
| Exact counterfactual tests | **23 passed** | exact certificate, blocked reasons, minimum top-up and model-only condition changes |
| Competitive benchmark tests | **9 passed** | independent and threshold baselines, bounded exact top-up and independent exhaustive oracle |
| Baseline NEAR sandbox campaigns | **5 passed** | `pact-atlas-sandbox-evidence.json` |
| RC1 maximum-capacity sandbox | **1 passed** | `pact-atlas-rc1-sandbox-evidence.json` |
| Browser checks | **51 passed** | Playwright Chromium, responsive layout, direct routes, console/page errors, wallet boundary, evidence reconciliation |
| Wallet request-builder tests | **8 passed** | explicit commit, Sputnik proposal, certificate, activation, withdrawal and configuration guards |
| Wallet adapter tests | **8 passed** | HOT/legacy action shape, Wallet Selector v10 action creator, missing hash fail-closed, JSON-RPC view reconciliation |
| Chain/RPC/live-data/ABI interface tests | **9 passed** | corrected tx finality transport, immutable config, canonical pledge records and ABI surface |
| Testnet-proof verifier tests | **7 passed** | finality, pinned code hash, failure and foreign-account rejection |
| Accessibility | **passed** | no critical/serious axe violations |
| Local performance | **passed budget only** | DOM-content-loaded `<1500 ms`, load `<2500 ms`; no Lighthouse score claimed |

## Financial correctness

The contract preserves the following invariant at every exercised state:

`locked_pledges + credits + pending == liabilities`

and rejects transitions unless the account balance covers `liabilities + measured storage reserve + configured buffer`.

The RC1 sandbox campaign is genuine NEAR sandbox execution on version 2.13.4:

- Contract: `dev-1337-48000.test.near`
- Wasm code hash: `Bh4oaer6T9uUwbQBEfN1RFJ4S3jteMBnH6pWH7qC5nKx`
- Deploy: `DkDZ9gCBHEoV1b8RMgTFh1dvGoCRhReMatymixLPU6br`
- Initialize: `B75f9ykdBdiX1JeToSmf3bWfZisE63z5wQkASjfLKt3a`
- Storage sponsorship: `9jrLAcAqmEoTnmEX2heDKSbgf2eoufn5rFPRL1VPuTA5`
- 32 commit receipts and 8-project activation
- Activation: `47yLgX3zsAaS9fmG993GyB65YzGn5LLRBz2AMm5YUaEA`
- 32 successful withdrawal receipts; repeated withdrawal rejection: `8zfRiYPR1U7xJZdwX54Renp2wtEfr8aCpZb7TaLgooQt`
- Final liabilities: `0`
- Final contract balance: `31001593893295771400000000` yoctoNEAR
- Open-state measured storage reserve: `2296440000000000000000000` yoctoNEAR

The exact timestamp predicates are verified in Rust VM tests: contributions are frozen at `activate_after_ms`, activation is allowed at that exact boundary, expiry is allowed at `deadline_ms`, and activation before the deadline remains required. The sandbox runner crosses boundaries but does not inject exact timestamps.

Native transfer failure injection could not be safely reproduced through a real sandbox predecessor: a recipient that cannot receive cannot also remain the authenticated signer required to initiate `withdraw()` in this harness. The `PromiseResult::Failed` branch is covered in the Rust VM and reference tests. A callback that never executes remains unresolved.

## Security disposition

Mitigated in this build:

- deploy/init front-running: initialization requires the contract account as predecessor;
- unauthorized activation: immutable activation authority allowlist;
- double-use certificates, disallowed targets, partial/overfunded projects and broken dependencies;
- duplicate callback liability reduction;
- repeated activation, expiry and withdrawal attempts;
- accounting and storage-reserve conservation at exercised states.

Unresolved or outside the proof:

- callback non-execution after a transfer may strand a pending liability; no timeout retry or blind unlock was added;
- genuine native-transfer failure injection with a preserved authenticated predecessor;
- testnet runtime, wallet signatures, explorer finality and production nearcore behavior;
- qualified independent audit;
- global economic fairness or optimality beyond the bounded exact certificates;
- unbounded state growth beyond the configured 8-project/32-pledge limits.

## Governance and wallet integration

The five baseline sandbox campaigns include the real Sputnik v2 Wasm: unauthorized voting is rejected, two council approvals are required, approved proposals execute PACT funding, an unapproved proposal remains inert, and a second approved proposal funds a refund withdrawal.

The browser now exposes an explicit request layer in `web/near-workflow.mjs` for commit, Sputnik proposal creation, local exact certificate generation, activation and withdrawal. `web/near-adapter.mjs` provides the optional host bridge for a HOT Connect or Wallet Selector-compatible wallet and Wallet Selector v10 action creators. The UI never signs automatically, never treats a model-only condition as DAO-approved, and requires a returned transaction hash before showing an action as submitted. No live wallet signature was available in this environment.

Current upstream compatibility was reviewed: [HOT/NEAR Connect](https://github.com/azbang/near-connect) describes a secure isolated connector with Wallet Selector action compatibility, while [NEAR Wallet Selector](https://github.com/near/wallet-selector) remains supported during the transition and recommends exploring HOT Connect. Wallet Selector v10 requires the newer `@near-js` action format or `actionCreators`; the PACT host boundary deliberately avoids assuming either signing implementation.

## UI and deployment status

The existing Coalition Atlas design was preserved and refined rather than redesigned: editorial ink/lime/coral visual system, orbital dependency map, exact/blocked counterfactual result, commitment inspector, five-step workflow rail, read-only evidence separation, desktop/mobile screenshots and keyboard/accessibility behavior.

The static Vercel package is deployed as a sandbox-backed preview at https://pact-atlas-rc1-preview-lbtitxcri-iniwura-akurus-projects.vercel.app/ (`dpl_956XYXB54TgehyFobxguQVqFyU1a`, project `prj_6q7qCVVeB6WTC57jBJCTdPaVgxpP`). Vercel fetch returned HTTP 200 for the root, module, stylesheet, evidence and documentation routes. It contains no testnet credentials and is not live-chain evidence. The recorded deployment predates the final local callback/Wasm/evidence refresh and must be redeployed from the current checkout before being called the final hosted artifact. The Vercel CLI is not installed in this environment, so no unverified redeploy was attempted. An earlier API request accidentally created `dpl_6rpBLndJMtUAWFpQjGAvuXgSab3A` with target `production`; it was not promoted or used as evidence, and the project was paused so that deployment returns `503 DEPLOYMENT_PAUSED`.

## Reproduction

From the checkpoint directory:

```sh
npm ci
npm test
npm run test:counterfactual
npm run test:workflow
npm run test:proof
npm run test:wallet-adapter
npm run test:chain
RUSTUP_TOOLCHAIN=1.93.0 bash scripts/verify-rust.sh
PACT_SCENARIOS=max-capacity PACT_EVIDENCE_PATH=evidence/pact-atlas-rc1-sandbox-evidence.json npm run test:sandbox
NPM_CONFIG_CACHE=/tmp/pact-npm-cache PLAYWRIGHT_BROWSERS_PATH=/tmp/pact-playwright-browsers npm run test:browser
```

The full verifier preserves the baseline five-campaign evidence. The current RC3 Wasm SHA-256 is `9ed866dd401b57f26a3aa35dbe722230a0d3893bb31ed0fbbb1e320db7dd2e6f`; ABI SHA-256 is `8399a2cc59c37680ed2ae418f2f04cc8121dda2eca0f8777a9933d1de46e2f5b`. The exact Wasm/ABI comparison was replayed under Rust 1.93.0 and cargo-near 0.22.0 using the canonical `CARGO_HOME=/tmp/pact-atlas-cargo-final` path; the canonical path is required because the optimized Wasm retains Cargo source paths. RC3 also verifies `campaign_config()` and `pledge_records()` through genuine local sandbox views.

## Before hackathon submission

1. Obtain explicit authorization and isolated faucet-funded `*.testnet` accounts.
2. Run the same acceptance flow on testnet and record contract/DAO IDs, transaction hashes, finality, state transitions and balance reconciliation.
3. Perform a qualified independent security review, with special attention to callback non-execution and withdrawal reconciliation.
4. Authorize any public repository, Vercel production promotion or hackathon submission separately; the current Vercel artifact is a sandbox-backed preview only.
5. Demonstrate the minimal next product milestone: a real multi-DAO coalition where each DAO approves a commitment and the activation certificate, and the UI explains counterfactual funding dependencies.
