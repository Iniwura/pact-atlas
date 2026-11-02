# Vercel preview package

PACT Atlas includes a static Vercel configuration for a reproducible judge preview. It rewrites `/` to the existing `web/index.html` and maps the module, stylesheet, evidence and optional wallet-adapter paths without creating a second frontend build. No deployment was performed for RC1: this checkpoint has no Vercel authorization and no public preview URL.

## What a preview contains

- The default page is explicitly read-only and labels its evidence `NEAR-SANDBOX / local only`.
- `/outputs/pact-atlas-sandbox-evidence.json` is the inspectable local evidence record; it is not presented as testnet activity.
- Wallet actions only exist when the host injects `window.PACT_NEAR_ADAPTER` and non-secret `window.PACT_NEAR_CONFIG` for an isolated testnet deployment.
- The adapter must return a transaction hash before the UI calls an action confirmed. A missing or unknown transfer result is never retried by the browser.

## Authorized operator procedure

After explicit authorization, run the normal local checks, then deploy from this directory with the Vercel CLI in preview mode. Do not use a production promotion flag, mainnet configuration, production key, or repository publication step. Record the resulting preview URL, deployment ID and the exact commit/artifact hashes in the RC1 evidence report.

The preview is ready for a testnet adapter only after an operator supplies isolated `*.testnet` contract/DAO IDs and a wallet host. Do not put private keys or credentials in Vercel environment variables for this static product.
