# PACT Atlas — verification update (2026-11-10)

This record covers the isolated self-service release pass descended from
`b1ec4aa55f6f51c1d1ba2e327ac63eb8b8ed20c9`. The Rust contract and preserved
Wasm/ABI are unchanged. The product now adds a testnet-only campaign request
layer, a lazy Wallet Selector host, a public campaign route, finalized view
reconciliation, and browser coverage for those boundaries. No wallet was
connected and no public testnet transaction was signed.

## GitHub CI diagnosis

The latest pull-request run `42705729543` and push run `42705722733` reached
the browser, Node, and Rust jobs successfully. The NEAR sandbox job was not
started. Its check-run annotation was:

> The job was not started because recent account payments have failed or your
> spending limit needs to be increased.

There were no sandbox steps or logs to diagnose. This is an external GitHub
Actions billing/spending-limit blocker, not a failed accounting assertion. The
sandbox job remains in the workflow so it cannot silently disappear from the
release gate.

After this release-pass commit was pushed, run `42725551849` (`#285`) also
produced no executable job steps: Rust, Node and Chromium were marked failed,
the sandbox was skipped, and GitHub exposed no job-log blobs. Together with the
explicit billing annotation above, this is classified as a GitHub Actions
account/infrastructure blocker and **not** as evidence that the code gates
failed. The run is not counted as a passing CI result.

## Local verification

The following gates were run in the isolated checkout:

| Gate | Result | Evidence boundary |
| --- | --- | --- |
| Rust unit tests | 14/14 passed | Local Rust VM |
| Rust format, locked Wasm check, clippy | Passed | Local toolchain |
| JavaScript reference suite | 35/35 passed | Local model/tests |
| Competitive benchmark | 9/9 passed | Bounded reference benchmark |
| Counterfactual engine | 23/23 passed | Browser-independent solver tests |
| Wallet workflow | 8/8 passed | Request construction; no signing |
| Wallet adapter | 8/8 passed | Injected adapter safety; no signing |
| Campaign chain builders | 4/4 passed | Testnet-only deployment/share/call request construction |
| Testnet proof verifier | 7/7 passed | Read-only verifier tests |
| Playwright browser suite | 49/49 passed | Local Chromium at 320, 360, 390, 768, 1024 and 1440px; public campaign route included |
| NEAR sandbox: cycle/all-four/expiry/concurrent | Passed | Fresh local sandbox receipts and accounting snapshots |
| NEAR sandbox: maximum capacity | Passed | 8 projects, 32 deposits, 32 credits, 32 withdrawals |
| NEAR sandbox: Sputnik governance | Passed | Fresh DAO proposal, quorum, execution, funding and refund |

The sandbox campaigns exercised expected negative paths as well as successful
transfers. Every recorded accounting snapshot was solvent; the exercised
campaigns ended with zero liabilities. These are local sandbox results, not
public testnet evidence.

## Artifact record

The preserved release artifacts remain unchanged:

| Artifact | SHA-256 |
| --- | --- |
| `evidence/pact_atlas_poc.wasm` | `7329d40af43d7e4d6cd3ff942cbe31ba9c54124e667a9af0233e63fa9020d103` |
| `evidence/pact_atlas_poc_abi.json` | `4f9d6ea16bbc8986e304f5b894403501c262b409379efa3eef2f1dd248201075` |
| Sputnik sandbox Wasm | `6e3f1814d40769d8f57b9a7af689d22aaab96d3232cec4d861311829c1d2318f` |
| PACT sandbox Wasm code hash | `8kYswvde6AC41E17ae1LtuepvC4FcTrEzRTSpr1TBgCS` |
| Offline certificate sample | `7a7124674a7e57ee3772b99775206833c9673446395fa0d58e5c2449dcc6d6c9` |

The final local `RUSTUP_TOOLCHAIN=1.93.0 bash scripts/verify-rust.sh` pass
regenerated ABI and optimized Wasm with the pinned `cargo-near`/`wasm-opt`
workflow and matched both preserved artifact hashes exactly. The earlier
`abdfbb7c…` mismatch came from a stale pre-verification build and is not part
of this release evidence.

## Security and release boundary

- No unsafe timeout retry, blind unlock, or unknown-outcome payout recovery was
  added.
- `withdraw` still depends on the private transfer callback to restore credit
  after a failed native transfer. If that callback never executes, the pending
  withdrawal can remain unresolved. This remains a production blocker, not a
  reason to weaken accounting.
- Genuine native-transfer failure injection and callback non-execution were not
  reproduced by the available sandbox harness. Ordinary native transfers,
  negative authorization paths, duplicate withdrawals, expiry refunds, and
  accounting conservation were exercised.
- The new custom-campaign deployment flow is request- and browser-tested with
  deterministic wallet/RPC doubles, including explicit `CreateAccount`,
  `Transfer`, `DeployContract`, `new` and `sponsor_storage` actions. This is
  not testnet evidence: no account, contract ID, signature or explorer receipt
  is claimed.
- No authorized testnet signing credentials were available. There is no testnet
  deployment, transaction hash, or public-chain lifecycle evidence to report.
- The repository is not externally audited. Development-tool dependency audit
  findings remain separate from runtime production dependencies; no runtime
  dependencies are declared.

## Recommendation

The product workflow is a credible judge demonstration with reproducible
offline, local-VM, sandbox, artifact, and deterministic wallet-boundary
evidence. Keep PR #11 draft and do not describe the release as production-safe
or testnet-verified. Before public submission, clear the GitHub Actions billing
gate and, if authorized, run the isolated testnet campaign. Callback
non-execution remains a production blocker; no unsafe fix was attempted.
