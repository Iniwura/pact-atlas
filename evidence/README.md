# RC1 evidence bundle

This directory contains the preserved PACT Atlas RC1 release evidence copied from the verified local run. It is part of the source candidate so a future GitHub repository does not depend on an adjacent workspace directory.

- `pact-atlas-sandbox-evidence.json`: five fresh NEAR sandbox campaigns, including the real Sputnik DAO campaign.
- `pact-atlas-rc1-sandbox-evidence.json`: separate maximum-capacity campaign using all 8 project and 32 pledge slots.
- `competitive-benchmark.json`: reproducible independent/threshold/PACT comparison with bounded exact top-up and oracle results.
- `pact_atlas_poc.wasm` and `pact_atlas_poc_abi.json`: the Wasm and ABI used by the evidence.
- `pact-atlas-rc1-report.md` and `pact-atlas-verification-report.md`: truthful release and verification reports.
- `screenshots/`: local Chromium desktop and mobile captures; these are UI evidence, not chain evidence.
- `SHA256SUMS`: hashes for every preserved file in this bundle.

The Wasm SHA-256 is `7329d40af43d7e4d6cd3ff942cbe31ba9c54124e667a9af0233e63fa9020d103`. The ABI SHA-256 is `4f9d6ea16bbc8986e304f5b894403501c262b409379efa3eef2f1dd248201075`.

The evidence is local NEAR sandbox evidence only. It is not testnet or mainnet evidence, and it does not prove recovery when a native-transfer callback never executes. The corresponding sandbox-backed Vercel preview is recorded in `docs/VERCEL_PREVIEW.md`; hosted UI evidence must not be confused with chain evidence.
