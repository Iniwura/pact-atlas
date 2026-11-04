# PACT Atlas — 60-second allocation witness

**Status:** local reference model and verified local NEAR sandbox evidence. This walkthrough does not prove public testnet activity, move funds, or replace an independent security audit.

## Do this, observe this

1. Open `/console`. All four projects are selected, but the exact solver says **Blocked**. The graph shows a candidate allocation of **4/4 NEAR Training**, **3/3 Internet**, **3/3 Equipment**, and **2/3 Events**. The first three projects are *candidates*, not activated onchain. Total commitments are 12 NEAR; the four projects require 13 NEAR.
2. Expand **Why not count all eligible funding?** Eligibility looks like 15 NEAR only because commitment 01 (3 NEAR) can go to Training **or** Events. It must not be counted twice. The actual committed capital is still 12 NEAR.
3. Click **Simulate +1 NEAR**. This adds a model-only sixth commitment restricted to Events. The exact solver finds a valid four-project allocation:
   - Training: Donor 01 (3 NEAR) + Donor 02 (1 NEAR) = 4 NEAR
   - Internet: Donor 03 (3 NEAR) = 3 NEAR
   - Equipment: Donor 04 (3 NEAR) = 3 NEAR
   - Events: Donor 05 (2 NEAR) + new commitment (1 NEAR) = 3 NEAR
4. Read **Inspect exact allocation** next to the network. It shows the four destination totals, six distinct commitments, and local validation of one-use allocation, eligible destinations, pledge conditions, dependency closure, exact project amounts, and capital conservation. These are **reference-model checks**, not claims of external review.
5. Click **Reset simulation**. The full coalition becomes blocked again. The starting commitments are not modified.
6. Select **Other scenarios → A+B+C**. The core coalition has a valid 10 NEAR allocation with 2 NEAR unused/refundable. Choose **D only** to see the contract's mandatory A+B+C activation rule block that isolated coalition.

## Independent reproduction

From repository root:

```sh
npm ci
npm run test:counterfactual
node scripts/certificate.js
node scripts/certificate.js --topup
npm run test:benchmark
npm run test:browser
```

The same fixture's preserved offline example certificates are in `docs/certificate-before-topup.json` and `docs/certificate-with-topup.json`. The screenshot and rendered witness are derived from `web/engine.mjs` via `web/funding-view.mjs`, **not** from embedded screenshots or hardcoded claimed outcomes. The regression suite deliberately tampers with certificates to show rejection of duplicate or ineligible allocations.

The broader six-scenario comparison, its defined baselines, and its limits are documented in `docs/COMPETITIVE_ADVANTAGE.md`. Do not compare its nominal activation counts without its constraints: independent evaluation can double-count flexible commitments, and plain threshold pooling does not establish eligibility or dependency closure.

## Verification boundaries

- `web/funding-view.mjs` is a UI-oriented, fail-closed witness check layered on the bounded exact reference solver. It is not a replacement for the Rust contract's authoritative validation.
- `/data/evidence.json` contains preserved local NEAR sandbox receipts; it is **not** a receipt from the current browser simulation.
- The mainnet/testnet wallet flow has not been independently established. A simulated sixth commitment cannot be signed automatically as if it were already deposited.
- The Rust contract still has documented withdrawal callback non-execution, transfer-failure injection, unbounded storage sizing, and external-audit limitations. See `docs/SECURITY_REVIEW.md` and `docs/TESTNET_CHECKLIST.md`.
- The benchmark solver is bounded and exponential; PACT does not claim novel mathematics or a universally optimal allocation.

## What matters

PACT's claim is a **constraint-valid, inspectable allocation certificate**, not the highest raw activation count, the fastest solver, an actual 1 NEAR payment, or production readiness.
