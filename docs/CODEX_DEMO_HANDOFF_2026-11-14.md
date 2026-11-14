# PACT Atlas — Codex demo handoff (release candidate)

**Purpose:** Capture a truthful, compelling NEAR HACKATHON Social Money product walkthrough. The owner wants an exceptional high-definition demo built by Codex. This file is instructions, **not a request to publish**.

## Immutable guardrails

- Use the **actual publicly accessible final release**. Before capture, verify the source SHA, `/console`, `/create.html`, `/verify.html`, the shared wallet header, **Guide**, notifications and **Disconnect**. **Verified judge URL:** `https://pact-atlas-near-connect.vercel.app/` is now assigned to Vercel deployment `dpl_CC3xZZ1eTcQuCb2zSjN8C4GENWuZ` (UI-code SHA `ddadcd3`, byte-matching merged `main`). This alias passed anonymous HTTP and real-browser desktop/mobile smoke checks on 14 November. Capture this URL, not the older `pact-atlas.vercel.app` domain.
- Do not fabricate wallet signing, transfers, browser receipts, connected accounts, transaction details or Vercel performance measurements. Show genuine NEAR testnet transactions already recorded.
- The owner confirmed real Meteor connection to `iniwura.testnet`. This is **connected wallet**, not a signed contract call. The real 10 November onchain campaigns were signed using disposable **CLI signers**, not Meteor.
- No mainnet deposits, valuable tokens, private keys, seed phrases or transaction approvals without a separate explicit owner authorization. The new guided tour is optional and must never simulate funds.
- Avoid a wall of technical copy. Use the locked cinematic UI and only necessary text. Show what a judge can reproduce in the public app.

## Suggested 75–95-second 1080p walkthrough

| Time | Actual screen and action | Narration purpose |
| --- | --- | --- |
| 0–10 s | Cinematic PACT Atlas homepage, then **Open App** | “Funding a community project is easy. Funding two projects that depend on each other is much harder.” |
| 10–22 s | Console **Campaigns**, select the Alpha/Beta conditional coalition | “Beta only happens if Alpha succeeds. PACT reads the whole agreement instead of counting each target twice.” |
| 22–38 s | Expand actual two-project configuration and show first Beta, then Alpha proof | “The restricted Beta contribution arrived first; Alpha followed. Both commitments were real NEAR testnet transactions.” |
| 38–56 s | **Activity** shows accepted activation certificate and both actual beneficiary withdrawals; click explorer receipts | “The onchain contract accepted one precise allocation certificate, paid both beneficiaries and closed the recorded liabilities.” |
| 56–68 s | Show **Expired** campaign and actual contributor refund | “When an agreement expires, contributors recover their claimable deposits.” |
| 68–84 s | **Create** blank agreement, edit project dependencies, preview an exact plan; optional **Guide** | “Anyone can compose an agreement, inspect its conditions and prepare an explicit wallet-approved testnet deployment. A plan is not a transfer.” |
| 84–95 s | Show **Verify** example and read-only result if RPC available, then GitHub link; end on product | “Anyone can inspect the original testnet receipts. This release is testnet-only, and the source is public.” |

**If verifier RPC is unavailable:** show the original explorer link and tell the viewer the live check is currently unavailable; never screenshot an unknown result as green. If full capture would run long, cut exposition, not the complete onchain story.

## Capture quality

Desktop widescreen at 1920x1080, Chrome browser zoom 100%, cursor smooth, no cluttered tabs, no input placeholders or private extension windows. Move deliberately, give the actual receipt enough time to be read, and use clear, calm, human-sounding voiceover. Avoid overlaid fake app screens or fake confirmation banners. Keep legibility at mobile X video size.

## Public proof to feature

- Contract: https://testnet.nearblocks.io/address/coalition-20261110.beneficiary-20261110.testnet
- Beta first: https://testnet.nearblocks.io/txns/39QG8aueJBWZEcJYHZtVorjbyc9WJiJ1u9gdz9WjuDKN
- Alpha second: https://testnet.nearblocks.io/txns/8t22n71EQDb5WCswgLu7MUH3aVeyoFaCVdKgtQBUVje3
- Activation: https://testnet.nearblocks.io/txns/31FxH2YE9FEm7iq49AH6eXMvZYiFv7Y3jeqd8rThK96v
- Payout A: https://testnet.nearblocks.io/txns/BF7DB9Ap711cXLfnQnUweN1Q6LgUkUGmbFP3HfcxEkex
- Payout B: https://testnet.nearblocks.io/txns/GuUpGeBNaygqoaepXPrmxbWgEzexoXgyxxFDZ617E9FX
- Separate refund: https://testnet.nearblocks.io/txns/C4yMtrjmWoBRmRutTWfdCLEeY3XDrct8ydCx2ZBtTzvT

## Ready-to-edit X post (owner posts; do not auto-publish)

> Two community projects. One conditional funding agreement.
>
> Built PACT Atlas at NEAR HACKATHON: onchain NEAR funding that respects supporter restrictions and project dependencies, without counting the same pledge twice.
>
> See real testnet contributions, activation, two payouts and a completed refund.
>
> https://pact-atlas-near-connect.vercel.app/
>
> @NEARProtocol #NEARHackathon

**Attach** the actual narrated demo or genuine product screenshots. The final public X-post URL is required by the hackathon form. Do not assert third-party audit, production safety or genuine browser-signed funding if unavailable. One project, one submission; user approves the exact payload before POST.
