# PACT Atlas — Social Money submission

PACT Atlas coordinates community funding when projects and supporters have conditions.

Most fundraising tools show whether each project has reached its target. PACT solves a more difficult question: **Can a group of interdependent projects be funded together, without counting anyone's contribution twice?**

Communities create projects with goals and dependencies. A supporter can restrict their pledge to particular projects or require another project to receive funding first. PACT's solver produces a reproducible allocation certificate; the NEAR contract independently checks the conditions before activation. Unused contributions become refundable if the campaign expires.

**Real public testnet proof:** Our featured two-project campaign funded Alpha and Beta, with Beta dependent on Alpha. Beta's conditional pledge arrived first, Alpha's pledge second. The contract accepted the certificate `[1 → alpha, 0 → beta]`; both beneficiaries withdrew, and final liabilities were zero. A separate expired campaign refunded its 1 NEAR contribution. Each payment and withdrawal has an individually accessible explorer receipt.

The application opens on a real campaign workspace, not fictional donations: a curated public testnet campaign directory, the authenticated onchain campaign reader, a blank creator, and a transaction activity timeline with individual explorer receipts. A successfully deployed campaign can be rediscovered from its saved browser draft; its current status is only shown as verified after the code hash, immutable configuration and finalized accounting match.

**Scope and limitations:** These are genuine faucet-funded NEAR testnet transactions signed with disposable CLI keys. Meteor, Sender and Nightly browser extension signing has not yet been verified. Public Sputnik governance is sandbox-tested, not demonstrated on public testnet. A missing withdrawal callback may strand a pending claim, so production funds are unsupported. No independent qualified security audit has been performed. The simulated planning view is not a transfer of funds.
