#!/usr/bin/env node
/**
 * Independent offline verification of a PACT Campaign Lab export.
 * Never connects to a wallet, chain, or network.
 */
import { readFile } from "node:fs/promises";
import { solveCampaign, verifyCampaignAllocation } from "../web/campaign-solver.mjs";

const filepath=process.argv[2];
if(!filepath){
  console.error("Usage: node scripts/verify-campaign.js <pact-campaign-proof.json>");
  process.exit(2);
}
try {
  const raw=JSON.parse(await readFile(filepath,"utf8"));
  if(raw?.schema!=="pact-offline-campaign-v1"||raw?.network!=="OFFLINE-NOT-ONCHAIN"){
    throw new Error("Unrecognized or non-offline campaign export.");
  }
  const result=solveCampaign(raw.scenario);
  if(result.status!==raw.result)throw new Error("Saved status differs from independently recomputed result.");
  if(result.status==="fundable"){
    const received=raw.certificate;
    if(!received||received.network!=="OFFLINE-NOT-ONCHAIN")
      throw new Error("Missing or mislabeled offline certificate.");
    const witness=verifyCampaignAllocation(raw.scenario,received.allocations);
    if(!witness.valid)throw new Error("Certificate invalid: "+witness.errors.join("; "));
    if(JSON.stringify(received.allocations)!==JSON.stringify(result.certificate.allocations))
      throw new Error("Exported allocation differs from deterministic recomputation.");
    if(received.assigned!==result.certificate.assigned||received.unused!==result.certificate.unused)
      throw new Error("Exported financial totals differ from recomputed totals.");
    console.log("VALID LOCAL CERTIFICATE: "+result.certificate.assigned+" NEAR allocated, "+
      result.certificate.unused+" NEAR unassigned. No onchain transaction verified.");
  }else{
    if(raw.certificate!==null)throw new Error("A blocked/invalid case must not include a certificate.");
    console.log("REPRODUCED "+result.status.toUpperCase()+": "+(result.reason||result.errors.join("; ")));
  }
}catch(error){
  console.error("VERIFICATION FAILED: "+error.message);
  process.exitCode=1;
}
