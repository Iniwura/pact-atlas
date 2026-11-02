#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
command -v cargo >/dev/null || { echo 'Rust toolchain not found. Install rustup and Rust 1.93.0 or newer.' >&2; exit 127; }
command -v rustc >/dev/null || { echo 'rustc is missing.' >&2; exit 127; }
command -v cargo-near >/dev/null || { echo 'cargo-near is required for the nearcore-compatible Wasm build.' >&2; exit 127; }
echo "rustc: $(rustc --version)"
echo "cargo: $(cargo --version)"
echo 'Formatting contract source...'
cargo fmt --manifest-path contract/Cargo.toml -- --check
echo 'Checking on-chain WebAssembly target...'
RUSTFLAGS='--cfg near' cargo check --locked --manifest-path contract/Cargo.toml --target wasm32-unknown-unknown
echo 'Running Rust contract unit tests...'
RUSTFLAGS='--cfg near' cargo test --locked --manifest-path contract/Cargo.toml
echo 'Running Rust clippy with warnings denied...'
RUSTFLAGS='--cfg near' cargo clippy --locked --manifest-path contract/Cargo.toml --all-targets -- -D warnings
echo 'Generating JSON ABI...'
cargo near abi --locked --manifest-path contract/Cargo.toml --out-dir contract/target/near-build
echo 'Building nearcore-compatible optimized WebAssembly...'
cargo near build non-reproducible-wasm --locked --no-abi --manifest-path contract/Cargo.toml --out-dir contract/target/near-build
echo 'Running executable JavaScript finance tests...'
npm test
echo 'Running exact Coalition Atlas counterfactual tests...'
npm run test:counterfactual
echo 'Running real NEAR sandbox accounting scenarios...'
npm run test:sandbox
echo 'All local Rust, Wasm, reference-model and NEAR sandbox checks passed. Testnet remains a separate authorized gate.'
