# PACT Atlas

**Conditional community funding, enforced on NEAR.** A project can be funded only when the whole group's commitments, eligibility rules, and project dependencies form one valid allocation. No pledge can be counted twice.

**NEAR HACKATHON 2026 · Social Money · Testnet-only release**

[**Open live app**](https://pact-atlas-near-connect.vercel.app/) · [**Campaign workspace**](https://pact-atlas-near-connect.vercel.app/console) · [**Create a campaign**](https://pact-atlas-near-connect.vercel.app/create.html) · [**Verify a receipt**](https://pact-atlas-near-connect.vercel.app/verify.html)

> **Safety and scope.** This is an experimental, faucet-funded NEAR **testnet** product, not a mainnet financial service or audited vault. Real public-chain campaign and refund transactions exist; those historic transactions were **CLI-signed**. A real user has confirmed connecting a Meteor testnet account through NEAR Connect, but a **browser-signed contract transaction is not yet independently verified**. Missing withdrawal-callback execution can strand a pending claim. Never deposit valuable funds.

## What problem does this solve?

Ordinary crowdfunding shows whether each target independently met its goal. But real community initiatives depend on one another. A supporter might fund **Beta only if Alpha is funded too**; another supporter might fund either one, but cannot have the same NEAR spent twice.

PACT Atlas lets organizers specify those conditions before anyone sends funds. The bounded solver finds an exact one-use allocation; the deployed Rust smart contract **independently validates** the signed commitments and proposed allocation certificate before activation. Otherwise, contributors can reclaim credits after expiry. See the [mechanism and precise baseline comparison](docs/COMPETITIVE_ADVANTAGE.md).

## See the actual product in five steps

No wallet is needed for the following walkthrough.

| Step | Do this | What you should see |
| --- | --- | --- |
| 1 | [Open the workspace](https://pact-atlas-near-connect.vercel.app/console) and select **Guide** | A four-step task-focused walkthrough of real agreements and proof |
| 2 | Select **Campaigns**, then the two-project coalition | Alpha and Beta, with Beta depending on Alpha, and the immutable public campaign configuration |
| 3 | Open **Activity** | Original testnet contribution, activation, payout, expiry and refund receipts; each has a public explorer link |
| 4 | Open [**Create**](https://pact-atlas-near-connect.vercel.app/create.html), add projects and supporters, and preview the plan | A blank editable agreement, dependency checks and an exported allocation; **the preview is not a transaction** |
| 5 | Open [**Verify**](https://pact-atlas-near-connect.vercel.app/verify.html), load the recorded example, then verify | A read-only check of the method, signer, final receipts and current contract code hash; unknown RPC results are **never** shown as success |

You can also choose **Connect wallet** with a supported NEAR testnet wallet. The modern NEAR Connect selector reads the account before any transaction; it does **not** request a 0.25 NEAR function-call allowance during initial connection. The account and a visible **Disconnect** action are shared across the workspace, creator, campaign reader and verifier. Any later state-changing request requires separate wallet approval and actual testnet gas. A successful *connection* is not proof that a contract call has been signed.

## Genuine NEAR testnet evidence · 10 November 2026

Three distinct public testnet campaigns were deployed and completed by disposable CLI signers using free faucet NEAR. Every step generated an authentic transaction hash and recorded finalized receipts. This is separate from the browser simulator and from the new wallet connector.

| Recorded action | Public evidence |
| --- | --- |
| Conditional Beta commitment (arrived first) | [NEAR testnet transaction](https://testnet.nearblocks.io/txns/39QG8aueJBWZEcJYHZtVorjbyc9WJiJ1u9gdz9WjuDKN) |
| Alpha commitment (arrived second) | [NEAR testnet transaction](https://testnet.nearblocks.io/txns/8t22n71EQDb5WCswgLu7MUH3aVeyoFaCVdKgtQBUVje3) |
| Contract accepts the one-use allocation certificate | [Activation receipt](https://testnet.nearblocks.io/txns/31FxH2YE9FEm7iq49AH6eXMvZYiFv7Y3jeqd8rThK96v) |
| Alpha and Beta beneficiaries withdraw | [Alpha payout](https://testnet.nearblocks.io/txns/BF7DB9Ap711cXLfnQnUweN1Q6LgUkUGmbFP3HfcxEkex) · [Beta payout](https://testnet.nearblocks.io/txns/GuUpGeBNaygqoaepXPrmxbWgEzexoXgyxxFDZ617E9FX) |
| Separate expired campaign refunds its contributor | [Refund receipt](https://testnet.nearblocks.io/txns/C4yMtrjmWoBRmRutTWfdCLEeY3XDrct8ydCx2ZBtTzvT) |

**Final recorded outcome:** the coalition activated two funded projects and settled both claims; the expired campaign returned its 1 testnet NEAR pledge. The recorded final accounting for each completed campaign showed **zero liabilities** and `solvent: true`. These are historical checks, not a promise of current RPC availability or production solvency.

Evidence is retained in [coalition transactions, configuration and balances](evidence/pact-atlas-testnet-coalition-evidence-2026-11-10.json) and [activation/refund lifecycle](evidence/pact-atlas-testnet-evidence-2026-11-10.json). The pinned Wasm SHA-256 is `5c06693028cc4b74527e6cf9fee5929a516c1644cc74f8136d5d53215eacfc15`. The [verification guide](docs/TESTNET_PROOF.md) explains exactly which assertions are established.

## Run it yourself

Requires **Node.js 22.22.2 or later**, npm and Chromium for browser tests.

```sh
git clone https://github.com/Iniwura/pact-atlas.git
cd pact-atlas
npm ci
npm run preview
```

Open `http://127.0.0.1:4173/console`. The public campaign index and local editor do not need private keys or testnet funds. Network-dependent verification fails closed if public RPC is unavailable.

```sh
# Model / allocation rules
npm test
npm run test:benchmark
npm run test:counterfactual

# Explicit onchain request builders, finality and verifier
npm run test:workflow
npm run test:chain
npm run test:proof
npm run test:wallet-adapter
npm run test:wallet-selector

# User journeys, responsive layouts, accessibility and error recovery
npm run test:browser
```

To verify one genuine transaction independently:

```sh
npm run verify:testnet -- \
  coalition-20261110.beneficiary-20261110.testnet \
  refund-supporter-20261110.testnet \
  39QG8aueJBWZEcJYHZtVorjbyc9WJiJ1u9gdz9WjuDKN commit
```

This uses **archival** NEAR testnet RPCs for historical receipts (FastNEAR, with an independent NEAR archival fallback), and checks finalized method execution plus the contract's **current** code hash, not the historical code hash at the transaction's block. The recorded Beta commitment was independently reverified successfully on 14 November; an unavailable RPC still fails closed. For contract reconstruction, Rust checks and fresh NEAR sandbox scenarios, follow [the hackathon reproduction guide](HACKATHON.md) and [security evidence](docs/SECURITY_REVIEW.md). Rust 1.93.0 and pinned cargo-near/optimized Wasm paths are required for byte-for-byte comparisons.

## Architecture and trust boundaries

| Component | Implementation |
| --- | --- |
| Funding constraints and exact bounded solver | [Reference model](reference/) and [browser campaign solver](web/campaign-solver.mjs) |
| Permissioned, immutable funding agreement | [Rust NEAR contract](contract/src/lib.rs), pinned [Wasm and ABI](evidence/) |
| Real contract deployment and transaction construction | [Request builders](web/campaign-chain.mjs) and [live campaign operations](web/campaign-live.mjs) |
| Read-only finalized chain verification | [RPC boundary](web/near-rpc.mjs), [verification API](api/verify-testnet.mjs) |
| Wallet account connection, separate signing | [NEAR Connect v0.12.0 host](web/wallet-selector-host.mjs), [transaction adapter](web/near-adapter.mjs), [shared wallet UI](web/wallet-shell.mjs) |
| Public product and first-visit guide | [Web application](web/) and [guided tour](web/first-visit.mjs) |

**Security properties validated within the tested scope:** explicit immutable project rules; distinct authorized activation; pledge conservation; exact allocation certificates; pull withdrawals and recorded refunds; fail-closed handling for unknown finality, RPC errors and mismatched configuration/code. A wallet hash alone is only a submitted transaction, not proof of settlement.

**Open risks:** a missing NEAR withdrawal callback can strand a liability; a real sandbox failing native transfer/callback was not reproduced; no public multi-member Sputnik governance vote or qualified third-party audit has been completed; browser-wallet signed transaction finality is not yet verified. No mainnet support or valuable deposits. See [the adversarial assessment](docs/WITHDRAWAL_REVIEW.md) and [full review](docs/SECURITY_REVIEW.md).

## NEAR HACKATHON submission

**Track:** `social` — Social Money. PACT applies collective funding conditions and verifies allocations on a NEAR smart contract. Sputnik DAO interactions were tested in a local sandbox; this public testnet demo does not claim live DAO governance. NEAR Intents, AI Cloud and other partner integrations are **not** required for this track.

This repository is a dedicated NEAR product developed in the event window. Historical engineering checkpoints and exact public-chain receipts are preserved for reviewer inspection. The [submission summary](docs/SUBMISSION_DESCRIPTION.md), [submission checklist](docs/SUBMISSION_CHECKLIST_2026-11-10.md), [independent 14 November audit (84/100 build score)](docs/FINAL_JUDGE_AUDIT_2026-11-14.md), and [Codex demo handoff](docs/CODEX_DEMO_HANDOFF_2026-11-14.md) are available. The official submission also requires a public X post with genuine product screenshots/video, `@NEARProtocol` and `#NEARHackathon`; that posting/submission step is separate from the code.

**License:** [MIT](LICENSE). **Production status:** Experimental, testnet-only.
