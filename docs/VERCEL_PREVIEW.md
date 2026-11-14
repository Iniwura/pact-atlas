# Vercel preview package

PACT Atlas includes a static Vercel configuration for a reproducible judge preview. It rewrites `/` to the existing `web/index.html` and maps the module, stylesheet, evidence and optional wallet-adapter paths without creating a second frontend build.

RC1 preview evidence (2026-11-02):

- URL: https://pact-atlas-rc1-preview-lbtitxcri-iniwura-akurus-projects.vercel.app/
- Deployment: `dpl_956XYXB54TgehyFobxguQVqFyU1a`
- Vercel project: `prj_6q7qCVVeB6WTC57jBJCTdPaVgxpP`
- Deployment target: `null` (Vercel preview; no production target)
- Verified with Vercel fetch: `/`, `/styles.css`, `/app.js`, `/engine.mjs`, `/near-workflow.mjs`, `/near-adapter.mjs`, `/data/evidence.json` and `/HACKATHON.md` returned HTTP 200.

The project currently has Vercel SSO protection enabled. This is an account-verified hosted preview, not an unauthenticated public URL; disable or separately configure access only with explicit authorization.

The latest PR #11 release review also recorded the READY preview
`https://pact-atlas-i7znsmfm6-iniwura-akurus-projects.vercel.app`. It remains
sign-in protected and is not treated as a public judge URL or live-chain proof.
No deployment, promotion or access-policy change was made during this release
pass.

An unauthenticated read-only probe on 2026-11-10 returned `302` to Vercel SSO
for `/`, `/console` and `/campaign`; these routes were not presented as a
public judge URL. The current checkout's local preview is the authoritative
browser target until an authorized redeployment is made.

The local final engineering pass refreshed the sandbox evidence and Wasm after a callback validation hardening change. The recorded deployment above is the previously verified RC1 preview and was not silently replaced; it should be redeployed from the current checkout, with the same SSO protection, before being presented as the current artifact. The local browser campaign below is the authoritative result for the current checkout.

The first API attempt supplied `target: "preview"`, which Vercel interpreted as a production deployment (`dpl_6rpBLndJMtUAWFpQjGAvuXgSab3A`). It was not promoted or used as release evidence; the project was paused and its URL returns `503 DEPLOYMENT_PAUSED`. The valid preview above was then created by omitting `target`, as required by the Vercel MCP API. This is recorded explicitly so the two deployment IDs are not confused.

## What a preview contains

- The default page is explicitly read-only and labels its evidence `NEAR-SANDBOX / local only`.
- `/data/evidence.json` is the inspectable sandbox evidence record; it is not presented as testnet activity.
- Wallet actions only exist when the host injects `window.PACT_NEAR_ADAPTER` and non-secret `window.PACT_NEAR_CONFIG` for an isolated testnet deployment.
- The adapter must return a transaction hash before the UI calls an action confirmed. A missing or unknown transfer result is never retried by the browser.

## Authorized operator procedure

After explicit authorization for a new preview, run the normal local checks, then deploy from this directory with the Vercel CLI in preview mode. Do not use a production promotion flag, mainnet configuration, production key, or repository publication step. Record the resulting preview URL, deployment ID and the exact commit/artifact hashes in the RC1 evidence report. The existing preview above is a static sandbox-backed demonstration; it has no live testnet wallet configuration.

The preview is ready for a testnet adapter only after an operator supplies isolated `*.testnet` contract/DAO IDs and a wallet host. Do not put private keys or credentials in Vercel environment variables for this static product.
