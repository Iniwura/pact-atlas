# PACT Atlas — historical internal release self-review

> Historical internal assessment, not an independent third-party audit.

**Audit date:** 14 November 2026  
**Review scope:** public NEAR testnet product, Rust/Wasm provenance, browser workflow and shared wallet UI, repository hygiene, judge-ready reproduction.  
**Candidate branch:** `release/final-wallet-ux-audit-20261114`  
**Track:** Social Money (`social`).

## Verdict

**Strong testnet hackathon entry, not a production-grade financial protocol.** The build offers a distinctive dependency-aware community-funding mechanism, unusually concrete public testnet evidence, a usable end-user console and a reproducible technical story. The remaining callback non-execution risk is a **high-severity unresolved liveness issue**; a real browser-signed contract transaction has not been observed. This cannot be scored as a fully production-ready platform or a proven first-place winner.

**Independent build-only score: 84/100.** This is an editorial assessment against reasonable hackathon engineering criteria, **not an official NEAR judge score or probability of winning**.

| Area | Score | Evidence and reason for deductions |
| --- | ---: | --- |
| Problem and differentiated mechanism | **14/15** | Conditions, one-use pledge allocation, inter-project dependencies; related mechanisms exist, so novelty is incremental but executable |
| NEAR integration and functional depth | **18/20** | Deployed NEAR Rust/Wasm, 3 actual CLI-signed testnet lifecycles, strict contract validation; no authenticated browser-signed funding transaction |
| Product and UI/UX | **19/20** | Locked editorial interface, public directory, blank creator, verifier, guide, cross-route wallet, dismissible notices; mobile header remains compact |
| Testing and reproducibility | **18/20** | 121 browser checks, 109 Node checks, pinned public receipts and Wasm/ABI; Rust/sandbox not freshly rebuilt in this final sandbox |
| Security, correctness and scope | **7/15** | Fail-closed finality, credit accounting and immutable config; **missing withdrawal callback recovery** risks permanently pending claims, no independent external audit |
| Submission documentation | **8/10** | Focused README and public verification steps; fresh public RPC verification unavailable at audit time and final external demo still outstanding |
| **Total** | **84/100** | Build is ready for a **testnet-only** hackathon demonstration, not real-money funding |

## Tests executed independently on the final UX branch

- **121/121** Chromium browser checks, zero retries. Full suite includes the original 118 scenarios plus 3 new route-spanning wallet and tour/notification cases.
- **109/109** Node tests across eight scripts: model 38, benchmark 9, counterfactual 23, workflow 8, chain 9, proof 7, wallet-adapter 9, NEAR Connect selector 6.
- **3/3** targeted cross-route browser tests: connected-account rehydration on different pages; real SDK disconnect clearing selected wallet; rejecting a stale local wallet key; visible guided walkthrough and dismissible status notices.
- **20 route/viewport inspections:** console, create, verifier and fail-closed campaign reader at 320, 390, 768, 1024 and 1440 px. No horizontal overflow and no browser page error; wallet button and guide remained reachable.
- The tracked-file hygiene scan found **zero matching signatures** for PEM private keys, AWS access-key patterns, common GitHub tokens and obvious embedded secret assignments. No tracked `.env`, `node_modules`, `outputs`, `test-results`, or log files. MIT LICENSE exists. This bounded scan is not a full credential-history audit.
- Full dependency reinstall with `npm ci` completed. `package.json` and lockfile agree on the cleaned public package name.

**Not freshly executed** in this audit: Rust 1.93 compilation, full NEAR sandbox test matrix, authentic third-party extension-signing transaction or independent smart-contract audit. Historical Rust/sandbox and public testnet records remain linked.

## Public-chain evidence

Three independent campaigns on NEAR testnet were executed with disposable CLI signers on 10 November 2026:

1. Single Alpha campaign: commitment, activation and 1 NEAR beneficiary withdrawal.
2. Expired campaign: commitment, expiry and 1 NEAR contributor refund.
3. Two-project dependency coalition: conditional Beta contribution first, independent Alpha contribution second, accepted allocation certificate, two finalized beneficiary withdrawals and zero reported final liabilities.

Full contract IDs, transaction hashes, pinned code hash, mutable/finalized views and account balances are in the two `evidence/pact-atlas-testnet-*.json` files. The recorded receipt verifier checked 20 deployment/lifecycle transactions against official RPC at capture time, and the public records are not simulated browser transfers.

**Final-day archival verification restored:** the first fresh read using a regular testnet RPC returned **NOT VERIFIED** because it could not fetch this four-day-old receipt. The verifier was corrected to query NEAR testnet **archival** RPCs, with an independent archival fallback. Re-running `npm run verify:testnet -- coalition-20261110.beneficiary-20261110.testnet refund-supporter-20261110.testnet 39QG8aueJBWZEcJYHZtVorjbyc9WJiJ1u9gdz9WjuDKN commit` on 14 November returned **VERIFIED NEAR TESTNET PACT EXECUTION**: status `FINAL`, two successful receipts, verified signer/target/method and expected current Wasm code hash `7CEBKra569k7TYyxoWSoXwVak83uXCmkDqgHJNvkxUEp`. No transaction was sent; this is a read-only verification. Both archival endpoints were separately tested for historical transaction retrieval. A further bounded read-only run reverified **all 11 published PACT method calls** across the three testnet campaigns: five coalition calls, three single-project calls and three expired/refund calls, with matching signer, destination, method, `FINAL` receipt outcomes and the pinned current code hash. The app must still fail closed when both archival hosts are unavailable.

## User experience corrections included

- Shared NEAR Connect selected account is restored from the SDK's real account state across the workspace, creator, campaign reader and verifier. A bare localStorage wallet ID never produces a claimed connected identity.
- The same visible **Connect wallet** / account label and **Disconnect** controls are available on every application route. Disconnect calls the actual connector and clears the selected wallet.
- A visible **Guide** entry opens the existing premium four-step product walkthrough; other routes link to `/console?tour=1`.
- Bounded, dismissible, accessible success/warning/error notifications with preserved fail-closed inline states; transaction finality is never inferred from a popup.
- Locked landing, visual art direction, contracts, Wasm and historical receipts unchanged.

## Release blockers and exact truth boundaries

| Finding | Severity | Resolution for hackathon |
| --- | --- | --- |
| Missing withdrawal callback can strand a pending credit indefinitely | **High** | Mainnet, production deposits and valuable-fund usage strictly **NO-GO**. Preserve fail-closed pending and disclose the issue |
| No independently verified browser-signed `commit`/withdrawal | **Medium for demo** | Label the three public testnet transactions **CLI-signed**, show the human-confirmed Meteor account connection separately, never pretend a wallet approval occurred |
| No public SputnikDAO multi-member governance vote | **Medium for claims** | Describe the DAO proposal path as **sandbox-tested only** |
| Historical receipt lookup | **Resolved for live read** | FastNEAR archival plus NEAR official archival fallback verified the actual Nov 10 Beta commitment on Nov 14; unknown results still fail closed |
| No qualified external audit / latest Rust matrix rebuild | **Medium** | Explain scope and preserved reproducibility; do not describe the protocol as audited |
| Vercel daily deployment limit | **Resolved for release** | The public alias `pact-atlas-near-connect.vercel.app` was reassigned to READY deployment `dpl_HL7apyxaCrXeb4TvNthxVypiMe8F`, runtime source SHA `a8a6405` (with archival proof verification). All 13 final UI file blob hashes match merged `main`; later source changes are docs-only. Public 200/asset checks and live mobile/desktop Chrome smoke tests passed. |
| Public X demo and submission form | **Submission gate** | Human publishes real footage/screenshots and provides a public X post; user must confirm exact one-time submission payload |

## Hackathon eligibility

The official `HACKATHON.md` says testnet-only projects may compete; use of Intents/Trezu/Sputnik is a hint, not mandatory. `social` (Social Money) is the appropriate category. Repository public visibility and MIT license are confirmed. The human must publish an X post with actual media, `@NEARProtocol`, `#NEARHackathon` and submit one application before **2026-11-14 23:59 UTC**. A mainnet NEAR payout account, lead name, email, team size, post URL, and explicit consent/approval are required; they must not be invented or sent automatically.

## Independent judge's decision

**Recommended: submit as an experimental testnet contender.** It demonstrates a real end-to-end onchain funding mechanism, contract rules and independently inspectable receipts rather than an empty prototype. The strongest demonstration is a single Beta-before-Alpha contribution story ending with both beneficiary withdrawals, plus an expired refund and blank campaign creator.

**Do not claim first place is assured.** A judge could deduct heavily for callback-liveness risk, missing production readiness, absence of a newly browser-signed contract action and unproven live DAO governance. A compelling authentic screen-recorded demo and transparent explanation can improve the presentation, but cannot erase those technical limitations.

### Final public release confirmation

The tested feature branch was merged to `main` in [PR #26](https://github.com/Iniwura/pact-atlas/pull/26), source release commit `f6889e3607eb5808368f4e071867bd317992f104`. The public judge alias now serves READY Vercel deployment `dpl_HL7apyxaCrXeb4TvNthxVypiMe8F`, whose UI files are byte-for-byte identical to source `main` across all 13 modified application files. An anonymous HTTP inspection returned 200 for the homepage, console, creator, campaign reader, verifier, wallet shell, notification center, CSS and tour script. Chrome smoke checks of live console, creator and verifier at 390px and 1440px found zero horizontal overflow and no page errors. Deployment is **preview target**, anonymously accessible; it is not a paid production build or audited finance deployment.
\n### Final deployed archival verifier smoke test\n\nAfter switching the anonymous judge alias to Vercel deployment `dpl_HL7apyxaCrXeb4TvNthxVypiMe8F`, the public homepage, console, verifier page and archival-proof module each returned HTTP 200. A same-origin POST to `https://pact-atlas-near-connect.vercel.app/api/verify-testnet` with the saved November Beta commitment returned **HTTP 200**, `verified: true`, `final_execution_status` verified through the underlying read, `receiptCount: 2` and matching PACT code hash. The deployment is thus not only locally tested: the public verifier actually returned authentic finalized testnet proof on 14 November. Original production-safety limitations remain unchanged.\n