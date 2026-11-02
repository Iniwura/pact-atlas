# PACT Atlas — Codex coding-agent instructions

## Mission
Own the development and verification of the PACT Atlas NEAR Social Money proof of concept end to end. The user requests no terminal instructions or manual development work. Work autonomously within your authorized environment, run real commands and tests, fix errors, inspect failures and report verified evidence. Do not stop after writing a plan or scaffolding.

## Ground truth and current baseline
- Read `README.md`, `docs/SECURITY_REVIEW.md` and `docs/TESTNET_CHECKLIST.md` before modifications.
- On 2026-10-30 the JavaScript *reference* model passed 26/26 tests. The Rust smart contract and its four authored tests were NOT compiled or run. There is NO NEAR sandbox/testnet proof yet.
- Source is a feasibility checkpoint, not audited or production-ready. Never conflate simulations/reference tests with actual on-chain execution.
- NEAR SDK and Rust toolchain versions are pinned in Cargo.toml / rust-toolchain.toml. Validate latest compatibility if necessary, documenting deliberate changes.

## Autonomous task sequence
1. Establish a clean Git baseline. Execute the Node reference suite and inspect all source and scripts.
2. Install/configure Rust, wasm32 target, cargo-near and NEAR sandbox tooling in the Codex environment as needed. Compile, format, lint and run Rust unit tests; fix all source/API/toolchain issues. Build actual Wasm.
3. Examine the contract's complete funds-accounting state machine. Specifically address callback failure or missing callback without double payouts, contract storage reserve insolvency, and selection/consent risks. State which failure modes cannot be automatically recovered without external proof. Prefer safe blocking over an unsafe retry.
4. Add meaningful NEAR sandbox integration tests with multiple independent accounts and actual attached NEAR. Assert precise balance outcomes for: three-project dependency cycle, all-four funding with topup, invalid allocations, double counting, premature activation, expired refunds, successful withdrawals, failed transfers and callback-related failure modes.
5. Run adversarial/property-based tests where feasible. Keep zero floating-point money; avoid race conditions and unverified time assumptions.
6. Preserve inspectable on-chain certificates and produce a reproducibility script with the exact expected account balances and final states.
7. If a testnet account or explicitly authorized signing credentials are already provisioned by the environment, deploy only to NEAR TESTNET and record real explorer links and transaction IDs. Otherwise finish sandbox evidence and mark testnet BLOCKED instead of asking user to use the terminal. Never fabricate chain evidence.
8. Only after core contract gates are genuinely green, consider basic product wiring; do not invest in a generic frontend. For the full UI, follow reference-first design and screenshot iterations with desktop/mobile verification.
9. Commit work to an appropriate branch and open a PR only if an authorized PACT repository is connected. If no such repo exists, leave a clean artifact/source bundle and report the single access blocker. Never push to an unrelated repository.

## Hard safety boundaries
- Never commit keys, wallets, credentials or user personal data.
- No MAINNET deployments, expenditures, production tokens or user funds without explicit user approval. TESTNET and local sandbox use only when permitted and funded by the environment.
- Do not claim verification based on an off-chain model. Provide exact commands, logs, artifact hashes and/or receipt references for each gate.
- Do not use simulated transactions as the primary proof. If you use mocks, label them as mocks.
- On any unresolved real-money safety issue, fail closed and report the blocker. Do not manufacture a passing check.
- Do not stop after asking the user to paste logs, set up WSL, run scripts, or debug dependencies; own all steps that your environment permits.

## Definition of done
- Rust compiles and the Wasm artifact is built.
- Unit and real sandbox integration tests pass.
- Accounting and callback risks have explicit, tested handling or are documented as blockers to a safely constrained proof.
- Honest reproducibility README, evidence index and security review are up to date.
- Testnet deployment is attempted only with authorized infrastructure; otherwise it is explicitly NOT VERIFIED.
- Report the remaining blockers, not just a positive summary.
