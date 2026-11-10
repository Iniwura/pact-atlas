# Submission description — Social Money

PACT Atlas helps independent communities coordinate conditional funding without
double-counting commitments. A campaign can describe projects, dependencies,
contributor restrictions and immutable activation authorities. The browser
solver explains which coalitions are feasible and produces a bounded,
reproducible allocation certificate. The native-NEAR contract independently
checks that certificate, preserves canonical pledge records, settles valid
beneficiary credits and refunds expired commitments.

The release includes genuine faucet-funded NEAR testnet evidence: an activated
campaign, an expired/refunded campaign, and a two-project coalition where beta
depends on alpha. Two contributors pledged out of order; the contract accepted
the exact certificate and both beneficiaries withdrew. Final liabilities were
zero. NEAR matters because the agreement, attached native funds, authorization,
finality and settlement evidence are inspectable on a public chain rather than
being represented by a dashboard-only simulation.

This is a bounded testnet prototype, not production financial software. Real
Meteor browser signing, public Sputnik governance, missing-callback recovery,
native-transfer failure injection and independent qualified audit remain
explicit limitations.
