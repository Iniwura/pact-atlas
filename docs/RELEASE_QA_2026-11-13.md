# PACT Atlas — Final product QA evidence

Verified on **13 November 2026** against the release candidate (before the documentation-only QA report update).

## Executive outcome

The consumer product is a real NEAR testnet campaign workspace, not a fictional payment dashboard. The latest design preserves the original cinematic landing composition; the sidebar has been removed, and the editor, project reader, receipt timeline and independent verifier share the editorial light/dark design language.

### Executed tests

| Verification | Passed | Environment |
| --- | ---: | --- |
| Chrome browser tests | **58 / 58** | Isolated Vercel Sandbox, Google Chrome 157, Playwright 1.56.1, 2 workers, zero retries |
| Node tests | **60 / 60** | Node.js 24 in the isolated sandbox |
| Vercel routes/assets | **10 / 10 HTTP 200** | Exact recent release code after UX and accessibility fixes |
| Prior public testnet lifecycle | 3 recorded campaigns | Actual CLI-signed NEAR testnet evidence, dated 10 November, linked below |

The Chrome suite covers the landing, top navigation, 320px-to-desktop overflow, funded/expired campaign discovery, authenticated share-link formatting, real receipt links, local saved deployments, create-from-blank, changing project names and dependencies, exported plans, invalid campaign rejection, read-only verification, disabled signing after RPC failure, and accessibility scans. The frontend tests use mocked/failing RPC responses for deterministic security and failure-state checks. **They do not prove browser extension signing with an authentic wallet.**

The Node suite covers exact solver funding conditions, immutable contracts and code hash checks, share-token identity, bounded allocations, request safety, wallet adapter conversion, RPC transport and finality, pinned wallet selector URLs and proof API behaviors. The environment includes the original ABI manifest. Neither this browser pass nor the Node pass constitutes a new Rust or NEAR sandbox run.

### Found and corrected during this pass

1. Contrast on the cream/ink consumer console did not meet WCAG AA for a set of small labels, receipts and status text. Darkened secondary text while keeping the reference-inspired style, then reran **18 / 18 console tests**, including Axe accessibility.
2. Campaign dependency choices showed stale **Unnamed project** text after renaming a project. The list now updates its caption during typing without replacing the input or losing keyboard focus.
3. Creator and verifier had insufficient contrast for several descriptions, links and footer labels. Updated the shared editorial stylesheet, then reran **40 / 40 creator, campaign-reader, verifier and landing tests**.
4. One initial Node-suite failure came from the isolated environment not having the original checked-in ABI manifest. After restoring the artifact, **60 / 60 tests passed**. This was not a product implementation failure.

### Onchain evidence

- [Two-project conditional coalition](../evidence/pact-atlas-testnet-coalition-evidence-2026-11-10.json): out-of-order independent pledges, activation, two beneficiary withdrawals, and final zero liabilities
- [Activation and expiry/refund](../evidence/pact-atlas-testnet-evidence-2026-11-10.json): additional signed testnet lifecycle records
- The current app uses the immutable public share configuration and independently attempts finalized contract/code/accounting checks; the recorded explorer receipts remain accessible when RPC is unavailable

A fresh live RPC receipt check from the isolated sandbox on 13 November timed out, **so do not treat that attempt as independent fresh confirmation**. The app fails closed on unavailable RPC. Historic manifests are separate from live contract state.

### Outstanding release gates

- Real Meteor/Sender/Nightly browser-extension **signing and finality** not independently verified
- Failure recovery if a NEAR withdrawal callback is never delivered remains unresolved. Mainnet and valuable-money use is **NO-GO**
- Public Sputnik DAO governance has sandbox coverage, not an independently demonstrated live public testnet governance vote
- No external smart-contract security audit
- GitHub Actions jobs remain unavailable/unreliable for this account due to billing restrictions; isolated sandbox checks above are the real current QA evidence
- Vercel preview protection and GitHub private visibility must be cleared before judges can inspect without authentication
- The NEAR Hackathon demands a **public repo, public X demo post (video/screenshots) and final submission by 14 November 2026, 23:59 UTC**. Publication and submission require owner approval

### Scope integrity

No contract or Wasm bytecode was changed by the UI/accessibility fixes. They change consumer layout, read-only display and the local editor's labeling only. No transactions were fabricated, no private keys added, and no production or mainnet payment was authorized.

**Verdict:** Consumer testnet UI and read-only evidence presentation pass the executed automated quality gates. Production financial safety and authentic browser-wallet signing remain unverified. This is a hackathon release candidate, not an audited financial service.
