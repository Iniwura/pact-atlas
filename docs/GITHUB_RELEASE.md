# GitHub release preparation

The checkpoint is prepared for a repository owned by `Iniwura`, but no GitHub repository was created or modified in this task. The supplied ZIP did not contain its original `.git` directory; this workspace does preserve the local engineering checkpoint history through `ddd45fc`, but it has no configured remote. The local release candidate is therefore a history-preserving local branch with no upstream publication.

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

The candidate has been prepared as a clean local Git repository with no remote configured. Do not add a remote, create a public repository, push, or submit the hackathon entry until separately authorized. When authorized, use the approved repository name under `Iniwura`, review the initial snapshot, and configure branch protection so the required Actions workflow passes before merge.

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

The local RC1 reports and exact artifact hashes are in `evidence/`. No command in this release preparation performs a testnet deployment or spends real funds.
