# PACT Atlas — independent judge witness

## Start in the application

Open `/console`, not a test harness. The home screen is a campaign workspace containing recorded real NEAR testnet activity, a direct campaign creator and links to a receipt verifier.

### 1. Browse a real conditional coalition

Choose the **Conditional coalition** campaign. Its contract is `coalition-20261110.beneficiary-20261110.testnet`. There are two 1 NEAR projects: Beta depends on Alpha. The beta contribution arrived first, followed by alpha. The accepted certificate was `[1 → alpha, 0 → beta]`.

The reader authenticates a share token against the immutable contract configuration, verifies the pinned code hash and reads finalized status/accounting. If RPC is unavailable, the onchain state view fails closed rather than pretending success. Archival explorer receipts remain independently accessible.

### 2. Follow the money

Open `/console#activity`, then check the transactions for contributions, activation, alpha beneficiary payout and beta beneficiary payout. Each entry links to the original testnet receipt. Inspect the separate expiry/refund campaign: `refund-20261110.supporter-20261110.testnet`. It has finalized contribution, expiry and refund records.

The two public evidence manifests are:

- [Coalition evidence](../evidence/pact-atlas-testnet-coalition-evidence-2026-11-10.json)
- [Single-project activation and refund evidence](../evidence/pact-atlas-testnet-evidence-2026-11-10.json)

These real public testnet transactions were signed by disposable CLI keys, not by a browser-wallet extension.

### 3. Create a campaign

Open `/create.html`. A new browser starts with a blank draft. Add projects, funding requirements, dependencies, beneficiaries and supporter conditions. The planner can calculate an exact bounded allocation; exporting a draft does not deploy anything.

If the draft is fundable, the app exposes an optional testnet-only deployment path that requires a real wallet approval. This browser-signing flow is implemented but **not** independently verified end-to-end. A successfully signed and finalized deployment can be rediscovered from the same browser's saved draft.

### 4. Verify independently

Open `/verify.html` and submit a genuine recorded `commit`, `activate`, `withdraw` or `expire` transaction. The verifier requires finalized execution and the pinned PACT code hash. Provider timeouts are unknown outcomes, not proof that a transaction failed.

## Boundaries and safety

- This is a NEAR testnet application; no mainnet or valuable funds should be deposited.
- Callback non-execution can leave a withdrawal indefinitely pending. No safe recovery is proven; do not retry or unlock speculatively.
- Public Sputnik DAO execution and browser-extension signing remain unverified. Sandbox governance tests do not equal a public DAO lifecycle.
- No independent qualified security audit has been completed.

## Reproduce

From the repository root: `npm run verify` for the contract and model tests; `npm run test:browser` for the product. The public receipts are in the evidence manifests. GitHub Actions is blocked by account billing restrictions, so do not represent CI as green.
