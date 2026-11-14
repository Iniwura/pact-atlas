# PACT Atlas | submission checklist

**Competitive target: ≥90/100, NOT YET ACHIEVED.** Preserve the [independent-judge baseline (59/100) and all remediation gates](FIRST_PLACE_SPRINT_2026-11-14.md). Re-score only from release evidence, never from intention.

**Latest recorded UI QA (14 Nov 2026): 116/116 Chromium tests with zero retries and 16/16 focused wallet Node tests** on the testnet-only preview, documented in [PR #21](https://github.com/Iniwura/pact-atlas/pull/21). The prior 13 Nov checkpoint passed 58/58 Chrome and 60/60 Node checks ([scope](RELEASE_QA_2026-11-13.md)). Real external-wallet signing, missing withdrawal callback recovery and independent Rust/sandbox reruns remain separate gates.


## Verified before submission

- [x] Rust, Wasm, ABI and artifact hashes match the checked-in manifest.
- [x] The current release passed 58 Chrome product checks and 60 Node safety/model tests in an isolated sandbox; previous Rust, Wasm and NEAR sandbox results are separately recorded and were not rerun in this latest UI pass.
- [x] Genuine NEAR sandbox scenarios cover accounting, concurrent deposits, expiry, capacity, Sputnik and atomic deployment.
- [x] Three faucet-funded public testnet campaigns are recorded: activation/withdrawal, expiry/refund, and a two-project dependency coalition.
- [x] Coalition evidence includes finalized receipts, canonical pledge records, accepted certificate, code hash and final zero-liability reconciliation.
- [x] README, testnet proof, security review, campaign lab and evidence index distinguish sandbox, CLI testnet and browser-wallet evidence.
- [x] Repository history and tracked files were scanned for private-key material and common credential patterns.
- [x] The repository is now **public**, and the latest anonymously accessible UI preview at [pact-atlas-consistency.vercel.app](https://pact-atlas-consistency.vercel.app/) matches tested UI commit `d01892c`. No mainnet call or valuable-fund spend was claimed. A consolidated release into `main` is still a [draft PR #22](https://github.com/Iniwura/pact-atlas/pull/22).

## Required before public release

- [ ] Confirm that judges can reach the final hosted website without Vercel Authentication and that the public repo has no secrets in its history.
- [ ] Publish a public X demo post using real app/receipts (video **or screenshots**); tag `@NEARProtocol` and `#NEARHackathon` and explain testnet limitations truthfully.
- [ ] Supply a valid mainnet NEAR account for any prize payout, and submit both public links through the official form before **14 Nov 2026, 23:59 UTC**.

- [x] Public repository visibility is confirmed. **Pending:** the default `main` is older than the tested preview; release PR #22 needs visual sign-off and merge.
- [x] The latest UI has a READY Vercel deployment and an anonymously accessible review alias with exact tested UI SHA. **Pending:** approve the final judge-facing production URL and align it with the reviewed source.
- [ ] Complete a genuine Meteor Wallet browser signing run with isolated faucet identities, or label that path as unverified in the final submission.
- [ ] Complete a public Sputnik multi-member governance run, or keep governance claims limited to sandbox evidence.
- [ ] Decide whether an independent qualified auditor will review the contract; do not call this code externally audited without that review.
- [ ] Resolve or explicitly accept the missing-callback production blocker only after a design that cannot double-pay is proven.
- [ ] Do not claim native transfer failure injection until a genuine failing predecessor is safely reproduced.
- [ ] Obtain final approval before merging consolidated PR #22, promoting the latest release, posting on X, or submitting the hackathon entry.

## Submission facts

- Track: **Social Money**.
- Deadline supplied for this project: **14 November 2026, 23:59 UTC**.
- Spend: **$0** in this release pass; testnet evidence uses faucet funds only.
- Production posture: **not production-safe or externally audited**.
