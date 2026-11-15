# Coalition Atlas frontend redesign report

Date: 2026-11-02  
Engineering baseline: `cfa67ef`  
Frontend redesign scope: UI, styling, browser journeys and design documentation only

## Outcome

The frontend now presents PACT Atlas as a signal/proof instrument rather than a generic dashboard. The first viewport explains the verified A+B+C coalition, the network graph is the visual center, counterfactual changes remain visibly model-only, and the evidence ledger exposes actual local sandbox phase/liability data.

The redesign does not modify the Rust contract, ABI, solver, accounting, transaction handling, sandbox implementations, Wasm artifacts or preserved engineering evidence.

## Implemented

- staged narrative: see the problem, find the coalition, inspect promises, make it executable, inspect the proof;
- distinctive near-black grid foundation with cream typography, electric-blue dependency signal, acid-green verified state, amber model-only state and coral blocked state;
- tighter graph panel with real project/commitment relationships, keyboard selection and graph-to-inspector proof flow;
- counterfactual engine presentation that retains exact/blocked labels and never mutates DAO-approved conditions;
- evidence ledger rows for real PACT/DAO addresses, receipt hashes, final phase and liabilities;
- responsive desktop/mobile layout with no horizontal overflow;
- motion limited to route/selection state and disabled under `prefers-reduced-motion`;
- targeted Playwright coverage for graph selection and evidence scenario switching;
- design rationale in [`DESIGN_DIRECTION.md`](DESIGN_DIRECTION.md);
- final browser captures in [`design-evidence/`](design-evidence/).

## Browser verification

| Check | Result |
| --- | ---: |
| Reference/benchmark regression suite | 35 passed |
| Counterfactual engine tests | 6 passed |
| Wallet request-builder tests | 5 passed |
| Wallet adapter tests | 4 passed |
| Chromium browser checks | 12 passed |
| Serious/critical axe violations | 0 |
| Console/page errors on primary flow | 0 |
| Mobile horizontal overflow at 390px | none |

The browser checks cover first-viewport comprehension, blocked and exact counterfactual states, model-only wallet boundary, real evidence reconciliation, direct routes, graph keyboard interaction, evidence switching, console/page errors, accessibility and responsive layout.

## Measured local performance

Five cold local Chromium navigations to `http://127.0.0.1:4173/` were measured with the Navigation Timing API:

| Metric | Observed samples | Median |
| --- | --- | ---: |
| DOMContentLoaded | 34.1, 42.2, 316.5, 46.9, 45.2 ms | 45.2 ms |
| load event | 93.1, 92.2, 325.6, 105.7, 99.9 ms | 99.9 ms |
| transfer size | 17,046 bytes each | 17,046 bytes |

These are local preview measurements, not Lighthouse scores, field performance, or a hosted-network guarantee.

## Evidence boundary

The preview remains sandbox-backed and read-only unless an explicitly injected wallet adapter is present. It does not fabricate testnet receipts, sign automatically, retry unknown withdrawals or imply that a baseline’s invalid nominal allocation activated successfully. No deployment, publication, testnet transaction or real-fund operation was performed during this redesign.

## Remaining UX issues

- The graph is an authored four-project scenario rather than a live multi-DAO graph; live testnet ingestion remains a separate authorized milestone.
- The preview does not yet provide a real wallet-selector UI; it exposes the validated host adapter boundary only.
- The evidence viewer is intentionally compact and links to raw JSON; it is not a block-explorer replacement.
- The local fonts are system/installed fallbacks to preserve a small, offline-capable preview; no remote font dependency was added.

## Frozen engineering verification

The contract and evidence remain at the previously frozen engineering boundary. The current frontend commit changes only `web/`, `docs/DESIGN_DIRECTION.md`, this report, and related judge-facing documentation. The release remains subject to the callback non-execution, native-transfer injection, testnet and independent-audit limitations in [`ENGINEERING_EVIDENCE_2026-11-10.md`](ENGINEERING_EVIDENCE_2026-11-10.md).
