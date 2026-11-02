# PACT Atlas competitive benchmark

Date of the preserved benchmark run: 2026-11-02. This is an engineering comparison of explicit capability models, not a claim that PACT has won a market or that the referenced systems have been reimplemented.

## What is being compared

The reproducible suite in [`reference/competitive.js`](../reference/competitive.js) runs the same integer-unit commitment networks through three deliberately different semantics:

1. **Independent project funding**: each project independently totals all eligible pledges. A flexible pledge may be counted for multiple projects. This is a useful model of project-by-project evaluation, but it does not produce a globally conserved allocation certificate.
2. **Ordinary threshold pooling**: a single aggregate threshold selects the largest target subset affordable from total capital. It does not prove project-level eligibility, dependency closure or pledge conditions.
3. **PACT exact bounded solver**: each pledge is used at most once, targets must match exactly, pledge conditions and project dependencies must hold, and the result includes an allocation certificate. The reference search is exhaustive only within its documented bound of 8 projects and 12 pledges.

The benchmark reports nominal projects activated, allocated capital, unused/refundable capital, overcommitment, whether all PACT constraints are actually certified, bounded exact minimum top-up, and solver runtime. Runtime is informational and hardware-dependent.

Run it from the repository root:

```sh
npm run test:benchmark
npm run benchmark
```

`npm run benchmark` writes the machine-readable result to [`evidence/competitive-benchmark.json`](../evidence/competitive-benchmark.json). Amounts in that file are integer benchmark units, not yoctoNEAR and not a financial forecast.

## Preserved results

| Scenario | Independent nominal | Threshold nominal | PACT valid | PACT allocated | Exact top-up for all targets |
| --- | ---: | ---: | ---: | ---: | ---: |
| Cyclic dependencies | 4 | 3 | 3 | 10 | 1 |
| Competing coalitions | 4 | 3 | 2 | 10 | 5 |
| Restricted budgets | 3 | 2 | 2 | 8 | 1 |
| Mutual conditions | 3 | 3 | 3 | 12 | 0 |
| Infeasible network | 2 | 2 | 1 | 4 | 2 |
| Large realistic network (8/12 bound) | 8 | 8 | 8 | 29 | 0 |

The table is intentionally not a “more projects is always better” claim. In the cyclic case, independent evaluation double-counts a flexible pledge and reports four nominal projects while allocating 13 units from 12. In the competing-cycle case, the threshold pool can report three nominal projects, but PACT's valid certificate funds only two because the third pledge cannot fund both members of the other dependency cycle. PACT's differentiator in these examples is executable constraint validation and a conserved one-use allocation, not a promise to activate more projects.

The independent exhaustive oracle in the benchmark checks the PACT ranking for the five oracle-eligible bounded scenarios. The 8-project/12-pledge scenario is measured for scale but is not independently re-enumerated in the benchmark test because the reference solver is already at its declared practical bound.

## Prior art and honest differentiation

- [Gitcoin Commitment Pooling](https://gitcoin.co/mechanisms/commitment-pooling) describes conditional pledges that move only when a shared threshold is reached. PACT is related in its commitment-before-settlement model, but adds per-project eligibility, cross-project dependencies, conditions, one-use allocation certificates and native escrow settlement.
- [Gitcoin Funding Mechanisms](https://gitcoin.co/mechanisms) distinguishes Commitment Pooling from Coalitional Funding. PACT's current prototype should be understood as an executable, bounded coalition-allocation layer, not as a replacement for Gitcoin's broader programs or governance.
- [Gitcoin Grants](https://gitcoin.co/program) uses applications, review, crowdfunding and quadratic matching. PACT does not implement quadratic matching or a matching pool.
- [Deep Funding](https://www.deepfunding.org/) models dependency graphs and allocates weights using model and reviewer judgment. PACT shares the dependency-graph framing, but its current solver is a bounded feasibility/allocation verifier rather than an impact-ranking or human/AI funding-weights system.
- [Codo: A System for Crowdfunding Conditional Donations](https://chenjay.org/publications/uist15-beltran.pdf) explores conditional donations and formalizes conditions as linear inequalities. It is close conceptual prior art for conditional funding; PACT's implementation difference is a NEAR-native escrow state machine with exact pledge-index certificates and refundable settlement, not a claim of inventing conditional crowdfunding.
- [Coalition Formation and Public Goods](https://onlinelibrary.wiley.com/doi/epdf/10.1111/jpet.70037) studies coalition formation and coordinated contribution behavior. It supports the economic motivation for coalitions but is not a software implementation comparison.

The defensible current differentiation is therefore:

- a small, inspectable NEAR contract that can verify and retain an allocation certificate;
- an exact bounded counterfactual explanation that reports blocked reasons and a narrow minimum-top-up calculation;
- explicit separation between DAO-approved conditions, model-only what-if analysis and signed on-chain state;
- reproducible local Sputnik governance and accounting evidence.

These are product and integration differentiators, not novel mathematics, an external audit, a production guarantee or proof of superior capital efficiency. The solver is exponential and bounded; fair coalition selection, large-scale optimization, confidentiality, project delivery and callback non-execution recovery remain open.

## Reproduction and review boundary

The benchmark is independent of the browser UI and does not fabricate blockchain activity. Its results must not be shown as testnet transactions. Sandbox receipts remain in [`evidence/pact-atlas-sandbox-evidence.json`](../evidence/pact-atlas-sandbox-evidence.json), while this benchmark remains a model-level comparison. A qualified external auditor has not reviewed the contract.
