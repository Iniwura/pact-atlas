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

## Public testnet execution addendum

After this local checkpoint, the authorized disposable-account run completed on
NEAR testnet. The exact public contract IDs, finalized transaction hashes,
immutable configurations, code hashes, allocation certificate, accounting
snapshots and balances are recorded in
`evidence/pact-atlas-testnet-evidence-2026-11-10.json`. This addendum supersedes
the earlier “no authorized testnet credentials” statement for the bounded
demonstration only; it does not remove the callback, native-transfer failure,
Meteor signing, Sputnik governance or independent-audit limitations.

## Public coalition lifecycle addendum (2026-11-10)

The stronger public demonstration is recorded separately in
`evidence/pact-atlas-testnet-coalition-evidence-2026-11-10.json` so that the
original two-campaign manifest remains an immutable historical record. The
campaign `coalition-20261110.beneficiary-20261110.testnet` deployed the pinned
207,587-byte Wasm, initialized `alpha` and dependency-bound `beta`, accepted
beta's conditional pledge before alpha's independent pledge, and activated the
canonical certificate `[1 → alpha, 0 → beta]`. Both beneficiaries withdrew.
Eight lifecycle transactions were independently checked against the official
RPC at `FINAL`; all transaction and receipt outcomes succeeded, the code hash
was `7CEBKra569k7TYyxoWSoXwVak83uXCmkDqgHJNvkxUEp`, and final liabilities,
credits, pending and accounted were all zero with `solvent: true`.

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
- The former 0.3 + 0.3 NEAR estimate was structurally insufficient for the
  207,284-byte Wasm's approximately 2.07 NEAR code-storage cost. The first
  atomic probe with the old contract reached the initialization authorization
  guard before that funding check; the corrected parent authorization and 3 + 2
  NEAR request passed. This is why deployment funding is now explicit in the
  request and documentation.
- The public testnet evidence was CLI-signed with isolated faucet-funded
  identities. Genuine Meteor browser extension signing and multi-member
  Sputnik web-wallet approval remain unverified; no browser key or credential
  is stored in the repository.
- The repository is not externally audited. Development-tool dependency audit
  findings remain separate from runtime production dependencies; no runtime
  dependencies are declared.

## Recommendation

The product workflow is a credible judge demonstration with reproducible
offline, local-VM, sandbox, artifact, deterministic wallet-boundary and bounded
public-testnet evidence. Keep PR #11 draft and do not describe the release as
production-safe, externally audited or fully wallet-verified. Callback
non-execution remains a production blocker; no unsafe fix was attempted.
