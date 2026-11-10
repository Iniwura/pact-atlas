# NEAR sandbox and testnet gate (local sandbox and bounded public testnet evidence complete)

## Phase A — compilation
- [x] Install stable Rust >= near-sdk 5.29.1 MSRV (Rust 1.93.0 used).
- [x] `cargo fmt --check`.
- [x] Locked `cargo check --target wasm32-unknown-unknown`.
- [x] Locked `cargo test` (15/15).
- [x] Build actual WASM artifact via supported `cargo near build` workflow with `wasm-opt`.
- [x] Generate ABI and confirm exact JSON argument names for `new`, `commit`, `activate`, `accounting`, `campaign_config`, `pledge_records`, other views and callback.

## Phase B — sandbox
- [x] Deploy one immutable campaign contract funded with **developer-sponsored storage reserve**.
- [x] Initialize four projects with separate beneficiary accounts, future deadline, activation start, min funded project count of 3.
- [x] Test 5 distinct investor accounts with a total of 12 NEAR attached to `commit` calls; read actual contract NEAR balances.
- [x] Call `activate` with invalid duplicate indexes, underfunding, disallowed target, and broken dependencies; all reverted without changing liabilities or storage stake.
- [x] Activate A+B+C with 10 NEAR, verify 4 + 3 + 3 NEAR claimable for three beneficiaries; 2 NEAR remains claimable by unused donor.
- [x] Withdraw using three beneficiary accounts and unused donor account; actual receipts settled liabilities to zero.
- [x] In a fresh campaign, include sixth 1 NEAR deposit and activate all A+B+C+D; verify 13 NEAR sum across beneficiaries.
- [x] In another fresh campaign, allow deadline to expire and refund all five investors; no locked liability remains.
- [ ] Intentionally cause a native transfer failure through a real predecessor while preserving the callback path; the callback `PromiseResult::Failed` branch is covered by Rust VM unit tests, but native failure injection is not safely reachable in this harness.
- [x] Deploy the official Sputnik v2 Wasm in sandbox; create proposals, reject an unauthorized vote, require both council approvals, execute a PACT funding call, and withdraw an expired DAO-owned refund through a second approved proposal.
- [x] Verify insolvency/storage reserve check and actual storage usage on NEAR VM; final sandbox reserves remained above the configured buffer.
- [x] Test concurrent deposits, competing authorized activation requests, repeated withdrawals, unauthorized activation and private callback authorization.
- [x] Test exact timestamp equality at `activate_after_ms` and `deadline_ms` in Rust VM tests; the sandbox runner separately crosses both boundaries because near-workspaces does not expose exact timestamp injection.
- [x] Exercise maximum configured capacity in a genuine sandbox: 8 projects, 32 pledges, activation, measured storage reserve, 32 successful withdrawals and repeated withdrawal rejection. Evidence is in `evidence/pact-atlas-rc1-sandbox-evidence.json`.

## Phase C — network
- [x] Implement named testnet campaign validation, preserved-Wasm hash check, explicit multi-action deployment request and public share-link builder.
- [x] Execute the exact self-service deployment action order in genuine sandbox: `CreateAccount → 3 NEAR transfer → DeployContract → new → 2 NEAR sponsor_storage`, followed by commit, activation and withdrawal.
- [x] Correct finalized transaction RPC transport, authenticate immutable campaign configuration and derive allocation candidates from canonical onchain pledge records.
- [x] Implement finalized read-only campaign views, explicit whole-pledge commit/activation/expiry/withdrawal requests and no-retry unknown-outcome handling.
- [x] Browser-test the public campaign route with mocked finalized RPC responses and malformed-link fail-closed behavior. This is not a real-chain result.
- [x] Read-only testnet RPC probe returned `chain_id: testnet` (protocol 88); pinned Wallet Selector v10.1.4 core/modal/Meteor endpoints returned HTTP 200 without signing.
- [x] Create separate faucet-funded NEAR testnet identities with credentials kept outside the repository.
- [x] Deploy the pinned compiled WASM to dedicated testnet accounts, not mainnet; independently verify both code hashes.
- [x] Reproduce a successful activation/beneficiary withdrawal and a separate expired-campaign full refund with finalized transaction hashes.
- [x] Publish explorer evidence and update `README.md` with judge-facing 'do X, see Y' instructions. See `evidence/pact-atlas-testnet-evidence-2026-11-10.json` and `evidence/pact-atlas-testnet-coalition-evidence-2026-11-10.json`.
- [x] Complete a public two-project coalition campaign: independent contributors pledged out of order, a conditional pledge required a dependency, the authority accepted the canonical allocation certificate, both beneficiaries withdrew, and finalized accounting reconciled to zero liabilities.
- [ ] Verify real Meteor wallet signing and a multi-member Sputnik DAO approval flow on public testnet.
- [ ] Only after testnet success, consider a production-ready contract audit and expansion.

## Hard stop criteria
- [ ] Any solvency/accounting invariant fails.
- [x] A `PromiseResult::Failed` callback restores withdrawal rights without changing liability (Rust VM and reference tests).
- [ ] A callback that never executes still has no safe recovery path. **Production blocker; no timeout retry or blind unlock is acceptable.**
- [x] Anyone can trigger a valid but unauthorized coalition against campaign's configured activation authorities.
- [ ] User deposits are implicitly consumed to pay for NEAR storage stake.

The existing Node test suite is **not** evidence that near-sdk code compiles. The attached sandbox evidence is separate from the public testnet manifest; neither is mainnet or production evidence.

## Additional unresolved callback risk
A callback that itself runs out of gas or fails to execute may leave an in-flight withdrawal marked `pending`. It is not safe to blindly unlock it because the transfer might have succeeded. Before production, validate gas margins on the deployed VM and introduce a rigorously authenticated, idempotent reconciliation mechanism or another proven withdrawal architecture. Current PoC does **not** claim to solve this failure mode.

## RC1 security campaign

The RC1 campaign is deliberately separate from the five-scenario baseline evidence so the original judging evidence remains unchanged. It records a fresh sandbox contract ID, 32 commit receipts, activation, 32 settlement receipts, a repeated-withdrawal failure, storage reserve snapshots and final balance reconciliation. Native-transfer failure injection remains untested in genuine sandbox because a failing recipient cannot also remain the authenticated predecessor required to initiate `withdraw()` in this harness. The callback `PromiseResult::Failed` branch is covered in the Rust VM.

## Evidence map

- `evidence/pact-atlas-sandbox-evidence.json`: final local receipt hashes, sandbox version, artifact hashes, state/accounting snapshots and balance reconciliation.
- `evidence/pact-atlas-rc1-sandbox-evidence.json`: separate RC1 maximum-capacity sandbox evidence.
- `evidence/pact_atlas_poc.wasm`: exact PACT Wasm used by the evidence.
- `evidence/pact_atlas_poc_abi.json`: exact ABI generated from the same source state.
- `docs/SECURITY_REVIEW.md`: severity-ranked findings, mitigations, unresolved risks and assumptions.
