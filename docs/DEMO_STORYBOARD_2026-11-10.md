# PACT Atlas | 90–120 second judge demo

This is a truthful storyboard for the current release candidate. Use the real
public testnet coalition campaign and show explorer links or the local verifier
when a transaction is discussed. Do not imply that the static preview has a
wallet session or that CLI-signed evidence was produced by Meteor.

| Time | Screen/action | Judge takeaway |
| --- | --- | --- |
| 0–10s | Open the preserved cinematic homepage, then choose **Explore the Atlas**. | PACT Atlas maps communities, commitments and dependencies around a concrete funding problem. |
| 10–25s | Open `/console`, select the prepared Coalition Atlas scenario, and point to the dependency graph and **Blocked / Feasible** explanation. | The product explains why independent funding misses a network and what additional condition or capital would change it. |
| 25–40s | Open `/create.html`, show two projects and a conditional supporter restriction, run **Check funding**, then download the verification JSON. | The counterfactual is exact for the bounded input and is reproducible offline; no simulation is presented as a payment. |
| 40–55s | Open the public campaign link for `coalition-20261110.beneficiary-20261110.testnet`. Show finalized status, immutable config, pledge records and the dependency `beta → alpha`. | The live page authenticates the deployed contract and derives the candidate from canonical onchain pledge records. |
| 55–75s | Open the coalition manifest and one `/verify.html` proof. Follow the beta contribution, alpha contribution and activation explorer links. | Two independent contributors pledged out of order; the authority accepted `[1 → alpha, 0 → beta]`, not a fabricated UI allocation. |
| 75–92s | Show the two withdrawal receipts and the final accounting block. | Both beneficiaries settled and the final contract state reports zero liabilities, zero pending and `solvent: true`. |
| 92–108s | Show the refund campaign link/evidence, then the limitations panel. | Expired commitments refund separately; callback non-execution, Meteor browser signing, Sputnik public governance and audit status are stated plainly. |
| 108–120s | End on the evidence index and judge instructions. | Every claim has a source, explorer receipt or reproducible local command. |

## Evidence to keep visible

- [Coalition contract](https://testnet.nearblocks.io/address/coalition-20261110.beneficiary-20261110.testnet)
- [Coalition evidence manifest](../evidence/pact-atlas-testnet-coalition-evidence-2026-11-10.json)
- [Read-only proof verifier](../verify.html)
- `npm run verify:testnet -- coalition-20261110.beneficiary-20261110.testnet supporter-20261110.testnet 8t22n71EQDb5WCswgLu7MUH3aVeyoFaCVdKgtQBUVje3 commit`

The browser wallet boundary is a prepared, fail-closed workflow. The public
chain evidence in this storyboard was signed by isolated disposable CLI
identities, not by an automated browser wallet session.
