# PACT Atlas final engineering review

Review basis: audit baseline `457a92e` (PR #11's audited head), current Rust and JavaScript source, regenerated artifacts, preserved benchmark/evidence files, and the RC3 verification rerun on 2026-11-10.

## RC3 live-chain hardening addendum

PR #11's latest audit reproduced three release-blocking defects at commit
`457a92e`: finality used JSON-RPC `query` instead of `tx`; live candidates
trusted planned supporters; and share-link configuration was not bound to
deployed immutable facts. All three now have regression tests and narrow fixes.
The contract adds only read-only `campaign_config()` and `pledge_records()`
views; accounting and authorization state transitions are unchanged. The
current branch remains local/sandbox verified, not testnet-verified.

## Recommendation

The engineering phase can close as a local, sandbox-backed hackathon release candidate. It must not be presented as production-ready, externally audited, testnet-verified, or safe for valuable funds. The remaining callback limitation is a production financial-safety blocker, not a reason to add an unsafe retry.

## Benchmark comparison

Amounts are integer benchmark units, not NEAR. `allocated/total` is nominal capital utilization; it can exceed 100% for the independent baseline because that baseline permits the same flexible pledge to be counted for multiple projects. `unused` is nominal refundable/unallocated capital. `over` is nominal overcommitment. `top-up` is the minimum additional funding reported by the benchmark for all target projects: exact only for PACT, heuristic/aggregate for the baselines. `valid` means all PACT allocation constraints are certified.

| Scenario | Independent funding | Threshold pooling | PACT Atlas | PACT runtime |
| --- | --- | --- | --- | ---: |
| Dependency coalition (`cyclic-dependencies` fixture) | 4 projects; 13/12 (108.3%); unused 0; over 1; top-up 1; valid **no** | 3; 10/12 (83.3%); unused 2; over 0; top-up 1; valid **no** | 3; 10/12 (83.3%); unused 2; over 0; top-up 1 **exact**; valid **yes** | 1.114 ms |
| Competing coalitions | 4; 20/15 (133.3%); unused 0; over 5; top-up 5; valid **no** | 3; 15/15 (100%); unused 0; over 0; top-up 5; valid **no** | 2; 10/15 (66.7%); unused 5; over 0; top-up 5 **exact**; valid **yes** | 0.348 ms |
| Restricted budgets | 3; 12/11 (109.1%); unused 0; over 1; top-up 1; valid **no** | 2; 8/11 (72.7%); unused 3; over 0; top-up 1; valid **no** | 2; 8/11 (72.7%); unused 3; over 0; top-up 1 **exact**; valid **yes** | 0.321 ms |
| Mutual conditions | 3; 12/12 (100%); unused 0; over 0; top-up 0; valid **no** | 3; 12/12 (100%); unused 0; over 0; top-up 0; valid **no** | 3; 12/12 (100%); unused 0; over 0; top-up 0 **exact**; valid **yes** | 0.124 ms |
| Infeasible network | 2; 9/12 (75%); unused 3; over 0; top-up 2; valid **no** | 2; 10/12 (83.3%); unused 2; over 0; top-up 2; valid **no** | 1; 4/12 (33.3%); unused 8; over 0; top-up 2 **exact**; valid **yes** | 0.095 ms |
| Large realistic network (8 projects/12 pledges) | 8; 29/30 (96.7%); unused 1; over 0; top-up 0; valid **no** | 8; 29/30 (96.7%); unused 1; over 0; top-up 0; valid **no** | 8; 29/30 (96.7%); unused 1; over 0; top-up 0 **exact**; valid **yes** | 138.267 ms |

The preserved JSON records runtime only for the PACT solver. Baseline runtimes were not instrumented, so no runtime speed claim is justified. The independent exhaustive oracle matches PACT's ranking in the five oracle-eligible scenarios; the 8/12 case is measured but not independently re-enumerated (`optimalityChecked: null`).

## Where each approach wins, ties, or loses

- **Constraint correctness:** PACT is strictly better in all six rows: it returns a valid certificate in 6/6; both baselines return `constraintSatisfied: false` in 0/6. This is the strongest supported differentiation.
- **Raw project count versus independent funding:** independent funding reports more nominal projects in dependency-coalition, competing-coalitions, restricted-budgets and infeasible-network; it ties PACT in mutual-conditions and large-realistic. Those apparent wins are not valid activations because they ignore shared-pledge conservation and/or conditions/dependencies.
- **Raw project count versus threshold pooling:** threshold pooling reports more nominal projects in competing-coalitions and infeasible-network; it ties PACT in the other four rows. Those two apparent wins are aggregate threshold results without a project-level certificate.
- **Capital utilization:** PACT ties threshold pooling in dependency-coalition, restricted-budgets, mutual-conditions and large-realistic. It intentionally uses less nominal capital than threshold pooling in competing-coalitions and infeasible-network because the remaining capital cannot be assigned to a valid coalition. Independent funding appears to use more capital in four rows only through double-counting/overcommitment.
- **Minimum intervention:** all three rows report the same numeric top-up in each scenario, but only PACT marks the result exact. The baselines' values are aggregate heuristics and must not be presented as optimized interventions.
- **Raw runtime:** no cross-approach conclusion is possible. PACT runtime ranges from 0.095 ms to 138.267 ms on the preserved run, and the solver is exponential and bounded.

Therefore PACT does not demonstrate superior activation count, capital efficiency, or runtime. It demonstrates a different guarantee: a bounded, inspectable allocation certificate that enforces one-use pledges, exact project targets, allowed-project constraints, pledge conditions and dependency closure.

## Differentiation claim audit

Supported by the current source and evidence:

- a small NEAR contract that verifies and stores an allocation certificate;
- a bounded exact counterfactual solver with blocked reasons and a narrowly defined exact top-up calculation;
- explicit separation between model-only what-if changes, DAO-approved conditions and signed chain state;
- local Sputnik DAO proposal/quorum/funding/refund evidence and machine-readable liability reconciliation.

Not supported and removed from the release position:

- claims of novel mathematics or invention of conditional crowdfunding;
- claims of superior capital efficiency, more activated projects, faster solving, scalability, or a guaranteed coalition win;
- claims of production safety, callback liveness, confidentiality, project delivery, or universal optimality;
- claims that PACT replaces Gitcoin, Deep Funding, Codo, quadratic matching, or coalition-formation research.

The comparison remains capability-level prior-art analysis. The referenced systems are not reimplementations in this repository, and the benchmark does not constitute a market or economic study.

## Security and evidence classification

| Item | Classification | Finding |
| --- | --- | --- |
| Missing withdrawal callback after an unknown native-transfer outcome | **Production blocker** | Pending liability can remain stranded indefinitely. Timeout unlocks, retries, public reconciliation and balance-difference inference are unsafe and were not implemented. |
| Genuine native-transfer failure injection through a real predecessor | **Evidence limitation; production blocker until tested** | The Rust VM covers `PromiseResult::Failed`, but the sandbox harness did not safely reproduce a failing native recipient while preserving the authenticated withdrawal predecessor. |
| Exact timestamp boundaries | Verified locally, **evidence limitation for sandbox exactness** | Rust VM tests cover equality; near-workspaces crosses boundaries but does not set exact timestamps. |
| Storage/max capacity | Sandbox-verified within configured limits; **production blocker for unbounded use** | 8 projects/32 pledges and storage reserve checks pass. Larger state growth and economic sizing remain unproven. |
| Independent qualified audit | **Submission limitation, production blocker** | No external auditor has reviewed the contract. The review is adversarial engineering only. |
| Testnet deployment and wallet signatures | **Submission/evidence blocker** | No authorized credentials or testnet deployment were available; no testnet evidence is claimed. |

Mitigated findings include initialization front-running, unauthorized activation, duplicate callback settlement, repeated withdrawals, allocation double-use, accounting conservation and storage-reserve checks within configured limits.

## Final verification and artifact record

The final rerun uses the pinned Rust/near-sdk/cargo-near versions and the current tracked artifacts:

- 15 Rust tests; formatting, locked check, clippy with warnings denied, ABI generation and optimized Wasm build pass.
- 35 core Node tests plus 9 competitive benchmark tests pass.
- 23 counterfactual, 8 workflow, 9 chain/RPC/live-data/ABI, 8 wallet-adapter and 51 Chromium/accessibility checks pass.
- Five fresh NEAR sandbox campaigns and the separate 8-project/32-pledge capacity campaign pass.
- `evidence/SHA256SUMS` verifies every preserved evidence file.
- Wasm SHA-256: `9ed866dd401b57f26a3aa35dbe722230a0d3893bb31ed0fbbb1e320db7dd2e6f`.
- ABI SHA-256: `8399a2cc59c37680ed2ae418f2f04cc8121dda2eca0f8777a9933d1de46e2f5b`.
- Competitive benchmark JSON SHA-256: `3c748d13ba919fd77a9a866db077f7e0e3ab460b50411de210ab372a30f46da8`.
- Baseline sandbox evidence SHA-256: `e88b6ba2a2f88eb376c69a1a1dd7c46859207346f511b3d961011ea5d8d297a1`.
- Maximum-capacity sandbox evidence SHA-256: `28f264e0123672e03d8046a27497d01c99f0f798f7cd8f962aeaede439366931`.
- NEAR code hash: `Bh4oaer6T9uUwbQBEfN1RFJ4S3jteMBnH6pWH7qC5nKx`.
- Audit baseline: `457a92e`; no merge, publication, permission change, production promotion, mainnet call or real-fund spend occurred. The current release commit is recorded in the Git history after this review.

## Evidence index

- [Competitive benchmark JSON](evidence/competitive-benchmark.json)
- [Competitive methodology and prior art](docs/COMPETITIVE_ADVANTAGE.md)
- [Security review](docs/SECURITY_REVIEW.md)
- [Withdrawal/callback review](docs/WITHDRAWAL_REVIEW.md)
- [Verification report](evidence/pact-atlas-verification-report.md)
- [RC1 sandbox report](evidence/pact-atlas-rc1-report.md)
- [Baseline sandbox receipts](evidence/pact-atlas-sandbox-evidence.json)
- [Maximum-capacity sandbox receipts](evidence/pact-atlas-rc1-sandbox-evidence.json)
- [Wasm](evidence/pact_atlas_poc.wasm) and [ABI](evidence/pact_atlas_poc_abi.json)
- [Hash manifest](evidence/SHA256SUMS)

Engineering is frozen at this review boundary. The minimal next step, requiring separate authorization, is an isolated faucet-funded testnet campaign and qualified security review; neither is part of this release.
