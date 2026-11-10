import { validateCampaign } from "./campaign-solver.mjs";

export const ONE_NEAR = 1_000_000_000_000_000_000_000_000n;
export const TESTNET_GAS = "300000000000000";
export const DEPLOYMENT_TRANSFER = 300_000_000_000_000_000_000_000n;
export const STORAGE_SPONSOR = 300_000_000_000_000_000_000_000n;
export const PACT_WASM_SHA256 = "7329d40af43d7e4d6cd3ff942cbe31ba9c54124e667a9af0233e63fa9020d103";

const ACCOUNT = /^(?:(?:[a-z0-9_-]+\.)+testnet|[0-9a-f]{64})$/;
const NAMED_ACCOUNT = /^(?:[a-z0-9_-]+\.)+testnet$/;
const SLUG = /^[a-z][a-z0-9-]{1,31}$/;
const PROJECT_ID = /^[a-z][a-z0-9]{0,11}$/;

const unique = values => new Set(values).size === values.length;

export function isTestnetAccount(value) {
  return typeof value === "string" && value.length <= 64 && ACCOUNT.test(value);
}

export function isNamedTestnetAccount(value) {
  return typeof value === "string" && value.length <= 64 && NAMED_ACCOUNT.test(value);
}

export function slugFor(value) {
  const slug = String(value ?? "campaign")
    .trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "").slice(0, 32);
  return SLUG.test(slug) ? slug : "campaign-lab";
}

function yoctoFromNear(value) {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error("Goals and commitments must be whole NEAR amounts.");
  return (BigInt(value) * ONE_NEAR).toString();
}

function timingFor(timing = {}, now = Date.now()) {
  const activateDelayMs = Number.isSafeInteger(timing.activateDelayMs) ? timing.activateDelayMs : 5 * 60 * 1000;
  const deadlineDelayMs = Number.isSafeInteger(timing.deadlineDelayMs) ? timing.deadlineDelayMs : 24 * 60 * 60 * 1000;
  if (activateDelayMs < 60_000) throw new Error("Activation must be at least one minute after deployment.");
  if (deadlineDelayMs <= activateDelayMs) throw new Error("The campaign deadline must be after activation opens.");
  return { activateAfterMs: now + activateDelayMs, deadlineMs: now + deadlineDelayMs };
}

export function validateDeployableCampaign(campaign, { owner, authority, slug, timing, now = Date.now() } = {}) {
  const errors = validateCampaign(campaign);
  if (!isNamedTestnetAccount(owner)) errors.push("Connect an explicit named *.testnet wallet account to deploy a campaign subaccount.");
  if (authority && !isTestnetAccount(authority)) errors.push("Activation authority must be a *.testnet or implicit testnet account.");
  if (!SLUG.test(slug ?? "")) errors.push("Campaign account slug must be 2–32 lowercase letters, numbers or hyphens.");
  for (const project of campaign?.projects?.filter(item => item?.included !== false) ?? []) {
    if (!PROJECT_ID.test(project.id ?? "")) errors.push(`${project.name || "Project"}: invalid onchain project ID.`);
    if (!isTestnetAccount(project.beneficiary)) errors.push(`${project.name || "Project"}: add the beneficiary's *.testnet account.`);
  }
  try { timingFor(timing, now); } catch (error) { errors.push(error.message); }
  const campaignId = owner && slug ? `${slug}.${owner}` : "";
  if (campaignId.length > 64) errors.push("The generated campaign account ID is longer than 64 characters.");
  return [...new Set(errors)];
}

function publicProjects(campaign) {
  return campaign.projects.filter(project => project?.included !== false).map(project => ({
    id: project.id,
    name: project.name,
    goal: project.goal,
    dependencies: [...project.dependencies],
    beneficiary: project.beneficiary || null,
  }));
}

export function publicCampaignConfig(campaign) {
  return {
    schema: "pact-public-campaign-v1",
    title: campaign.title,
    projects: publicProjects(campaign),
    supporters: campaign.supporters.map(supporter => ({
      id: supporter.id,
      name: supporter.name,
      amount: supporter.amount,
      allowed: [...supporter.allowed],
      requires: [...supporter.requires],
    })),
    activationAuthority: campaign.deployment?.authority || null,
  };
}

function encodeBase64Url(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value) {
  const padded = String(value).replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, character => character.charCodeAt(0))));
}

export function campaignShareToken(campaign) {
  return encodeBase64Url(publicCampaignConfig(campaign));
}

export function campaignFromShareToken(token) {
  let value;
  try { value = decodeBase64Url(token); } catch {
    throw new Error("This campaign link is incomplete or invalid.");
  }
  if (value?.schema !== "pact-public-campaign-v1" || !Array.isArray(value.projects) || value.projects.length < 1 || value.projects.length > 5 || !Array.isArray(value.supporters) || value.supporters.length > 8) {
    throw new Error("This campaign link is incomplete or invalid.");
  }
  return value;
}

export function campaignUrl(contractId, campaign, origin = globalThis.location?.href ?? "http://127.0.0.1:4173/create.html") {
  const url = new URL("/campaign", new URL(origin).origin);
  url.searchParams.set("contract", contractId);
  url.searchParams.set("config", campaignShareToken(campaign));
  return url.toString();
}

export function buildCampaignDeploymentRequest(campaign, { owner, authority = owner, slug, timing, wasm, now = Date.now() } = {}) {
  const errors = validateDeployableCampaign(campaign, { owner, authority, slug, timing, now });
  if (errors.length) throw new Error(errors[0]);
  if (!(wasm instanceof Uint8Array) || wasm.length < 1000) throw new Error("The preserved PACT Wasm could not be loaded.");
  const { activateAfterMs, deadlineMs } = timingFor(timing, now);
  const campaignId = `${slug}.${owner}`;
  const projects = publicProjects(campaign).map(project => ({
    id: project.id,
    beneficiary: project.beneficiary,
    required: yoctoFromNear(project.goal),
    dependencies: project.dependencies,
  }));
  return {
    kind: "deploy-campaign",
    contractId: campaignId,
    signerId: owner,
    actions: [
      { type: "CreateAccount" },
      { type: "Transfer", deposit: DEPLOYMENT_TRANSFER.toString() },
      { type: "DeployContract", code: wasm },
      { type: "FunctionCall", methodName: "new", args: {
        projects,
        deadline_ms: deadlineMs,
        activate_after_ms: activateAfterMs,
        min_funded_projects: projects.length,
        required_for_activation: projects.map(project => project.id),
        activation_authorities: [authority],
      }, gas: TESTNET_GAS, deposit: "0" },
      { type: "FunctionCall", methodName: "sponsor_storage", args: {}, gas: TESTNET_GAS, deposit: STORAGE_SPONSOR.toString() },
    ],
    campaignId,
    publicConfig: publicCampaignConfig({ ...campaign, deployment: { ...campaign.deployment, authority } }),
    estimatedAttachedNear: Number(DEPLOYMENT_TRANSFER + STORAGE_SPONSOR) / Number(ONE_NEAR),
    timing: { activateAfterMs, deadlineMs },
  };
}

export function buildCampaignCommitRequest({ contractId, amountNear, allowed, requires = [] } = {}) {
  if (!isTestnetAccount(contractId)) throw new Error("A dedicated *.testnet campaign account is required.");
  if (!Number.isSafeInteger(amountNear) || amountNear < 1 || amountNear > 100) throw new Error("Contribution must be 1–100 whole NEAR in this release.");
  if (!Array.isArray(allowed) || !allowed.length || !unique(allowed)) throw new Error("Choose at least one permitted project.");
  if (!Array.isArray(requires) || !unique(requires)) throw new Error("Choose each condition at most once.");
  return { contractId, methodName: "commit", args: { allowed, requires }, deposit: yoctoFromNear(amountNear), gas: TESTNET_GAS };
}

export function buildCampaignActivationRequest({ contractId, allocations } = {}) {
  if (!isTestnetAccount(contractId)) throw new Error("A dedicated *.testnet campaign account is required.");
  if (!Array.isArray(allocations)) throw new Error("An exact allocation certificate is required.");
  return { contractId, methodName: "activate", args: { allocations }, deposit: "0", gas: TESTNET_GAS };
}

export function buildCampaignExpireRequest(contractId) {
  if (!isTestnetAccount(contractId)) throw new Error("A dedicated *.testnet campaign account is required.");
  return { contractId, methodName: "expire", args: {}, deposit: "0", gas: TESTNET_GAS };
}

export function buildCampaignWithdrawRequest(contractId) {
  if (!isTestnetAccount(contractId)) throw new Error("A dedicated *.testnet campaign account is required.");
  return { contractId, methodName: "withdraw", args: {}, deposit: "0", gas: TESTNET_GAS };
}

export function liveCampaignViews(contractId, accountId = null) {
  if (!isTestnetAccount(contractId)) throw new Error("A dedicated *.testnet campaign account is required.");
  const views = [
    { contractId, methodName: "status", args: {} },
    { contractId, methodName: "accounting", args: {} },
    { contractId, methodName: "activation_certificate", args: {} },
  ];
  if (accountId && isTestnetAccount(accountId)) views.push(
    { contractId, methodName: "claimable", args: { account_id: accountId } },
    { contractId, methodName: "pending_withdrawal", args: { account_id: accountId } },
  );
  return views;
}

export { yoctoFromNear };
