# PACT Atlas — final hardening review

**Decision: HOLD publication and submission.** This is an engineering hardening record for the release branch, not an independent audit and not a production-readiness claim.

## Completed in this hardening pass

- Added a reference-model regression for delayed or missing withdrawal callbacks. The exact amount remains in `pending`, remains in `liabilities`, cannot be withdrawn again, and is never unlocked speculatively.
- Added exact-equality tests for the funding cutoff, activation start, deadline activation rejection and one-time expiry.
- Added a genuine NEAR sandbox recipient-deletion injection attempt. The credited recipient was deleted before withdrawal; the old signer could no longer submit `withdraw`, no native-transfer receipt or callback receipt was reached, and the contract remained solvent with the full 1 NEAR liability claimable.
- Added a read-only `/console#public-proof` section backed by `web/data/testnet-proof.json`. It exposes the finalized coalition certificate, contribution order, beneficiary withdrawals, expiry and refund receipts without presenting them as simulations or requiring a wallet.
- Preserved the approved homepage and the pinned contract artifact. No Rust contract source changed in this pass; the verified Wasm SHA-256 remains `5c06693028cc4b74527e6cf9fee5929a516c1644cc74f8136d5d53215eacfc15`, with NEAR code hash `7CEBKra569k7TYyxoWSoXwVak83uXCmkDqgHJNvkxUEp`.

## Severity findings

| ID | Severity | Finding | Classification | Disposition |
| --- | --- | --- | --- | --- |
| F-01 | P0 | A native transfer may succeed while its callback is delayed forever or never executed. The contract cannot distinguish this from a delayed callback using time, balance deltas or an external assertion. | Production blocker | Unresolved by design. No timeout retry, public reconcile, blind unlock or speculative credit restoration was added. The amount stays pending and counted as a liability. |
| F-02 | P1 | A genuine native-transfer failure receipt was not reachable through the ordinary authenticated `withdraw()` API. The real sandbox deletion attempt failed before contract execution because the recipient is also the predecessor/signer. | Evidence limitation; production evidence gap | The VM `PromiseResult::Failed` branch is covered and the attempted sandbox manifest is preserved. A runtime-level failing transfer receipt remains unproven. |
| F-03 | P1 | No genuine Meteor, Sender or Nightly browser-wallet signature was finalized in this environment. | Submission/evidence blocker for a browser-signing claim | Authentic extension attempts and their external blockers remain recorded. CLI-signed testnet receipts are not described as browser-wallet evidence. |
| F-04 | P1 | Public Sputnik DAO proposal/quorum execution was not established on testnet. | Submission/evidence limitation | The Sputnik workflow is sandbox-verified only. The public testnet proof uses immutable disposable activation authorities. |
| F-05 | P1 | No independent qualified security audit has reviewed the contract. | Production blocker | The repository calls this an adversarial engineering review only. |
| F-06 | P2 | Sandbox fast-forward cannot force exact millisecond equality at a public-chain boundary. | Evidence limitation | Exact predicates are tested directly in the Rust VM and reference model; sandbox tests cross the boundaries. |

## Withdrawal state machine

| Runtime outcome | State transition | Liability result | Safe recovery |
| --- | --- | --- | --- |
| Transfer succeeds; callback succeeds | `pending → empty` | subtract exact amount | settled once |
| Transfer fails; callback succeeds | `pending → credit` | unchanged | contributor can claim again |
| Callback is delayed | `pending` remains | unchanged | wait for authenticated runtime result; no retry |
| Callback never executes | `pending` remains forever | conserved, but liveness lost | none proven |
| Duplicate/forged callback | rejected by private/authenticated pending amount checks | unchanged | none needed |

## Recommendation

The engineering hardening work can close only as a **testnet-only, faucet-funded demonstration candidate**. It cannot close as production financial infrastructure while F-01 remains unresolved. Do not merge PR #12, publish the repository, change Vercel access, post on X or submit until the owner accepts the explicit P0/P1 gate decisions.

Reproduce the hardening checks from the repository root:

```sh
node --test tests/pact.test.js
PACT_SCENARIOS=withdrawal-failure PACT_EVIDENCE_PATH=evidence/pact-atlas-withdrawal-failure-attempt-2026-11-12.json npm run test:sandbox
NPM_CONFIG_CACHE=/tmp/pact-npm-cache PLAYWRIGHT_BROWSERS_PATH=/tmp/pact-playwright-browsers npm run test:browser
sha256sum -c evidence/SHA256SUMS
```
