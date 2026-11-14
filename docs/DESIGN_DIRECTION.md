# PACT Atlas design direction

## Release scope

This is the frontend direction for the frozen PACT Atlas engineering release. It preserves the verified solver, accounting, transaction boundary, sandbox evidence and approved visual system; the current release adds only read-only `campaign_config()` and `pledge_records()` views needed to authenticate live campaign data. The interface is still a local, sandbox-backed product preview; it does not imply testnet activity or an external audit.

## Design thesis: signal / proof

PACT Atlas should feel like an instrument for seeing cooperation become possible, not a generic crypto dashboard. The visual language uses an editorial split:

- **Signal** is the network: commitments, dependencies, blocked routes and the moment a coalition becomes viable.
- **Proof** is the ledger: exact certificates, liabilities, receipt hashes, network status and the boundary between model-only changes and chain evidence.

The page follows the judge’s mental sequence:

1. **See the problem** — the first viewport shows the five commitments, the A+B+C dependency core, and the 12N → 10N → 2N funding story.
2. **Find the coalition** — the counterfactual engine makes the blocked full coalition and its minimum intervention explicit.
3. **Inspect the promises** — the graph and commitment inspector expose permissions, conditions and dependencies without hiding them in a tooltip.
4. **Make it executable** — the workflow rail presents the real NEAR action sequence while keeping unsigned/read-only states visibly separate.
5. **Inspect the proof** — the evidence ledger exposes genuine local sandbox records, hashes and zero-liability settlement states.

## Reference principles

The direction borrows principles, not layouts, from the supplied references: Neiden’s confident typographic pacing and direct navigation; Möbius’s restraint and purposeful motion; Jiro’s emphasis on clear interaction patterns; Awwwards’ editorial composition; and 60fps’s rule that motion should communicate a state change. The references were reviewed on 2026-11-02: [Neiden](https://neiden.framer.media/), [Jiro](https://jiro.build/), [Möbius](https://mobius.framer.website/), [Awwwards](https://www.awwwards.com/), [60fps](https://60fps.design/). Godly was unavailable to the research tool and is not treated as an inspected source.

## System

- **Foundation:** near-black ink, fine blue-grey rules, no purple gradients, no decorative stock imagery.
- **Typography:** a high-contrast serif for the thesis and result states; a compact neutral grotesk for navigation and body copy; monospace for hashes, units and evidence labels.
- **Color semantics:** acid green means an exact/verified state; electric blue means a dependency or selected route; amber means an approved-condition or model-only caution; coral means blocked or failed. Color is always paired with text.
- **Composition:** generous negative space around the narrative, dense information only where it earns inspection, and a small number of durable panels instead of repeated dashboard cards.
- **Graph behavior:** nodes are keyboard-focusable, selection updates the inspector, and route animation is limited to dependency/selection state. It is not ambient decoration.
- **Motion:** short opacity/translate transitions for selection, result changes and wallet status; `prefers-reduced-motion` disables movement. No perpetual attention loop is required to understand the product.
- **Responsive behavior:** the graph stays central on mobile, controls stack in task order, the proof ledger remains readable without horizontal scrolling, and wallet state is never hidden behind hover.

## Content rules

The preview labels local sandbox evidence plainly. Baseline “more projects” results are never presented as successful activations. Counterfactual changes remain model-only until a DAO approves them. Unproven optimum, liveness and testnet claims stay out of the interface.

## Quality gate

Every design iteration is checked in a real browser at desktop and narrow mobile widths. The acceptance bar is: first-viewport comprehension, readable graph relationships, keyboard-operable controls, no console/page errors, no serious/critical automated accessibility violations, no horizontal overflow, and a measured local load budget. The visual redesign does not alter the frozen engineering verification suite.
