# PACT Atlas — cinematic product sprint verification

**Date:** 14 November 2026. **Release branch:** `release/rc1-main-integration`. **Release is not approved for publication or submission.**

## What was built

The previous independent judge review scored PACT Atlas **59/100**, with visual presentation, user comprehension and release eligibility as its largest deficits. The competitive target remains **at least 90/100**, but this report does **not** assert that target was achieved.

This sprint implemented a substantial, original editorial interface inspired by the **layout systems and typographic discipline** of VERRIS and Lurais. No third-party imagery, icons, proprietary design files, or source code were copied.

1. **Cinematic landing composition.** Reused the original approved orbital illustration as a standalone SVG, with a spatially framed hero, refined navigation, larger type, intentional layering, copper lighting, restrained entrances and an immediate real-campaign route. The primary action stays inside the initial viewport, including short laptop heights.
2. **Real Alpha/Beta proof theatre.** A novel interactive section presents three recorded NEAR testnet milestones: Beta's conditional pledge arriving before Alpha; immutable-condition approval of an allocation certificate; and two beneficiary withdrawals with zero recorded final liabilities. Each stage links directly to an individual **original public transaction receipt**. This is a historical narrative, never a fake live payment or wallet signing.
3. **Consumer workspace refinement.** More distinctive hierarchy, larger editorial headings, consistent spatial rhythms, a restrained original orbital watermark and a better signature feature panel. The real campaign directory remains the first primary content section. A direct link takes visitors from the console to the real historical story.
4. **Accessibility and performance-safe motion.** Focusable step buttons, dynamic status announcement, clear link provenance, reduced-motion support, CSS-only visual transitions and zero external imagery dependencies.

## Executed checks

The source and tests were synchronized from the actual release branch into an isolated Vercel Sandbox test environment running **Google Chrome 157, Playwright 1.56.1 and Node.js 24**.

| Verification | Result |
| --- | --- |
| Chrome across landing, real story, console, creator, campaign, verifier | **73 / 73 passed** |
| Node model, wallet adapter, finalized verification, safety/reference checks | **60 / 60 passed** |
| Both suites combined | **133 / 133 passed** |

Playwright used **zero retries**, two workers, browser accessibility audits, mobile widths down to **320px**, and layout collision assertions including **960×680** and **1366×768** laptop viewports. The tests also exercise the original model and verify external URLs used in the real testnet story.

### Errors found and fixed in QA

- Original large hero text overlapped its call to action on shorter desktop viewports. Adjusted hero minimum height and heading placement, then added regression assertions for no collisions, including overline and quote.
- On small phone widths, the editorial quote intersected the hero overline. Shifted the quote and verified the layout.
- The newly darkened verification callout inherited dark text. Repaired WCAG AA contrast and reran the browser audit.
- Two early isolated-QA failures were fixture omissions, not release-source failures: an omitted campaign-solver import and an omitted campaign-detail HTML route. After reconstructing the genuine GitHub files, all Chrome checks passed.
- One early Node run lacked the `api/verify-testnet.mjs` fixture; after restoring it from GitHub, all 60 Node tests passed.

## What this does **not** establish

- It does **not** establish authentic browser-wallet extension signing or a user-funded end-to-end live campaign lifecycle.
- It does **not** establish safe recovery after a missing NEAR native-transfer callback. That remains the **P0 production blocker**. Valuable funds and mainnet use are **NO-GO**.
- It does **not** establish public Sputnik DAO voting/quorum execution; prior Sputnik evidence is sandbox-only.
- It does **not** constitute a new Rust/Wasm rebuild, fresh NEAR sandbox lifecycle, independently qualified security audit, or third-party judge review.
- It does **not** mean the **90/100 competitive target** is objectively achieved. A fresh anonymous-style, visual and track-alignment review is still needed.
- It does **not** mean the private GitHub repository, protected Vercel preview and unposted X demo satisfy submission requirements.

## Required publication gates — prioritized by deadline

1. Ensure final repo is public and credential-safe, and its README links to verifiable `evidence/` manifests.
2. Ensure a public website can be loaded by an anonymous judge (not Vercel Authentication-only).
3. Publish a real product walkthrough or real screenshots on X with **NEAR HACKATHON**, **@NEARProtocol** and **#NEARHackathon**, using accurate historic receipts and scope.
4. Supply a valid NEAR mainnet account for prize payout and submit the public repo/X URLs via the official form before **14 November 2026 at 23:59 UTC**. Owner approval is required before publication and final submission.

## Proven public-chain records

- [Coalition contract](https://testnet.nearblocks.io/address/coalition-20261110.beneficiary-20261110.testnet)
- [Beta pledge (first)](https://testnet.nearblocks.io/txns/39QG8aueJBWZEcJYHZtVorjbyc9WJiJ1u9gdz9WjuDKN)
- [Accepted activation](https://testnet.nearblocks.io/txns/31FxH2YE9FEm7iq49AH6eXMvZYiFv7Y3jeqd8rThK96v)
- [Final withdrawal](https://testnet.nearblocks.io/txns/GuUpGeBNaygqoaepXPrmxbWgEzexoXgyxxFDZ617E9FX)
- [Coalition manifest](../evidence/pact-atlas-testnet-coalition-evidence-2026-11-10.json)
- [Independent judge sprint scorecard](FIRST_PLACE_SPRINT_2026-11-14.md)
- [Original P0 safety review](FINAL_HARDENING_REVIEW_2026-11-12.md)

**Decision:** The art-directed testnet UI passes current automated product gates. Preserve exact code and evidence, do not invent completed wallet or financial guarantees, and prioritize legitimate judge access and timely submission.
