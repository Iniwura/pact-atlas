#!/usr/bin/env node
/**
 * Independent read-only PACT / NEAR testnet proof verification.
 * No key material, wallet approval, or token movement.
 *
 * Usage:
 *   npm run verify:testnet -- pact-rc1.testnet signer.testnet TRANSACTION_HASH commit
 */
import { verifyTestnetProof, ALLOWED_METHODS } from "../web/testnet-proof.mjs";
const [, , contractId, signerId, transactionHash, method] = process.argv;
if (!contractId || !signerId || !transactionHash || !method) {
  console.error("Usage: npm run verify:testnet -- <contract.testnet> <signer.testnet> <base58-hash> <" +
    ALLOWED_METHODS.join("|") + ">");
  process.exitCode = 2;
} else {
  const result = await verifyTestnetProof({ contractId, signerId, transactionHash, method });
  if (result.verified) {
    console.log("VERIFIED NEAR TESTNET PACT EXECUTION");
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.error("NOT VERIFIED: " + result.reason);
    process.exitCode = 1;
  }
}
