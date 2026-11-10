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

These are implementation and deterministic browser-test results, not public-chain evidence. No authorized testnet wallet or signed campaign was available for this release.

## Real testnet lifecycle still needed

**No public PACT testnet deployment or funding transactions are claimed in this branch.** The following is the authorized testnet demonstration plan:

1. Prepare distinct faucet-funded `*.testnet` accounts for the contract, storage sponsor, beneficiaries, supporters, and activation authority. Never commit keys.
2. Deploy the exact pinned Wasm to a dedicated contract account. Initialize through the contract account or its exact namespace parent in the tested atomic sequence, with immutable beneficiary addresses, funding targets, a future funding cutoff and later activation deadline.
3. Sponsor contract storage separately; user deposits must not pay the storage reserve.
4. Have the actual signer accounts make `commit` calls with permitted project destinations and native NEAR. Collect their transaction hashes, pledge indices and contract `accounting()` state after finality.
5. After the configured activation start and before the deadline, generate the fixed reference allocation and have an immutable authority submit `activate`. Record the final receipt, `activation_certificate()`, `status()` and `accounting()`.
6. Withdraw eligible beneficiary credits and any unused contributor refunds using the original accounts. Capture receipts, `claimable()`, pending withdrawals and final accounted liabilities.
7. In a **different freshly deployed campaign**, allow expiry, call `expire`, then withdraw all expired contributors' refunds. Do not conflate this with the activated campaign.
8. If demonstrating Sputnik DAO funding, establish a separately funded DAO, a proposal with the proper full 3 NEAR PACT commitment, council approvals and the executed proposal receipt. Do not claim that a locally constructed proposal proves quorum or a successful transfer.
9. Independently verify every public testnet PACT method receipt through `/verify.html` or the CLI. Publish the explorer URLs and final reconciliation snapshots. Verify funding, governance, withdrawal and finality evidence **separately**.
10. Only after an unauthenticated walkthrough and safety review, promote the reviewed frontend. Preserve the existing cinematic homepage.

**Never sign with a production/mainnet wallet or publish private keys.** Never submit valuable funds: the callback non-execution and withdrawal recovery question remains a documented production blocker. Testnet execution must be explicitly authorized and can be skipped if no funded credentials are available; in that case, describe sandbox as sandbox.

## Judge path (offline plus testnet-ready flow)

- `/` — approved cinematic homepage, unchanged.
- `/console` — inspect the 12 vs. 13 NEAR case and simulate the missing 1 NEAR.
- `/create.html` — make a custom campaign, configure projects and supporters, export the exact offline allocation, or prepare an explicitly wallet-approved testnet deployment when credentials are authorized.
- `/campaign?contract=…&config=…` — inspect a deployed campaign's finalized testnet views, contribute, activate and settle through explicit wallet approval. The share configuration is public; it is not a fabricated live state.
- `/verify.html` — independently inspect a real public PACT testnet transaction **only when one exists**.

The custom planner's arbitrary campaigns are deployable only as a new immutable campaign account with explicit beneficiary and authority accounts. The deployment workflow is not proof that a campaign was signed or funded. The user-facing pages must continue to label local model results, candidate certificates and finalized onchain results differently.

## Release acceptance

- Browser and Node proof verification tests pass on the exact release SHA.
- One human who has never seen PACT can run the campaign builder and understand whether a plan is fundable without verbal instructions.
- The verification page remains readable at 320px and keyboard-accessible, and never returns a green result for mismatched receipts or code hash.
- Release routes are accessible without Vercel SSO or a private GitHub login.
- Repository visibility, hackathon X demo, payout account and submitted project information have been deliberately reviewed before final promotion.

If public testnet evidence remains unavailable, mark it **not completed**, and never stage, simulate or invent transaction hashes to satisfy this checklist.
