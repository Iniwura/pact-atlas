# PACT Atlas | submission checklist

**Competitive target: ≥90/100, NOT YET ACHIEVED.** Preserve the [independent-judge baseline (59/100) and all remediation gates](FIRST_PLACE_SPRINT_2026-11-14.md). Re-score only from release evidence, never from intention.

**Latest executed QA (13 Nov 2026): 58/58 Chrome product tests and 60/60 Node safety/model tests passed.** See [the reproducible scope and limitations](RELEASE_QA_2026-11-13.md). Real wallet signing, withdrawal callback recovery and independent Rust/sandbox reruns are separate gates. The current browser-tested release is still testnet-only.


## Verified before submission

- [x] Rust, Wasm, ABI and artifact hashes match the checked-in manifest.
- [x] The current release passed 58 Chrome product checks and 60 Node safety/model tests in an isolated sandbox; previous Rust, Wasm and NEAR sandbox results are separately recorded and were not rerun in this latest UI pass.
- [x] Genuine NEAR sandbox scenarios cover accounting, concurrent deposits, expiry, capacity, Sputnik and atomic deployment.
- [x] Three faucet-funded public testnet campaigns are recorded: activation/withdrawal, expiry/refund, and a two-project dependency coalition.
- [x] Coalition evidence includes finalized receipts, canonical pledge records, accepted certificate, code hash and final zero-liability reconciliation.
- [x] README, testnet proof, security review, campaign lab and evidence index distinguish sandbox, CLI testnet and browser-wallet evidence.
- [x] Repository history and tracked files were scanned for private-key material and common credential patterns.
- [x] PR #12 remains draft and unmerged; no mainnet call, real-fund spend, public repository change or paid CI change was made.

## Required before public release

- [ ] Confirm that judges can reach the final hosted website without Vercel Authentication and that the public repo has no secrets in its history.
- [ ] Publish a public X demo post using real app/receipts (video **or screenshots**); tag `@NEARProtocol` and `#NEARHackathon` and explain testnet limitations truthfully.
- [ ] Supply a valid mainnet NEAR account for any prize payout, and submit both public links through the official form before **14 Nov 2026, 23:59 UTC**.

- [ ] Obtain explicit authorization to make the repository public or publish a release mirror.
- [ ] The current design has a READY protected Vercel preview; confirm an exact release SHA and obtain explicit authorization before changing access protection for a judge-accessible URL.
- [ ] Complete a genuine Meteor Wallet browser signing run with isolated faucet identities, or label that path as unverified in the final submission.
- [ ] Complete a public Sputnik multi-member governance run, or keep governance claims limited to sandbox evidence.
- [ ] Decide whether an independent qualified auditor will review the contract; do not call this code externally audited without that review.
- [ ] Resolve or explicitly accept the missing-callback production blocker only after a design that cannot double-pay is proven.
- [ ] Do not claim native transfer failure injection until a genuine failing predecessor is safely reproduced.
- [ ] Obtain final approval before merging PR #12, publishing the repository, posting on X, or submitting the hackathon entry.

## Submission facts

- Track: **Social Money**.
- Deadline supplied for this project: **14 November 2026, 23:59 UTC**.
- Spend: **$0** in this release pass; testnet evidence uses faucet funds only.
- Production posture: **not production-safe or externally audited**.
