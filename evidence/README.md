# RC1 evidence bundle

This directory contains the preserved PACT Atlas RC1 release evidence copied from the verified local run. It is part of the source candidate so a future GitHub repository does not depend on an adjacent workspace directory.

- `pact-atlas-sandbox-evidence.json`: five fresh NEAR sandbox campaigns, including the real Sputnik DAO campaign.
- `pact-atlas-rc1-sandbox-evidence.json`: separate maximum-capacity campaign using all 8 project and 32 pledge slots.
- `pact-atlas-atomic-deployment-evidence.json`: exact self-service atomic deployment request followed by a sandbox contribution, activation, beneficiary withdrawal and zero-liability reconciliation.
- `competitive-benchmark.json`: reproducible independent/threshold/PACT comparison with bounded exact top-up and oracle results.
- `pact_atlas_poc.wasm` and `pact_atlas_poc_abi.json`: the Wasm and ABI used by the evidence.
- `pact-atlas-rc1-report.md` and `pact-atlas-verification-report.md`: truthful release and verification reports.
- `pact-atlas-alternate-wallet-attempt-2026-11-11.json`: authentic Sender and Nightly browser-wallet attempts; no signature claimed.
- `pact-atlas-withdrawal-failure-attempt-2026-11-12.json`: genuine sandbox recipient-deletion failure-injection attempt; the public withdrawal could not reach a native-transfer receipt after the authenticated recipient disappeared, and conservation remained intact.
- `../docs/ENGINEERING_EVIDENCE_2026-11-10.md`: historical engineering benchmark, security classification, verification and release recommendation.
- `screenshots/`: local Chromium desktop and mobile captures; these are UI evidence, not chain evidence.
- `SHA256SUMS`: hashes for every preserved file in this bundle.

The current RC3.1 Wasm SHA-256 is `5c06693028cc4b74527e6cf9fee5929a516c1644cc74f8136d5d53215eacfc15`. The ABI SHA-256 is `8399a2cc59c37680ed2ae418f2f04cc8121dda2eca0f8777a9933d1de46e2f5b`. Its pinned NEAR code hash is `7CEBKra569k7TYyxoXWSoXwVak83uXCmkDqgHJNvkxUEp`.

The evidence is local NEAR sandbox evidence only. It is not testnet or mainnet evidence, and it does not prove recovery when a native-transfer callback never executes. The corresponding sandbox-backed Vercel preview is recorded in `docs/VERCEL_PREVIEW.md`; hosted UI evidence must not be confused with chain evidence.
