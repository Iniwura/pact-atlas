# PACT Atlas | NEAR testnet proof and honest release gate

## What is already verified

The exact offline campaign planner at `/create.html` accepts custom projects and pledge restrictions, produces a model-only funding result, and can export a reproducible local certificate. The pre-existing Rust contract has compiled Wasm, ABI, wallet request tests, and genuine **local NEAR sandbox** receipts. The sandbox is not public testnet.

## What is newly implemented

The separate `/verify.html` page and the `api/verify-testnet.mjs` endpoint verify a **user-supplied public NEAR testnet transaction** by querying a fixed testnet RPC, without a wallet or secrets. A valid result must:

1. Match the requested transaction hash, signer and destination contract account.
2. Call the specifically named PACT method (`commit`, `activate`, `expire` or `withdraw`).
3. Have `final_execution_status: FINAL` with successful transaction and receipt outcomes.
4. Find a matching current code hash for the contract. The pinned RC3 hash is `7CEBKra569k7TYyxoWSoXwVak83uXCmkDqgHJNvkxUEp`, taken from the regenerated PACT Wasm local sandbox evidence.
5. Fail closed if the RPC, transaction, receipts, identity or code hash cannot be checked.

Independent command-line reproduction (requires public RPC access):

```sh
npm ci
npm run verify:testnet -- <pact-contract.testnet> <signer.testnet> <transaction-hash> commit
```

This does not prove every payout was received, prove DAO governance, prove the activation allocation was correct, or independently audit security. Code hash equality is checked against the **current finalized account state**, not the contract's historical code hash at the transaction block. If an account is upgraded later, historical executions may require a separate archival review. Only successful signed transactions may be submitted to this verifier. It will not transform a saved local sandbox receipt into public proof.

The self-service path now prepares a real testnet campaign lifecycle: it validates named testnet owner/beneficiary/authority accounts, checks the preserved Wasm hash, constructs and sandbox-verifies `CreateAccount → Transfer → DeployContract → new → sponsor_storage`, waits for wallet finality, and creates a public campaign link. The contract authorizes `new` only from itself or the exact direct namespace parent. The live page checks the pinned code hash, authenticates `campaign_config()`, derives whole-pledge candidates from canonical `pledge_records()` and reads finalized `status()`, `accounting()` and `activation_certificate()` views. Unknown outcomes remain pending without retrying. Meteor/Wallet Selector modules are lazy-loaded only after an explicit action.

The implementation and deterministic browser-test results are supplemented by a bounded public testnet demonstration recorded in [`evidence/pact-atlas-testnet-evidence-2026-11-10.json`](../evidence/pact-atlas-testnet-evidence-2026-11-10.json). The public evidence uses disposable faucet-funded accounts only; it does not establish production safety or replace an independent audit.

## Completed public testnet lifecycle

The following two campaigns were independently queried at finalized state on `https://rpc.testnet.near.org`:

1. `campaign-20261110.pact-atlas-20261110.testnet` deployed the pinned Wasm, initialized one immutable `alpha` project, accepted a 1 NEAR canonical pledge from `supporter-20261110.testnet`, activated with `{pledge_index: 0, project_id: "alpha"}`, and settled a 1 NEAR beneficiary withdrawal.
2. `refund-20261110.supporter-20261110.testnet` deployed the same Wasm, accepted a 1 NEAR pledge from `refund-supporter-20261110.testnet`, expired after its deadline, and settled the full refund.
3. All 12 deployment/lifecycle transactions were independently checked on the official RPC as `FINAL` with successful transaction and receipt outcomes. The six public PACT method calls also pass `npm run verify:testnet` and match the current code hash.
4. Both final accounting snapshots report `liabilities: 0`, `credits: 0`, `pending: 0`, and `solvent: true`. Exact receipts, immutable configs, certificates and balances are in the evidence manifest.

## Remaining public testnet work

1. If demonstrating Sputnik DAO funding, establish a separately funded DAO, a proposal with the proper full 3 NEAR PACT commitment, council approvals and the executed proposal receipt. The minimal public campaign used its configured disposable activation authority, not Sputnik.
2. Independently verify the evidence from a clean machine through `/verify.html` or the CLI. The verifier proves finalized method execution and current Wasm equality; it does not prove historical code immutability or a qualified security audit.
3. Preserve the existing cinematic homepage and perform the final unauthenticated release review before any public promotion.

**Never sign with a production/mainnet wallet or publish private keys.** Never submit valuable funds: the callback non-execution and withdrawal recovery question remains a documented production blocker. The recorded testnet run used only disposable faucet-funded accounts and must not be generalized to valuable funds.

## Judge path (offline plus testnet-ready flow)

- `/` — approved cinematic homepage, unchanged.
- `/console` — inspect the 12 vs. 13 NEAR case and simulate the missing 1 NEAR.
- `/create.html` — make a custom campaign, configure projects and supporters, export the exact offline allocation, or prepare an explicitly wallet-approved testnet deployment when credentials are authorized.
- `/campaign?contract=…&config=…` — inspect a deployed campaign's finalized testnet views, contribute, activate and settle through explicit wallet approval. The share configuration is public; it is not a fabricated live state.
- `/verify.html` — independently inspect one of the recorded real public PACT testnet transactions.

The custom planner's arbitrary campaigns are deployable only as a new immutable campaign account with explicit beneficiary and authority accounts. The deployment workflow is not proof that a campaign was signed or funded. The user-facing pages must continue to label local model results, candidate certificates and finalized onchain results differently.

## Release acceptance

- Browser and Node proof verification tests pass on the exact release SHA.
- One human who has never seen PACT can run the campaign builder and understand whether a plan is fundable without verbal instructions.
- The verification page remains readable at 320px and keyboard-accessible, and never returns a green result for mismatched receipts or code hash.
- Release routes are accessible without Vercel SSO or a private GitHub login.
- Repository visibility, hackathon X demo, payout account and submitted project information have been deliberately reviewed before final promotion.

Public testnet evidence is now available for the bounded two-campaign demonstration. Do not extend that claim to Sputnik governance, native-transfer failure injection, callback liveness or production safety.
