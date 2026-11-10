# PACT Atlas — verification update (2026-11-10)

## RC3 live-chain hardening update

Commit `457a92e` was audited before this update. The three release-blocking
findings were reproduced with failing regression tests and fixed:

- transaction finality now serializes JSON-RPC method `tx` with
  `{tx_hash, sender_account_id, wait_until: "FINAL"}`;
- `campaign_config()` and `pledge_records()` are read-only contract views;
  candidate allocations use canonical finalized pledge indexes, owners,
  amounts, permissions and conditions rather than planned supporters;
- share links use schema `pact-public-campaign-v2`, pin the deployed code hash,
  and fail closed unless immutable project, timing and authority facts match
  finalized contract views.

The RC3.1 follow-up also closes the wallet-boundary and deployment funding
gaps found in the pre-signing review. Live state is invalidated before every
finalized refresh; immutable config, pinned code hash, canonical pledge state
and solvent accounting must all verify before an adapter is created or any
wallet modal can open. The contract now permits initialization by itself or
the exact direct namespace parent, which is the NEAR-compatible predecessor in
the tested atomic deployment receipt. This is a narrow authorization change,
not a withdrawal or liability redesign. The preserved artifacts and sandbox
evidence were regenerated from the current source and Wasm.

This record covers the isolated self-service release pass descended from
`9069b32bbd3abbecfdd5594338f21c6a4c52ccea`. It includes the RC3 read-only
contract views, corrected finality transport, authenticated campaign links,
testnet-only campaign request layer, lazy Wallet Selector host, public campaign
route and finalized view reconciliation. No wallet was connected and no public
testnet transaction was signed.

## GitHub CI diagnosis

The latest pull-request run `42705729543` and push run `42705722733` reached
the browser, Node, and Rust jobs successfully. The NEAR sandbox job was not
started. Its check-run annotation was:

> The job was not started because recent account payments have failed or your
> spending limit needs to be increased.

There were no sandbox steps or logs to diagnose. This is an external GitHub
Actions billing/spending-limit blocker, not a failed accounting assertion. The
sandbox job remains in the workflow so it cannot silently disappear from the
release gate.

After this release-pass commit was pushed, run `42725551849` (`#285`) also
produced no executable job steps: Rust, Node and Chromium were marked failed,
the sandbox was skipped, and GitHub exposed no job-log blobs. Together with the
explicit billing annotation above, this is classified as a GitHub Actions
account/infrastructure blocker and **not** as evidence that the code gates
failed. The run is not counted as a passing CI result.

## Local verification

The following gates were run in the isolated checkout:

| Gate | Result | Evidence boundary |
| --- | --- | --- |
| Rust unit tests | 16/16 passed | Local Rust VM |
| Rust format, locked Wasm check, clippy | Passed | Local toolchain |
| JavaScript reference suite | 35/35 passed | Local model/tests |
| Competitive benchmark | 9/9 passed | Bounded reference benchmark |
| Counterfactual engine | 23/23 passed | Browser-independent solver tests |
| Wallet workflow | 8/8 passed | Request construction; no signing |
| Wallet adapter | 8/8 passed | Injected adapter safety; no signing |
| Campaign chain, RPC, live-data and ABI interface tests | 9/9 passed | Testnet-only deployment/share/call request construction, JSON-RPC transport, chain-derived certificates and ABI surface |
| Testnet proof verifier | 7/7 passed | Read-only verifier tests |
| Playwright browser suite | 54/54 passed | Local Chromium at 320, 360, 390, 768, 1024 and 1440px; public campaign route and adversarial fail-closed wallet tests included |
| NEAR sandbox: cycle/all-four/expiry/concurrent | Passed | Fresh local sandbox receipts and accounting snapshots |
| NEAR sandbox: maximum capacity | Passed | 8 projects, 32 deposits, 32 credits, 32 withdrawals |
| NEAR sandbox: Sputnik governance | Passed | Fresh DAO proposal, quorum, execution, funding and refund |
| NEAR sandbox: atomic self-service deployment | Passed | CreateAccount → 3 NEAR transfer → DeployContract → new → 2 NEAR sponsor_storage → commit → activation → withdrawal |
| Meteor Wallet / testnet RPC probe | 3/3 passed | Pinned module endpoints HTTP 200 and live testnet `status` response; no signing |

The sandbox campaigns exercised expected negative paths as well as successful
transfers. Every recorded accounting snapshot was solvent; the exercised
campaigns ended with zero liabilities. These are local sandbox results, not
public testnet evidence.

## Read-only testnet protocol probe

On 2026-11-10, a non-signing probe reached `https://rpc.testnet.fastnear.com`
and returned `chain_id: testnet` with protocol version `88`. The three pinned
Wallet Selector v10.1.4 ESM endpoints used by `web/wallet-selector-host.mjs`,
including Meteor Wallet, returned HTTP 200. This validates endpoint reachability and the configured
testnet network, not wallet connection, signature approval or a campaign
transaction. No account, key, faucet call or transaction was used.

## Artifact record

The release artifacts were rebuilt from the current source and preserved:

| Artifact | SHA-256 |
| --- | --- |
| `evidence/pact_atlas_poc.wasm` | `5c06693028cc4b74527e6cf9fee5929a516c1644cc74f8136d5d53215eacfc15` |
| `evidence/pact_atlas_poc_abi.json` | `8399a2cc59c37680ed2ae418f2f04cc8121dda2eca0f8777a9933d1de46e2f5b` |
| Sputnik sandbox Wasm | `6e3f1814d40769d8f57b9a7af689d22aaab96d3232cec4d861311829c1d2318f` |
| PACT sandbox Wasm code hash | `7CEBKra569k7TYyxoWSoXwVak83uXCmkDqgHJNvkxUEp` |
| Offline certificate sample | `7a7124674a7e57ee3772b99775206833c9673446395fa0d58e5c2449dcc6d6c9` |

The final local `RUSTUP_TOOLCHAIN=1.93.0 bash scripts/verify-rust.sh` pass
regenerated ABI and optimized Wasm with the pinned `cargo-near`/`wasm-opt`
workflow and matched both preserved artifact hashes exactly. The earlier
`abdfbb7c…` mismatch came from a stale pre-verification build and is not part
of this release evidence.

## Security and release boundary

- No unsafe timeout retry, blind unlock, or unknown-outcome payout recovery was
  added.
- `withdraw` still depends on the private transfer callback to restore credit
  after a failed native transfer. If that callback never executes, the pending
  withdrawal can remain unresolved. This remains a production blocker, not a
  reason to weaken accounting.
- Genuine native-transfer failure injection and callback non-execution were not
  reproduced by the available sandbox harness. Ordinary native transfers,
  negative authorization paths, duplicate withdrawals, expiry refunds, and
  accounting conservation were exercised.
- The custom-campaign deployment flow is request- and browser-tested with
  deterministic wallet/RPC doubles, and the exact action ordering is also
  executed in genuine local sandbox state. The sandbox is not testnet evidence:
  no public account, signature or explorer receipt is claimed.
- A previous 0.3 + 0.3 NEAR atomic deployment probe failed at Wasm storage
  funding; the corrected 3 + 2 NEAR request passed. This is why deployment
  funding is now explicit in the request and documentation.
- No authorized testnet signing credentials were available. There is no testnet
  deployment, transaction hash, or public-chain lifecycle evidence to report.
- The repository is not externally audited. Development-tool dependency audit
  findings remain separate from runtime production dependencies; no runtime
  dependencies are declared.

## Recommendation

The product workflow is a credible judge demonstration with reproducible
offline, local-VM, sandbox, artifact, and deterministic wallet-boundary
evidence. Keep PR #11 draft and do not describe the release as production-safe
or testnet-verified. Before public submission, clear the GitHub Actions billing
gate and, if authorized, run the isolated testnet campaign. Callback
non-execution remains a production blocker; no unsafe fix was attempted.
