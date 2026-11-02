# Wallet and NEAR workflow boundary

The product UI is safe to open without credentials. It uses `window.PACT_NEAR_ADAPTER` only when a host wallet integration explicitly provides it. The preview never invents a transaction hash and never signs automatically.

An authorized testnet host may provide this narrow interface:

```js
window.PACT_NEAR_ADAPTER = {
  async connect() {},
  async call({ contractId, methodName, args, deposit, gas }) {},
  async view({ contractId, methodName, args }) {},
};
```

The intended contract calls are:

| Product action | Contract / governance call | Evidence to show after confirmation |
| --- | --- | --- |
| Create commitment | `PACT.commit(allowed, requires)` with attached native NEAR | receipt hash, pledge index, `accounting()` |
| Approve funding | Sputnik DAO proposal creation, votes and execution | proposal ID, approval receipts, funding receipt |
| Generate certificate | local `web/engine.mjs` solver | certificate allocations, exact/heuristic label, model inputs |
| Activate | `PACT.activate(allocations)` from an immutable authority | activation receipt, `status()`, beneficiary credits |
| Claim refund | `PACT.withdraw()` after `expire()` or unused allocation | transfer receipt, `claimable()`, `pending_withdrawal()` |

The adapter must refuse to treat model-only conditions as approved DAO state. It must also expose the transaction result before the UI marks an action confirmed. A failed native transfer is not a permission to retry blindly: the contract's pending-withdrawal callback path remains fail-closed until a safe authenticated reconciliation design is proven.

## RC1 request builder

`web/near-workflow.mjs` is the framework-neutral request layer used by the browser. It builds the exact native requests without owning keys or signing:

- `commit` attaches 3 NEAR to `PACT.commit` with the displayed allowed route.
- `approve` creates a Sputnik `add_proposal` request whose function call targets the configured PACT contract. Required council members must still approve and execute it through their own authorized wallet sessions; the UI never fabricates quorum.
- `certify` runs the exact local solver and converts pledge labels to on-chain indices. It is not a transaction.
- `activate` submits the certificate to the immutable activation authority.
- `withdraw` submits the contract's pull-payment method. The UI never retries a missing or unknown receipt.

An authorized host supplies the non-secret configuration:

```js
window.PACT_NEAR_CONFIG = {
  network: "testnet",
  pactContractId: "pact-rc1.testnet",
  daoContractId: "sputnik-rc1.testnet",
};
```

The host may be implemented with [HOT Connect](https://github.com/azbang/near-connect) or [NEAR Wallet Selector](https://github.com/near/wallet-selector). NEAR's current Wallet Selector guidance recommends exploring HOT Connect during the transition and describes HOT Connect as Wallet Selector-API compatible. Wallet Selector v10 requires the newer `@near-js` action format or its `actionCreators`; keeping this adapter boundary avoids coupling the product evidence layer to either signing implementation. The compatibility claim is based on the current upstream project documentation, not on a completed live-wallet test in this checkpoint.

`web/near-adapter.mjs` provides the optional bridge for an authorized host. Pass the wallet returned by `connector.wallet()` or `selector.wallet()`, and pass Wallet Selector v10's `actionCreators.functionCall` when using v10. The bridge refuses to report success when the wallet returns no transaction hash, and it never retries a request. A host can install it explicitly:

```js
import { createNearWalletAdapter } from "/near-adapter.mjs";
window.PACT_NEAR_ADAPTER = createNearWalletAdapter({
  connector, // HOT Connect, or replace with selector + walletId
  functionCall: actionCreators?.functionCall,
  provider, // optional JSON-RPC provider for finality views
});
```

The adapter is unit-tested with deterministic wallet doubles. It is not a live-wallet or testnet result; those remain gated on isolated credentials and explicit authorization.

## Testnet preparation

Use isolated `*.testnet` accounts, a faucet-funded balance, a newly deployed PACT account and a separate Sputnik DAO account. Store only non-secret configuration in a local ignored file. Record the contract and DAO account IDs, code hashes, transaction hashes, state transitions and final balance reconciliation in a new evidence file; do not overwrite the local sandbox evidence.

No testnet credentials or deployment authorization were present for this checkpoint, so no testnet transaction is claimed here.
