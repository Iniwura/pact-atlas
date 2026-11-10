# PACT Atlas | submission checklist

## Verified before submission

- [x] Rust, Wasm, ABI and artifact hashes match the checked-in manifest.
- [x] Reference, benchmark, counterfactual, workflow, chain, proof, wallet and browser suites pass locally.
- [x] Genuine NEAR sandbox scenarios cover accounting, concurrent deposits, expiry, capacity, Sputnik and atomic deployment.
- [x] Three faucet-funded public testnet campaigns are recorded: activation/withdrawal, expiry/refund, and a two-project dependency coalition.
- [x] Coalition evidence includes finalized receipts, canonical pledge records, accepted certificate, code hash and final zero-liability reconciliation.
- [x] README, testnet proof, security review, campaign lab and evidence index distinguish sandbox, CLI testnet and browser-wallet evidence.
- [x] Repository history and tracked files were scanned for private-key material and common credential patterns.
- [x] PR #11 remains draft; no merge, mainnet call, real-fund spend, public repository change or paid CI change was made.

## Required before public release

- [ ] Obtain explicit authorization to make the repository public or publish a release mirror.
- [ ] If desired, redeploy the current commit as a protected Vercel preview and obtain explicit authorization before changing access protection for a public read-only URL.
- [ ] Complete a genuine Meteor Wallet browser signing run with isolated faucet identities, or label that path as unverified in the final submission.
- [ ] Complete a public Sputnik multi-member governance run, or keep governance claims limited to sandbox evidence.
- [ ] Decide whether an independent qualified auditor will review the contract; do not call this code externally audited without that review.
- [ ] Resolve or explicitly accept the missing-callback production blocker only after a design that cannot double-pay is proven.
- [ ] Do not claim native transfer failure injection until a genuine failing predecessor is safely reproduced.
- [ ] Obtain final approval before merging PR #11, publishing the repository, posting on X, or submitting the hackathon entry.

## Submission facts

- Track: **Social Money**.
- Deadline supplied for this project: **14 November 2026, 23:59 UTC**.
- Spend: **$0** in this release pass; testnet evidence uses faucet funds only.
- Production posture: **not production-safe or externally audited**.
