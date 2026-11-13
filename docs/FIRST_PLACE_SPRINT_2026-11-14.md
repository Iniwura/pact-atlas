# PACT Atlas | First-place sprint and independent-judge scorecard

**Baseline: 59/100. Required competitive target: at least 90/100.**

**Status:** Target is NOT achieved. Do not describe this build as 90/100, first-place-ready, or fully audited until a fresh independent-style review, against the actual public submission, supports that result. This is a score target, not a guaranteed contest outcome.

**Deadline:** 14 November 2026, 23:59 UTC. **One submission per team; cannot edit after sending.**

## Score from strict anonymous review (13–14 November)

These are internal judging estimates, not the hackathon's official rubric. Eight categories are scored out of 10 and normalized to 100.

| Dimension | Current (/10) | Audit evidence | Recovery goal |
| --- | ---: | --- | --- |
| Technical engineering | 8 | Rust/NEAR implementation and adversarial tests; not an independent audit | Preserve and prove reproducibly |
| Onchain evidence | 7.5 | Three CLI-signed faucet-funded testnet campaigns; no authentic browser wallet lifecycle | Clear, independently checkable public flow |
| Originality | 7.5 | Nontrivial conditional coalition funding | Demonstrate the distinctive outcome, not only discuss it |
| Social Money track fit | 6 | Shared funding concept; public Sputnik integration not proven, Trezu not demonstrated | Show why it is a community treasury workflow |
| Visual design | 5 | Orbital brand and editorial composition exist; insufficient cinematic wow or reference-level polish | A coherent, memorable art-directed site |
| User experience | 5.5 | Works in automated tests; too much explanation and fragmented app experiences | Three unmistakable actions: fund / create / verify |
| Security and reliability | 4.5 | P0 missing-withdrawal-callback recovery; no independent audit | Honest testnet scope, verified fail-closed paths; never imply production-safe |
| Demo and submission | 3 | X post draft only; repository private; preview protected | Accessible public repo and demo, strong footage, valid submission |

Normalized baseline: (47 / 80) × 100 = **58.75 ≈ 59/100**.

**Accept/reject:** Reassess all eight categories with evidence. Require the normalized total to be **≥90/100**, plus the submission-critical gates below. If limitations prevent that score, report the actual number rather than adjusting it to the target.

## P0 — Eligibility before aesthetic perfection

- [ ] Final app URL works for anonymous judges without Vercel Authentication or SSO.
- [ ] Public GitHub repository with legible README, no secrets in commit history, actual matching commit, honest reproduction instructions. **Changing repository visibility requires explicit owner approval and an authorized action.**
- [ ] Public X post specifically says NEAR HACKATHON, tags `@NEARProtocol`, includes `#NEARHackathon`, and has real app **video or screenshots** and link to public code. No simulated signatures represented as real.
- [ ] Correct public project/repo/X links and a valid NEAR mainnet payout account ready for the official submission form.
- [ ] Submit once, with final owner approval, before 14 Nov 23:59 UTC. Do not risk deadline for a speculative design iteration.

## P1 — Winning design, informed by VERRIS and Lurais

**Finding:** Landing looks like a technically competent explainer, not a memorable premium product. Too many consecutive headings and descriptive sections; one orbital image is not enough. Console, creator, details and verifier lack a unified signature.

- [ ] Recompose the **hero** with one immediate sentence and a meaningful action, refined hierarchy, generous negative space, dramatic original visual art and polished purposeful motion. Do not replace it with generic stock or unrelated generated imagery.
- [ ] Build one **signature coalition interaction** around the ACTUAL Alpha/Beta testnet evidence: Beta depends on Alpha; pledges arrived out of order; contract accepted certificate; two payouts occurred. Animate the explanatory transition only, clearly labelled historical evidence, not live fictitious transfers.
- [ ] Remove repetitive landing exposition. The site's flow is: what happens → why it matters → inspect a real result → create your own → verify proof.
- [ ] Extend the same deliberate typography, transitions, depth, spacing and focus states across consumer routes. Retain top navigation; no sidebar.
- [ ] Review at 320, 390, 768, 1024 and 1440 px and with reduced motion. Pass Axe accessibility, avoid motion that obscures controls, and show no browser errors.
- [ ] Borrow **design principles and interactions** from https://verris.framer.website/ and https://lurais.framer.website/, not proprietary artwork, code or a generic template.

## P1 — Product confidence and track alignment

- [ ] A first-time visitor can answer immediately: **What does PACT do? Why are conditional funding agreements better than isolated fundraising? Who creates/funds/verifies?**
- [ ] A user can create a named campaign, enter beneficiaries and conditions, preview exact allocation and understand when actual signing is required.
- [ ] Genuine read-only receipts, immutable contract configuration and recorded outcomes can be reached without a wallet and without relying on a fake live feed.
- [ ] Do not conflate model-only +1 NEAR example with public testnet deposits.
- [ ] Strengthen the narrative that this is community treasury coordination; if public Sputnik governance cannot be demonstrated, say precisely what was sandbox-tested. Do not invent Trezu integration.
- [ ] Run the full product browser test suite and Node verification again on the exact last app commit. Retain separately dated historical Rust/sandbox evidence; do not claim reruns that did not happen.

## P0 safety constraints — never score through omission

- [ ] Explicitly disclose the unresolved missing withdrawal callback: a pending withdrawal can remain pending indefinitely. No mainnet or valuable funds.
- [ ] Disclose that real Meteor/Sender/Nightly extension signing is still unverified until a genuine finalized transaction is observed.
- [ ] Disclose lack of external security audit and lack of a completed public Sputnik DAO vote.
- [ ] Do not use a forced timeout, balance inference, or blind recredit to claim missing callback recovery. Genuine safety fix requires proving no double payout.
- [ ] If testnet RPC is unavailable, fail closed. Recorded historical receipts may be displayed but are not presented as freshly verified live state.

## Re-score protocol

1. Verify judge access to the **exact** release (Git SHA, Vercel SHA, public visibility and unprotected route).
2. Watch the actual finished demo and use the app as a novice, without reading the README.
3. Click the real Alpha/Beta chain records, review creation and verifier, confirm security limitation text.
4. Re-run browser, accessibility and relevant Node tests on the release SHA; separately record any live wallet evidence.
5. Re-score all eight categories without author bias. Log the exact result, weaknesses and evidence. **90/100 is the minimum aspirational competitive target, not an invented score.**

## Current product evidence

- [118-test QA audit](RELEASE_QA_2026-11-13.md): 58/58 Chrome, 60/60 Node.
- [Public testnet coalition](../evidence/pact-atlas-testnet-coalition-evidence-2026-11-10.json).
- [Activation and refund](../evidence/pact-atlas-testnet-evidence-2026-11-10.json).
- [Financial safety review](FINAL_HARDENING_REVIEW_2026-11-12.md).
- [Submission checklist](SUBMISSION_CHECKLIST_2026-11-10.md).

**No claims of win probability, production security or eligibility until the corresponding evidence is verified.**
