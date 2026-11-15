> Archived: original development kickoff instructions. Refer to the current README for the submitted release.

# PACT Atlas — one-shot Codex task

The user has authorized you to independently carry out all feasible software implementation, code review, tooling installation, Rust/Wasm compilation, sandbox tests, security fixes, and evidence collection. They do not want any manual command-line work.

Start by reading `AGENTS.md`, `README.md`, `docs/SECURITY_REVIEW.md`, `docs/TESTNET_CHECKLIST.md`, then execute the autonomous task sequence fully. Fix bugs and rerun verification until the safety and reproducibility gates are satisfied or an external authorization/credential blocker genuinely prevents further progress.

The current 26/26 JavaScript tests are reference-model tests, NOT Rust/Wasm or on-chain proof. Focus on the real contract. Do not request terminal logs from the user. Do not stop after planning. Avoid unrelated changes. Do not deploy to mainnet or use funds without explicit consent. If a GitHub repo is not connected, work in your environment and deliver a complete source artifact; do not push to unrelated repositories.

End with: exact passing/failing gates, local logs, real receipts if available, unresolved financial risks, and next verified action. Keep the repo and any artifacts reproducible.
