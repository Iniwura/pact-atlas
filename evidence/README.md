# RC1 evidence bundle

This directory contains the preserved PACT Atlas RC1 release evidence copied from the verified local run. It is part of the source candidate so a future GitHub repository does not depend on an adjacent workspace directory.

- `pact-atlas-sandbox-evidence.json`: five fresh NEAR sandbox campaigns, including the real Sputnik DAO campaign.
- `pact-atlas-rc1-sandbox-evidence.json`: separate maximum-capacity campaign using all 8 project and 32 pledge slots.
- `competitive-benchmark.json`: reproducible independent/threshold/PACT comparison with bounded exact top-up and oracle results.
- `pact_atlas_poc.wasm` and `pact_atlas_poc_abi.json`: the Wasm and ABI used by the evidence.
- `pact-atlas-rc1-report.md` and `pact-atlas-verification-report.md`: truthful release and verification reports.
- `../FINAL_ENGINEERING_REVIEW.md`: final frozen benchmark, security classification, verification and release recommendation.
- `screenshots/`: local Chromium desktop and mobile captures; these are UI evidence, not chain evidence.
- `SHA256SUMS`: hashes for every preserved file in this bundle.

The current RC3 Wasm SHA-256 is `9ed866dd401b57f26a3aa35dbe722230a0d3893bb31ed0fbbb1e320db7dd2e6f`. The ABI SHA-256 is `8399a2cc59c37680ed2ae418f2f04cc8121dda2eca0f8777a9933d1de46e2f5b`. Its pinned NEAR code hash is `Bh4oaer6T9uUwbQBEfN1RFJ4S3jteMBnH6pWH7qC5nKx`.

The evidence is local NEAR sandbox evidence only. It is not testnet or mainnet evidence, and it does not prove recovery when a native-transfer callback never executes. The corresponding sandbox-backed Vercel preview is recorded in `docs/VERCEL_PREVIEW.md`; hosted UI evidence must not be confused with chain evidence.
