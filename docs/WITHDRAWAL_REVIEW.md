# Withdrawal and callback non-execution review

## Established guarantee

`withdraw()` removes the caller's credit and places the exact amount in `pending` before scheduling the native transfer. The amount remains part of `liabilities`. The private callback can settle the liability exactly once when the runtime reports one successful promise result, or restore the credit exactly once when the runtime reports a failed result. A caller cannot forge the callback, invoke it externally, change its amount, or withdraw twice while the pending record exists.

These guarantees are covered by the Rust VM, reference-model, baseline sandbox and RC1 repeated-transaction tests.

## Unproven failure mode

If the native transfer succeeds but the callback never executes, the contract cannot safely infer success from time, account balance, or an external observer:

- a recipient may have received unrelated funds, so balance deltas are not proof of this transfer;
- a delayed callback and a permanently missing callback are indistinguishable to contract code;
- an unlock followed by a retry can double-pay if the original transfer eventually succeeded;
- an external signer cannot call the private callback or provide a runtime-authenticated promise result.

Therefore a missing callback leaves the amount pending forever and the liability conserved. This is fail-closed but not a liveness guarantee.

## Redesigns considered

1. **Timeout retry or timeout unlock — rejected.** It cannot distinguish a delayed callback from a successful transfer and can create a double payment.
2. **Public `reconcile(owner, amount)` — rejected for this contract.** Without a runtime-authenticated receipt proof it would let an attacker or an honest observer assert an unknown outcome.
3. **Balance-difference reconciliation — rejected.** It is not attributable when the recipient has other deposits or transfers.
4. **Direct transfer with no callback — rejected.** It removes the only on-chain success/failure branch and makes liability settlement unverifiable.
5. **Escrow/claim protocol with explicit recipient acknowledgement — possible future redesign.** It can improve operational recovery only if its acknowledgement is tied to a runtime-authenticated transfer receipt or an equivalent idempotent settlement proof; a UI acknowledgement alone is not enough.
6. **Keep value in contract credits and require a later, authenticated claim — possible future redesign.** This removes the callback from the accounting transition but still needs a safe finalization rule for the native transfer. It is not implemented or proven here.

## RC1 restriction

The contract and product are restricted by release policy to local sandbox and, only with explicit authorization, isolated faucet-funded testnet demonstrations. No mainnet, production keys, valuable deposits, or public financial use is permitted. The browser never adds a retry or unlock path, and the RC1 report must continue to identify callback non-execution as a high-severity unresolved issue until a qualified review and a runtime-authenticated redesign exist.

## 2026-11-12 sandbox injection attempt

`evidence/pact-atlas-withdrawal-failure-attempt-2026-11-12.json` records a genuine sandbox attempt to delete a credited beneficiary before it called `withdraw()`. The deletion finalized, but the old signer could no longer submit the withdrawal (`no matching key pair found`). No PACT function receipt, native-transfer receipt or callback receipt was reached. The contract still reported the original 1 NEAR credit, 1 NEAR liability, zero pending withdrawal and `solvent: true`.

This is evidence of the reachability boundary, not a successful native-transfer failure injection. Because `withdraw()` always targets `env::predecessor_account_id()`, the ordinary API requires the recipient to remain an authenticated signer. The runtime `PromiseResult::Failed` callback branch remains VM-tested, while an actual failed native transfer followed by an authenticated callback remains untested.
