# PACT Atlas — judge walkthrough

**Start:** Open `/console`. This is an interactive example, not a real payment or a deployed campaign.

## 60-second walkthrough

1. **Read the question:** “Can we fund all four?” Five supporters have committed **12 NEAR**. Four community projects require **13 NEAR**.
2. **Look at the cards:** Training needs 4 NEAR, Internet 3, Equipment 3, and Events 3. A valid potential allocation covers the first three projects, but Events has only **2/3 NEAR**. The cards show possible coverage, not onchain payments.
3. **Click “Why can't we use the existing money?”** Supporter 01's 3 NEAR is permitted for either Training or Events. It cannot fund both. Independent eligibility sums can double-count flexible commitments; an exact allocation cannot.
4. **Click “Simulate +1 NEAR.”** This introduces a sixth *hypothetical* contribution allowed for Events only. The existing exact reference solver now finds a plan covering all four.
5. **Read “Where the money goes.”** The interface automatically exposes the real model allocation, without requiring a second page or a hidden developer inspector.
6. **Click “Reset example.”** The hypothetical contribution disappears. Nothing is signed or moved.

## Model-generated allocation for the successful example

| Project | Requirement | Allocation |
| --- | ---: | --- |
| Training | 4 NEAR | Supporter 01 (3) + Supporter 02 (1) |
| Internet | 3 NEAR | Supporter 03 (3) |
| Equipment | 3 NEAR | Supporter 04 (3) |
| Events | 3 NEAR | Supporter 05 (2) + simulated contribution (1) |

All 13 NEAR are allocated exactly once. The local witness validates destination permissions, pledge conditions, project dependencies, exact requirements, and conserved capital. It is a bounded, model-level certificate, not a completed blockchain settlement.

## Reproduce independently

From repository root:

```sh
npm ci
npm run test:counterfactual
node scripts/certificate.js
node scripts/certificate.js --topup
npm run test:benchmark
npm run test:browser
```

To verify the NEAR contract and local sandbox separately, install the pinned toolchain and run `RUSTUP_TOOLCHAIN=1.93.0 bash scripts/verify-rust.sh` as documented in the README.

## Evidence and limits

- The interactive project cards and allocation breakdown come from `web/funding-view.mjs` and the existing bounded solver in `web/engine.mjs`.
- The local NEAR sandbox receipts are available in the console's **Local sandbox evidence** section and `web/data/evidence.json`. They come from independent local test runs, not the hypothetical browser action.
- The extra 1 NEAR is never deposited, signed, or sent from the browser example.
- The bounded public testnet evidence is available in `evidence/pact-atlas-testnet-evidence-2026-11-10.json` and `evidence/pact-atlas-testnet-coalition-evidence-2026-11-10.json`. It demonstrates disposable CLI-signed campaigns only; it does **not** claim genuine Meteor browser signing, public Sputnik web-wallet governance, an independent qualified security audit, production readiness, guaranteed delivery, or universal mathematical optimality.
- Withdrawal callback non-execution remains a real protocol limitation. No blind retry or unsafe unlock is used. See `docs/WITHDRAWAL_REVIEW.md` and `docs/SECURITY_REVIEW.md`.

## The actual differentiator

PACT Atlas finds and shows a **constraint-valid, inspectable one-use funding allocation** across projects that depend on one another. It does not claim higher raw activation counts than all competing approaches. See `docs/COMPETITIVE_ADVANTAGE.md` for benchmark semantics, prior art, and honest limits.

## Optional live witness

Open the recorded coalition contract at
[`coalition-20261110.beneficiary-20261110.testnet`](https://testnet.nearblocks.io/address/coalition-20261110.beneficiary-20261110.testnet), then inspect the manifest and run the read-only verifier command in `README.md`. The accepted certificate uses pledge index `1` for alpha and index `0` for beta, even though beta's contribution arrived first. The public route is read-only until a separately authorized, fully verified testnet wallet action is chosen.
