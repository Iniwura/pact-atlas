# GitHub release preparation

The private repository `https://github.com/Iniwura/pact-atlas` exists and the
history-preserving release branch `feat/self-serve-campaign-lab` was pushed
without force. Its current remote head is
`120ee881f9bca885153753ec141c89bc01b2e343`. PR #11 remains draft. A separate
`release/rc1-main-integration` branch is prepared from `origin/main` plus that
verified release branch; it is reviewable but has not been merged into `main`.
No
visibility change, merge, production promotion, mainnet call or real-fund
spend occurred.

## Included release surface

- `.github/workflows/checks.yml` runs pinned Node/model, Rust/ABI/Wasm, NEAR sandbox, and Chromium product checks.
- `evidence/` contains the preserved Wasm, ABI, sandbox receipts, reports, hashes and desktop/mobile captures.
- `vendor/sputnik/sputnikdao2_original.wasm` preserves the official Sputnik Wasm used by the sandbox governance campaign.
- `docs/SECURITY_REVIEW.md` and `docs/WITHDRAWAL_REVIEW.md` retain the unresolved callback and audit limitations.
- `docs/COMPETITIVE_ADVANTAGE.md` and `evidence/competitive-benchmark.json` retain the reproducible baseline comparison and prior-art boundary.
- `FINAL_ENGINEERING_REVIEW.md` is the final frozen evidence index and release recommendation; it does not authorize publication or deployment.

The workflow only has `contents: read`; it does not deploy, publish, use wallets, or access testnet credentials. The sandbox job creates fresh local chains and uploads new evidence as a CI artifact.

The Rust job uses Rust `1.93.0`, `cargo-near 0.22.0`, and the canonical `CARGO_HOME=/tmp/pact-atlas-cargo-final` path. The canonical path matters because the optimized Wasm retains debug source paths; using a different Cargo registry directory changes the binary bytes even when the contract source and compiler are unchanged. The CI job and `scripts/verify-rust.sh` both enforce the preserved Wasm and ABI byte-for-byte.

## Local repository state

The candidate is a clean local Git repository with an explicit `origin` remote
for the private repository above. The verified implementation remains on
`origin/feat/self-serve-campaign-lab`; the release-integration candidate is
`release/rc1-main-integration`, based on `origin/main` and merged without
rewriting history. Neither `main` nor PR #11 has been merged. Do not make the
repository public, change branch permissions or submit the hackathon entry
until separately authorized.

## Reproducibility gates

From the repository root:

```sh
npm ci
npm test
npm run test:benchmark
npm run benchmark
npm run test:counterfactual
npm run test:workflow
npm run test:wallet-adapter
npm run test:browser
RUSTUP_TOOLCHAIN=1.93.0 bash scripts/verify-rust.sh
```

The local RC1 reports and exact artifact hashes are in `evidence/`. The public
testnet manifests contain only faucet-funded disposable identities and
finalized receipt hashes; no mainnet transaction or real-fund spend is part of
this release preparation.
