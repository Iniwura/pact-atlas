# PACT Atlas: security and readiness review (November 2, 2026)

**Status: experimental only. Local Rust, Wasm, ABI and real NEAR sandbox verification passed; this document is an adversarial engineering review, not an independent qualified security audit, and the contract must not be used with real value.**

## Verified in this environment

- Source archive extracted and inspected.
- Node.js reference-model suite: **26 tests pass**.
- Rust contract: **13 unit tests pass**, locked Wasm check passes, and clippy passes with warnings denied.
- Optimized nearcore-compatible Wasm build passes; SHA-256 is recorded in the sandbox evidence.
- Real NEAR sandbox: **5 baseline campaigns pass**, plus a fresh RC1 maximum-capacity campaign with all 8 projects, all 32 pledge slots, measured storage reserve, activation and 32 successful withdrawals.
- Two reproducible offline certificates generated successfully.
- Storage reserve was measured in sandbox; final available reserves remained about 19.035 NEAR with storage stake about 1.962–1.963 NEAR.

## Unverified gates

- Testnet deployment, signed calls and explorer receipts.
- Native-transfer failure injection through a real predecessor account and callback non-execution recovery.
- Independent qualified external audit.

## Changes since the original checkpoint

1. Funding window closes **before** activation starts. This prevents a valid activation from cutting off an explicitly advertised deposit window early. `activate_after_ms` is both the funding cutoff and earliest activation time; it must be in the future at initialization and precede the campaign deadline.
2. Initialization is bound to the contract account (`predecessor == current`), mitigating deploy/init front-running. Deployment should still use an atomic controlled workflow.
3. Activation requires an immutable `activation_authorities` allowlist. A valid certificate from an unauthorized caller is rejected; competing authorized calls are serialized by NEAR and only the first can change phase.
4. The immutable campaign can specify `required_for_activation` project IDs. The on-chain verifier rejects a proposal that omits any of those projects, even if it meets the numeric minimum.
5. Every successful allocation is retained as an on-chain `activation_certificate`; `status()` exposes the final funded project IDs, mandatory set and activation authorities.
6. `accounting()` exposes the conservation identity and reserve calculation. Solvency checks during normal state transitions verify both contract balance and liability conservation across locked pledges, credits and pending transfers.
7. Callback gas budget is 40 TGas with explicit single-result checking. This is **not** a recovery mechanism for failed or missing callbacks.
8. Thirteen Rust unit tests cover JSON entrypoint decoding, initialization authorization, exact activation/deadline boundaries, maximum project/pledge capacity, accounting, callback success/failure and duplicate callback behavior.
9. A real NEAR sandbox runner verifies five fresh baseline campaigns with actual attached deposits, invalid allocations, dependency rejection, top-up activation, expiry refunds, competing requests, activation authorization, withdrawals, liabilities, storage reserve balances and Sputnik DAO proposals. An isolated RC1 run additionally exercises all 8 project slots, all 32 pledge slots, storage growth, activation, settlement and repeated withdrawal rejection.

## Severity-ranked findings and disposition

| Issue | Why it matters | Required validation / mitigation |
| --- | --- | --- |
| Callback execution failure after transfer | If the transfer happened but callback did not execute, `pending` could remain forever. Blind retry is unsafe because it risks paying twice. | The callback `Failed` branch is VM-unit-tested; native transfer failure injection and a proven reconciliation design remain open. No automatic timeout unlock. |
| Asynchronous transfer outcomes | NEAR transfer receipts finish asynchronously. A returned `Promise` does not equal final settlement. | Inspect final outcome and account balances, including intentionally failing transfers. |
| Storage sponsorship | The account must maintain code/storage stake without spending contributors' refundable money. State growth can increase storage usage. | Baseline and RC1 sandbox runs measured a separately funded reserve through the configured 8-project/32-pledge maximum. Unbounded production growth and economic sizing remain open. |
| Solver fairness / global optimality | A valid plan is not necessarily the highest-value or most inclusive plan. The verifier only proves eligibility and conservation. | State selection policy publicly; require coalition-specific campaign configuration, optional governance approval. Never market as universally optimal. |
| Withdrawal denial from callback | A callback with too little gas may leave stuck pending balances. | VM gas measurement, failure scenarios, reconciliation before real funds. |
| Front-running initialization | Uninitialized contracts can be initialized by unintended callers if deployment and initialization are separated. | **Mitigated in code:** `new` requires the contract account as predecessor, with a regression test. Deployment should still initialize atomically or with the contract account’s controlled key. |
| Unauthorized activation | A permissionless activation could select a valid but unapproved coalition. | **Mitigated for this build:** `activate` requires an immutable authority allowlist and sandbox evidence shows unauthorized rejection plus one winner among competing authorized requests. A future DAO should configure itself as an authority when DAO approval must control activation. |
| Data visibility | Project choices, contributor wallets, amounts, conditions and certificates are public on NEAR. | Do not claim confidentiality or anonymous cooperation for this build. |
| Beneficiary accountability | Beneficiaries can withdraw immediately after valid allocation, even if they later fail to deliver. | Explicitly limit promises to *funding feasibility*, not service delivery guarantees. |

## Financial invariant

Before activation or expiry: `liabilities == sum(locked pledges)`.

After activation or expiry: `liabilities == sum(credits) + sum(pending withdrawals)`.

Additionally, the NEAR account must maintain `balance >= liabilities + staked-storage requirement + buffer` at transitions checking solvency. The public `accounting()` view reports each term and `solvent`; the sandbox measured it through all five baseline scenarios and the RC1 maximum-capacity scenario. This is not a production capacity proof for unbounded state growth.

## Activation selection policy

- The campaign defines mandatory project IDs and a minimum count at initialization.
- Incoming commitments close at `activate_after_ms`.
- Only an immutable campaign-configured activation authority may submit a valid allocation after this cutoff and before `deadline_ms`.
- The contract checks validity, not whether the submitted plan is the globally best one.
- If no valid plan is accepted by the deadline, anyone may expire the campaign and everyone has refund credits.

This is a controlled proof-of-concept, not a fully solved fair-allocation mechanism. Future governance may still require commitments to a specific winning plan, challenge windows, or independent optimality proofs.

## Independent adversarial review

A separate read-only adversarial review was performed against the current Rust source and sandbox harness. It found no direct reentrancy path and confirmed that duplicate callbacks cannot reduce liabilities twice. The review did not constitute an external audit and no auditor has endorsed this contract.

Disposition:

- High, missing callback execution: unresolved. A transfer can succeed while the callback is never observed, leaving `pending` and a liability indefinitely. No timeout retry or blind unlock was added. This remains a hard blocker for valuable funds.
- High, initialization front-running: mitigated by contract-account predecessor authorization and a Rust regression test; atomic deployment is still required operationally.
- High, unauthorized activation: mitigated by immutable activation authorities and real sandbox rejection/competition tests. DAO-controlled activation is a future integration choice, not claimed here.
- Medium, storage capacity: partially mitigated by live reserve checks, exact host boundary tests and the RC1 8-project/32-pledge sandbox campaign; larger or unbounded campaigns remain outside the configured limits.
- Medium, native transfer failure injection: untested in genuine sandbox because the failing recipient cannot also remain the authenticated withdrawal predecessor in this harness. The callback failure branch is covered by VM unit tests.
- Medium, artifact drift: mitigated for this checkpoint by rebuilding Wasm, ABI, evidence and report from the same current source state. No immutable Git revision exists in the supplied archive.

Assumptions: native NEAR transfer semantics and callback delivery follow the deployed nearcore runtime; the configured activation authorities represent the intended campaign consent policy; storage sponsorship is supplied independently of contributor liabilities.
