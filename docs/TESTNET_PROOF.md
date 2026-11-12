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

The self-service path now prepares a real testnet campaign lifecycle: it validates named testnet owner/beneficiary/authority accounts, checks the preserved Wasm hash, constructs and sandbox-verifies `CreateAccount → Transfer → DeployContract → new → sponsor_storage`, waits for wallet finality, and creates a public campaign link. The contract authorizes `new` only from itself or the exact direct namespace parent. The live page checks the pinned code hash, authenticates `campaign_config()`, derives whole-pledge candidates from canonical `pledge_records()` and reads finalized `status()`, `accounting()` and `activation_certificate()` views. Unknown outcomes remain pending without retrying. Meteor, Sender and Nightly Wallet Selector modules are lazy-loaded only after an explicit action.

The implementation and deterministic browser-test results are supplemented by bounded public testnet demonstrations recorded in [`evidence/pact-atlas-testnet-evidence-2026-11-10.json`](../evidence/pact-atlas-testnet-evidence-2026-11-10.json) and [`evidence/pact-atlas-testnet-coalition-evidence-2026-11-10.json`](../evidence/pact-atlas-testnet-coalition-evidence-2026-11-10.json). The public evidence uses disposable faucet-funded accounts only; it does not establish production safety or replace an independent audit.

## 2026-11-11 Meteor browser-signing gate — not verified

This gate was attempted with a fresh disposable faucet-funded `.testnet` signer, the official Meteor Wallet Chrome Web Store distribution (extension version `0.8.12`), a dedicated Playwright Chromium profile, and the real Wallet Selector v10.1.4 testnet module. The authentic extension loaded, Wallet Selector opened the Meteor connection request, and the extension's testnet connection route was reached. No signing transaction was submitted and no browser receipt is claimed.

The exact external blocker was Cloudflare access denial from Meteor's official service while the extension UI attempted to look up the disposable testnet account: `https://backend-v2.meteorwallet.app/api/testnet/helper/publicKey/<public-key>/accounts` returned HTTP `403`. The official web-wallet route `https://wallet.meteorwallet.app/connect/testnet/signIn` returned the same HTTP `403` block in the isolated browser. The extension therefore could not import the disposable account through its own UI, and the connection request remained at **No Meteor Wallet account found**. This was not bypassed with extension storage injection, a patched wallet API, a fake adapter, or a direct SDK signature.

The attempt also found and fixed two application-side compatibility defects before reaching this external blocker: the Meteor esm.sh module now pins `near-api-js@5.1.1`, and the Wallet Selector host now returns the imported `setupModal` factory. The regression tests cover both boundaries. The Meteor-specific gate remains open until the official Meteor service is reachable from a disposable testnet browser session and a real Meteor-signed `commit` is independently finalized on `https://rpc.testnet.near.org`; a successful Sender or Nightly signature would be a separate genuine browser-wallet result, not Meteor evidence.

## 2026-11-11 alternate browser-wallet gate — not verified

The release now includes the official NEAR Wallet Selector `@near-wallet-selector/sender@10.1.4` and `@near-wallet-selector/nightly@10.1.4` modules alongside the pinned Meteor module. The authentic Sender and Nightly Chrome Web Store distributions were loaded in isolated Playwright Chromium profiles. Sender reached its real setup flow but could not provide an initialized account for this campaign; the official Wallet Selector implicit-account limitation is documented in [issue 1472](https://github.com/near/wallet-selector/issues/1472). Nightly created a disposable implicit NEAR testnet identity and official RPC confirmed a 2 NEAR balance, but the extension provider was not injected into the isolated page origin, so Wallet Selector reported **Nightly wallet not injected within timeout**. No transaction was approved, no SDK signature was substituted, and no browser receipt is claimed. Full details, hashes and the unchanged campaign state are in [`evidence/pact-atlas-alternate-wallet-attempt-2026-11-11.json`](../evidence/pact-atlas-alternate-wallet-attempt-2026-11-11.json).

## Completed public testnet lifecycle

The following three campaigns were independently queried at finalized state on `https://rpc.testnet.near.org`:

1. `campaign-20261110.pact-atlas-20261110.testnet` deployed the pinned Wasm, initialized one immutable `alpha` project, accepted a 1 NEAR canonical pledge from `supporter-20261110.testnet`, activated with `{pledge_index: 0, project_id: "alpha"}`, and settled a 1 NEAR beneficiary withdrawal.
2. `refund-20261110.supporter-20261110.testnet` deployed the same Wasm, accepted a 1 NEAR pledge from `refund-supporter-20261110.testnet`, expired after its deadline, and settled the full refund.
3. `coalition-20261110.beneficiary-20261110.testnet` deployed the pinned Wasm, initialized `alpha` and `beta` where beta depends on alpha, accepted beta first and alpha second from separate contributors, activated with `{pledge_index: 1, project_id: "alpha"}` and `{pledge_index: 0, project_id: "beta"}`, and settled both beneficiary withdrawals.
4. All 20 deployment/lifecycle transactions across the three campaigns were independently checked on the official RPC as `FINAL` with successful transaction and receipt outcomes. The eleven public PACT method calls recorded in the two manifests also pass `npm run verify:testnet` and match the current code hash. The latest coalition campaign has zero final liabilities and `solvent: true`.
4. Both final accounting snapshots report `liabilities: 0`, `credits: 0`, `pending: 0`, and `solvent: true`. Exact receipts, immutable configs, certificates and balances are in the evidence manifest.

## Remaining public testnet work

1. If demonstrating Sputnik DAO funding, establish a separately funded DAO, a proposal with the proper full 3 NEAR PACT commitment, council approvals and the executed proposal receipt. The minimal public campaign used its configured disposable activation authority, not Sputnik.
2. Independently verify the evidence from a clean machine through `/verify.html` or the CLI. The verifier proves finalized method execution and current Wasm equality; it does not prove historical code immutability or a qualified security audit.
3. Preserve the existing cinematic homepage and perform the final unauthenticated release review before any public promotion.

**Never sign with a production/mainnet wallet or publish private keys.** Never submit valuable funds: the callback non-execution and withdrawal recovery question remains a documented production blocker. The recorded testnet run used only disposable faucet-funded accounts and must not be generalized to valuable funds.

## Judge path (offline plus testnet-ready flow)

- `/` — approved cinematic homepage, unchanged.
- `/console` — inspect the 12 vs. 13 NEAR case and simulate the missing 1 NEAR.
- `/console#public-proof` — inspect the genuine faucet-funded coalition and expiry/refund receipts, including the accepted certificate and public explorer links. This section is read-only and clearly separate from the offline simulation.
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

Public testnet evidence is now available for the bounded three-campaign demonstration, including one dependency-aware multi-project coalition. Do not extend that claim to Sputnik governance, genuine browser-wallet signing, native-transfer failure injection, callback liveness or production safety.
