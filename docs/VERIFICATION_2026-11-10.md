# PACT Atlas — verification update (2026-11-10)

This record covers the isolated release pass descended from
`b1ec4aa55f6f51c1d1ba2e327ac63eb8b8ed20c9`. It contains one narrow mobile
overflow fix and documentation only; the Rust contract, verified Wasm, ABI,
solver semantics, wallet request layer, and sandbox runner were not changed.

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
| Wallet adapter | 6/6 passed | Injected adapter safety; no signing |
| Testnet proof verifier | 7/7 passed | Read-only verifier tests |
| Playwright browser suite | 45/45 passed | Local Chromium at 320, 360, 390, 768, 1024 and 1440px |
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

The ABI generated locally matched the preserved ABI. The local `cargo near`
optimized Wasm output did **not** byte-match the preserved Wasm artifact in
this environment (`abdfbb7cebab9b158bb5d9ea1fb825dedaef05652ad0ae158ebaeb78545408ad`
was produced locally). The exact base commit's GitHub Rust/Wasm job had passed
its artifact comparison, so the preserved artifact was not replaced. This
local toolchain/Binaryen reproducibility discrepancy is an evidence limitation
that must be resolved or pinned before claiming a fresh local byte-for-byte
build.

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
- No authorized testnet signing credentials were available. There is no testnet
  deployment, transaction hash, or public-chain lifecycle evidence to report.
- The repository is not externally audited. Development-tool dependency audit
  findings remain separate from runtime production dependencies; no runtime
  dependencies are declared.

## Recommendation

The product workflow is a credible draft judge demonstration with reproducible
offline, local-VM, and sandbox evidence. Keep PR #11 draft and do not describe
the release as production-safe or testnet-verified. Before calling it a final
submission candidate, clear the GitHub Actions billing gate and reconcile the
local optimized-Wasm reproducibility difference; testnet evidence and a
qualified independent audit remain optional but important credibility gates,
while callback non-execution remains a production blocker.
