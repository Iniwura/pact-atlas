# PACT Atlas Campaign Lab — judge reproduction

The Campaign Lab at /create.html is a self-service **offline funding planner**, not a wallet, deployed campaign, or production funding service. It allows reviewers to create their own project and supporter constraints rather than relying on the prepared demo.

## Complete workflow

1. From /console, select **Build your own funding plan**.
2. Choose **Start blank**, name the campaign, and add 1–5 projects. Set whole-NEAR funding goals and dependency requirements. Decide which projects to include.
3. Under **Supporters**, enter 1–8 contribution amounts, permitted destinations, and optional conditions requiring particular projects to be funded.
4. Select **Check funding**. The bounded exact allocator returns a valid one-use arrangement or an honest blocked/undetermined result.
5. Select **Download scenario and verification JSON**. The file contains campaign inputs, a model-only status and an exact allocation certificate only when one exists.
6. Independently verify the downloaded file from a clean checkout:

    npm ci
    npm run test:counterfactual
    npm run verify:campaign -- /path/to/pact-campaign-proof.json

The verifier recomputes the arrangement, rejects tampered, duplicate, partial or unauthorized allocations, and uses **no wallet or network calls**.

## Demonstrate the difference

Open **Use example**: four community projects require 13 NEAR; five supporters offer 12. Add a sixth supporter for 1 NEAR restricted to Events and check funding. PACT finds a valid allocation across the four projects. Remove that permission and the plan fails. The more interesting case is when the total available balance is high enough but the exact supporter restrictions prevent any valid arrangement.

## Accuracy and safety limits

- The custom planner handles 1–5 projects and 1–8 supporters, with whole contributions and goals of 1–100 NEAR. An expensive search returns **undetermined**, never a fabricated impossibility.
- A contribution is assigned whole to one permitted project or remains unassigned. The planner does not split pledges or pay out unused capital.
- Results remain local to the browser. Draft autosave is browser-only, not a server campaign registry. Export is a local JSON file.
- The custom planning inputs **are not automatically deployable to the current fixed NEAR contract**. This tool does not sign transactions or modify the authorized contract.
- Existing local NEAR sandbox evidence is historical, separate from these browser calculations, and not public testnet proof.
- It does not claim an external audit, real-fund safety, mathematically novel optimization, or resolution of withdrawal callback uncertainties.

## What makes this different

PACT produces **inspectable one-use funding allocations** that respect contributor destination permissions, conditional funding requirements, project dependencies, exact goals and capital conservation. Judges can create unfamiliar scenarios and independently verify their results.

Consult docs/SECURITY_REVIEW.md, docs/WITHDRAWAL_REVIEW.md and docs/COMPETITIVE_ADVANTAGE.md for the other engineering risks, accurate benchmark framing, and prior art.
