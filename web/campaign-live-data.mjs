import { solveCampaign } from "./campaign-solver.mjs";
import { ONE_NEAR, PACT_NEAR_CODE_HASH, isTestnetAccount } from "./campaign-chain.mjs";

const MAX_PLEDGES = 32;
const YOCTO = /^\d+$/;

const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function immutableFromChain(config) {
  if (!config || !Array.isArray(config.projects)) return null;
  return {
    projects: config.projects.map(project => ({
      id: project.id,
      beneficiary: project.beneficiary,
      required: String(project.required),
      dependencies: [...(project.dependencies || [])],
    })),
    deadlineMs: Number(config.deadline_ms),
    activateAfterMs: Number(config.activate_after_ms),
    minFundedProjects: Number(config.min_funded_projects),
    requiredForActivation: [...(config.required_for_activation || [])],
    activationAuthorities: [...(config.activation_authorities || [])],
  };

}

function tokenProjectFacts(campaign) {
  return campaign.projects.map(project => ({
    id: project.id,
    beneficiary: project.beneficiary,
    required: String(BigInt(project.goal) * ONE_NEAR),
    dependencies: [...(project.dependencies || [])],
  }));
}

function validateTokenInternal(campaign) {
  const errors = [];
  const immutable = campaign?.immutable;
  if (!immutable) return ["The share link has no immutable campaign binding."];
  if (!same(tokenProjectFacts(campaign), immutable.projects)) errors.push("The share link's displayed project facts are internally inconsistent.");
  if (!Number.isSafeInteger(immutable.deadlineMs) || !Number.isSafeInteger(immutable.activateAfterMs)) errors.push("The share link has invalid campaign timing.");
  if (!Array.isArray(immutable.activationAuthorities) || !immutable.activationAuthorities.every(isTestnetAccount)) errors.push("The share link has invalid activation authority facts.");
  return errors;
}

/**
 * Compare only immutable contract facts. Project names and supporter labels are
 * presentation metadata; IDs, beneficiaries, exact requirements, dependencies,
 * timing and authority are the values that control money and activation.
 */
export function authenticateCampaignConfig(campaign, onchainConfig, codeHash) {
  const errors = validateTokenInternal(campaign);
  if (codeHash !== PACT_NEAR_CODE_HASH) errors.push("This account is not running the pinned PACT Wasm build.");
  const actual = immutableFromChain(onchainConfig);
  if (!actual) errors.push("The deployed contract did not return immutable campaign configuration.");
  else if (!same(campaign.immutable, actual)) errors.push("The public campaign configuration does not match immutable contract state.");
  return { valid: errors.length === 0, errors, actual };
}

function normalizePledges(records, projects) {
  if (!Array.isArray(records) || records.length > MAX_PLEDGES) throw new Error("The deployed contract returned invalid pledge records.");
  const sorted = [...records].sort((left, right) => Number(left?.index) - Number(right?.index));
  const knownProjects = new Set(projects.map(project => project.id));
  return sorted.map((record, position) => {
    if (!Number.isInteger(record?.index) || record.index !== position) throw new Error("Onchain pledge indexes are not canonical.");
    if (!isTestnetAccount(record.owner)) throw new Error("An onchain pledge has an invalid contributor account.");
    if (!YOCTO.test(String(record.amount))) throw new Error("An onchain pledge has an invalid amount.");
    const amount = BigInt(record.amount);
    if (amount < ONE_NEAR || amount % ONE_NEAR !== 0n) throw new Error("A pledge amount is not a supported whole-NEAR commitment.");
    if (!Array.isArray(record.allowed) || !record.allowed.length || new Set(record.allowed).size !== record.allowed.length || record.allowed.some(id => !knownProjects.has(id))) throw new Error("An onchain pledge has invalid project permissions.");
    if (!Array.isArray(record.requires) || new Set(record.requires).size !== record.requires.length || record.requires.some(id => !knownProjects.has(id))) throw new Error("An onchain pledge has invalid conditions.");
    const whole = amount / ONE_NEAR;
    if (whole > 100n) throw new Error("An onchain pledge exceeds the supported campaign amount limit.");
    return {
      id: `pledge${position}`,
      name: record.owner,
      amount: Number(whole),
      allowed: [...record.allowed],
      requires: [...record.requires],
      pledgeIndex: record.index,
    };
  });
}

/** Build a candidate from finalized chain pledge records, never planned labels. */
export function candidateFromOnchainPledges(campaign, records) {
  const supporters = normalizePledges(records, campaign.projects);
  if (!supporters.length) return { result: null, allocations: null, supporters };
  const result = solveCampaign({ title: campaign.title, projects: campaign.projects, supporters });
  if (result.status !== "fundable") return { result, allocations: null, supporters };
  const byId = new Map(supporters.map(supporter => [supporter.id, supporter]));
  const allocations = result.certificate.allocations.map(row => ({
    pledge_index: byId.get(row.supporterId).pledgeIndex,
    project_id: row.projectId,
  }));
  return { result, allocations, supporters };
}

export { immutableFromChain };
