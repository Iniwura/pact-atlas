import assert from "node:assert/strict";
import test from "node:test";
import { campaignShareToken, campaignFromShareToken, ONE_NEAR, PACT_NEAR_CODE_HASH } from "../campaign-chain.mjs";
import { authenticateCampaignConfig, candidateFromOnchainPledges } from "../campaign-live-data.mjs";

const timing = { activateAfterMs: 10_000, deadlineMs: 20_000 };
const campaign = {
  title: "River Commons",
  projects: [
    { id: "alpha", name: "Community Wi-Fi", goal: 1, dependencies: [], beneficiary: "alpha.testnet" },
    { id: "beta", name: "Training room", goal: 1, dependencies: [], beneficiary: "beta.testnet" },
  ],
  supporters: [
    { id: "planned-a", name: "Wrong planned owner", amount: 1, allowed: ["alpha"], requires: [] },
    { id: "planned-b", name: "Wrong planned owner", amount: 1, allowed: ["beta"], requires: [] },
  ],
  deployment: { authority: "authority.testnet", timing },
};

const config = {
  projects: campaign.projects.map(project => ({ id: project.id, beneficiary: project.beneficiary, required: String(BigInt(project.goal) * ONE_NEAR), dependencies: project.dependencies })),
  deadline_ms: timing.deadlineMs,
  activate_after_ms: timing.activateAfterMs,
  min_funded_projects: 2,
  required_for_activation: ["alpha", "beta"],
  activation_authorities: ["authority.testnet"],
};

test("candidate certificates use canonical onchain indexes and handle contributions arriving out of order", () => {
  const token = campaignFromShareToken(campaignShareToken(campaign));
  const result = candidateFromOnchainPledges(token, [
    { index: 1, owner: "second.testnet", amount: String(ONE_NEAR), allowed: ["beta"], requires: [] },
    { index: 0, owner: "first.testnet", amount: String(ONE_NEAR), allowed: ["alpha"], requires: [] },
  ]);
  assert.equal(result.result.status, "fundable");
  assert.deepEqual(result.allocations, [
    { pledge_index: 0, project_id: "alpha" },
    { pledge_index: 1, project_id: "beta" },
  ]);
  assert.deepEqual(result.supporters.map(supporter => supporter.name), ["first.testnet", "second.testnet"]);
});

test("wrong onchain amount or restriction fails closed instead of using planned supporter data", () => {
  const token = campaignFromShareToken(campaignShareToken(campaign));
  assert.throws(() => candidateFromOnchainPledges(token, [
    { index: 0, owner: "first.testnet", amount: String(2n * ONE_NEAR), allowed: ["alpha"], requires: [] },
    { index: 1, owner: "second.testnet", amount: "0", allowed: ["beta"], requires: [] },
  ]), /amount|supported/i);
});

test("immutable facts and pinned code hash are required before chain controls are trusted", () => {
  const token = campaignFromShareToken(campaignShareToken(campaign));
  assert.equal(authenticateCampaignConfig(token, config, PACT_NEAR_CODE_HASH).valid, true);
  assert.equal(authenticateCampaignConfig(token, { ...config, projects: [{ ...config.projects[0], beneficiary: "attacker.testnet" }, config.projects[1]] }, PACT_NEAR_CODE_HASH).valid, false);
  assert.equal(authenticateCampaignConfig(token, config, "unknown-code-hash").valid, false);
});
