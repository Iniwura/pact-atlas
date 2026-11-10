import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCampaignCommitRequest,
  buildCampaignDeploymentRequest,
  campaignUrl,
  campaignFromShareToken,
  campaignShareToken,
  validateDeployableCampaign,
} from "../campaign-chain.mjs";

const campaign = {
  title: "Riverside Hub",
  projects: [
    { id: "p1", name: "Library", goal: 3, dependencies: [], beneficiary: "library.testnet", included: true },
    { id: "p2", name: "Shelves", goal: 2, dependencies: [], beneficiary: "shelves.testnet", included: true },
  ],
  supporters: [
    { id: "s1", name: "Alex", amount: 3, allowed: ["p1"], requires: [] },
    { id: "s2", name: "Bola", amount: 2, allowed: ["p2"], requires: [] },
  ],
};

test("custom campaign validates for a named testnet owner and beneficiaries", () => {
  assert.deepEqual(validateDeployableCampaign(campaign, {
    owner: "alice.testnet",
    authority: "alice.testnet",
    slug: "riverside-hub",
    timing: { activateDelayMs: 60_000, deadlineDelayMs: 3_600_000 },
    now: 1_000,
  }), []);
});

test("deployment request is an explicit multi-action testnet transaction", () => {
  const request = buildCampaignDeploymentRequest(campaign, {
    owner: "alice.testnet",
    authority: "authority.testnet",
    slug: "riverside-hub",
    timing: { activateDelayMs: 60_000, deadlineDelayMs: 3_600_000 },
    wasm: new Uint8Array(2_000),
    now: 1_000,
  });
  assert.equal(request.contractId, "riverside-hub.alice.testnet");
  assert.deepEqual(request.actions.map(action => action.type), ["CreateAccount", "Transfer", "DeployContract", "FunctionCall", "FunctionCall"]);
  assert.equal(request.actions[3].methodName, "new");
  assert.equal(request.actions[3].args.activation_authorities[0], "authority.testnet");
  assert.equal(request.actions[4].methodName, "sponsor_storage");
  assert.equal(request.estimatedAttachedNear, 0.6);
});

test("share links round-trip public campaign configuration without secrets", () => {
  const decoded = campaignFromShareToken(campaignShareToken(campaign));
  assert.equal(decoded.title, "Riverside Hub");
  assert.equal(decoded.projects[1].beneficiary, "shelves.testnet");
  assert.equal(decoded.supporters[0].allowed[0], "p1");
  assert.match(campaignUrl("riverside-hub.alice.testnet", campaign, "https://preview.example/create.html"), /^https:\/\/preview\.example\/campaign\?/);
});

test("deployment and commit builders reject mainnet or malformed targets", () => {
  assert.throws(() => buildCampaignDeploymentRequest(campaign, {
    owner: "alice.near", authority: "alice.near", slug: "riverside-hub", wasm: new Uint8Array(2_000),
  }), /testnet/i);
  assert.throws(() => buildCampaignCommitRequest({ contractId: "riverside-hub.near", amountNear: 3, allowed: ["p1"] }), /testnet/i);
  assert.throws(() => campaignFromShareToken("not-a-campaign-token"), /incomplete or invalid/i);
});
