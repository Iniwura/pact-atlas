/**
 * Reproducible competitive benchmark model.
 *
 * This module deliberately compares capabilities, not marketing claims:
 * - independent: every project sees the whole eligible pledge set on its own;
 *   pledges may therefore be counted more than once and cross-project rules
 *   are not proven;
 * - threshold pool: one aggregate threshold is checked, without an allocation
 *   certificate, per-project eligibility or dependency closure;
 * - PACT: the bounded exact reference solver, with one-use pledges, exact
 *   targets, conditions and dependency closure.
 *
 * Amounts are integer benchmark units, not NEAR. The benchmark is not a
 * contract execution test and makes no claim about external systems.
 */
import { solve } from './model.js';

const sum = (values) => values.reduce((total, value) => total + value, 0n);
const max = (a, b) => (a > b ? a : b);

function normalizeProject(project) {
  return {
    ...project,
    required: BigInt(project.required),
    deps: [...(project.deps ?? [])],
  };
}

function normalizePledge(pledge) {
  return {
    ...pledge,
    amount: BigInt(pledge.amount),
    allowed: [...pledge.allowed],
    requires: [...(pledge.requires ?? [])],
  };
}

function scenario(name, projects, pledges, options = {}) {
  return {
    name,
    projects: projects.map(normalizeProject),
    pledges: pledges.map(normalizePledge),
    oracleEligible: options.oracleEligible ?? true,
    targetProjects: options.targetProjects ?? projects.map((project) => project.id),
    description: options.description ?? '',
  };
}

export function benchmarkScenarios() {
  return [
    scenario(
      'cyclic-dependencies',
      [
        { id: 'A', required: 4, deps: [] },
        { id: 'B', required: 3, deps: ['A'] },
        { id: 'C', required: 3, deps: ['A'] },
        { id: 'D', required: 3, deps: [] },
      ],
      [
        { owner: 'p0', amount: 3, allowed: ['A', 'D'], requires: [] },
        { owner: 'p1', amount: 1, allowed: ['A'], requires: ['B', 'C'] },
        { owner: 'p2', amount: 3, allowed: ['B'], requires: ['A'] },
        { owner: 'p3', amount: 3, allowed: ['C'], requires: ['A'] },
        { owner: 'p4', amount: 2, allowed: ['D'], requires: [] },
      ],
      { description: 'A/B/C form a cyclic coalition; D competes for a flexible pledge.' },
    ),
    scenario(
      'competing-coalitions',
      [
        { id: 'A', required: 5, deps: ['B'] },
        { id: 'B', required: 5, deps: ['A'] },
        { id: 'C', required: 5, deps: ['D'] },
        { id: 'D', required: 5, deps: ['C'] },
      ],
      [
        { owner: 'p0', amount: 5, allowed: ['A', 'B'], requires: [] },
        { owner: 'p1', amount: 5, allowed: ['A', 'B'], requires: [] },
        { owner: 'p2', amount: 5, allowed: ['C', 'D'], requires: [] },
      ],
      { description: 'Two dependency cycles compete for three one-use pledges.' },
    ),
    scenario(
      'restricted-budgets',
      [
        { id: 'A', required: 4, deps: [] },
        { id: 'B', required: 4, deps: [] },
        { id: 'C', required: 4, deps: [] },
      ],
      [
        { owner: 'p0', amount: 4, allowed: ['A'], requires: [] },
        { owner: 'p1', amount: 3, allowed: ['B'], requires: [] },
        { owner: 'p2', amount: 3, allowed: ['C'], requires: [] },
        { owner: 'p3', amount: 1, allowed: ['B', 'C'], requires: [] },
      ],
      { description: 'Restricted pledges leave an exact one-unit shortfall for all projects.' },
    ),
    scenario(
      'mutual-conditions',
      [
        { id: 'A', required: 4, deps: [] },
        { id: 'B', required: 4, deps: [] },
        { id: 'C', required: 4, deps: [] },
      ],
      [
        { owner: 'p0', amount: 4, allowed: ['A'], requires: ['B'] },
        { owner: 'p1', amount: 4, allowed: ['B'], requires: ['A'] },
        { owner: 'p2', amount: 4, allowed: ['C'], requires: [] },
      ],
      { description: 'A and B are mutually conditional; C is independent.' },
    ),
    scenario(
      'infeasible-network',
      [
        { id: 'A', required: 5, deps: ['B'] },
        { id: 'B', required: 5, deps: ['A'] },
        { id: 'C', required: 4, deps: [] },
      ],
      [
        { owner: 'p0', amount: 5, allowed: ['A'], requires: ['B'] },
        { owner: 'p1', amount: 3, allowed: ['B'], requires: [] },
        { owner: 'p2', amount: 4, allowed: ['C'], requires: [] },
      ],
      { description: 'C is feasible; the A/B cycle needs two additional units.' },
    ),
    scenario(
      'large-realistic',
      [
        { id: 'P0', required: 4, deps: ['P1'] },
        { id: 'P1', required: 3, deps: [] },
        { id: 'P2', required: 5, deps: ['P1'] },
        { id: 'P3', required: 2, deps: [] },
        { id: 'P4', required: 6, deps: ['P2', 'P3'] },
        { id: 'P5', required: 3, deps: ['P3'] },
        { id: 'P6', required: 4, deps: ['P4'] },
        { id: 'P7', required: 2, deps: ['P6'] },
      ],
      [
        { owner: 'p0', amount: 3, allowed: ['P0', 'P2'], requires: ['P1'] },
        { owner: 'p1', amount: 1, allowed: ['P0'], requires: ['P1'] },
        { owner: 'p2', amount: 3, allowed: ['P1'], requires: [] },
        { owner: 'p3', amount: 2, allowed: ['P2'], requires: ['P1'] },
        { owner: 'p4', amount: 3, allowed: ['P2'], requires: ['P1'] },
        { owner: 'p5', amount: 2, allowed: ['P3'], requires: [] },
        { owner: 'p6', amount: 4, allowed: ['P4'], requires: ['P2', 'P3'] },
        { owner: 'p7', amount: 2, allowed: ['P4'], requires: ['P2', 'P3'] },
        { owner: 'p8', amount: 3, allowed: ['P5'], requires: ['P3'] },
        { owner: 'p9', amount: 4, allowed: ['P6'], requires: ['P4'] },
        { owner: 'p10', amount: 2, allowed: ['P7'], requires: ['P6'] },
        { owner: 'p11', amount: 1, allowed: ['P3', 'P5'], requires: [] },
      ],
      {
        oracleEligible: false,
        description: 'Eight projects and twelve pledges model a dependency-heavy program.'
      },
    ),
  ];
}

function totalCapital(pledges) {
  return sum(pledges.map((pledge) => pledge.amount));
}

function metricBase(total, allocated) {
  return {
    totalCapital: total,
    allocated,
    unusedRefundable: max(0n, total - allocated),
    overcommitted: max(0n, allocated - total),
  };
}

export function independentBaseline(projects, pledges) {
  const funded = projects.filter((project) => {
    const eligible = pledges
      .filter((pledge) => pledge.allowed.includes(project.id))
      .reduce((amount, pledge) => amount + pledge.amount, 0n);
    return eligible >= project.required;
  });
  const allocated = sum(funded.map((project) => project.required));
  const hasUnprovenRules = projects.some((project) => project.deps.length > 0)
    || pledges.some((pledge) => pledge.requires.length > 0)
    || pledges.some((pledge) => pledge.allowed.length > 1);
  return {
    ...metricBase(totalCapital(pledges), allocated),
    activatedProjects: funded.length,
    activatedProjectIds: funded.map((project) => project.id),
    constraintSatisfied: !hasUnprovenRules && allocated <= totalCapital(pledges),
    minimumAdditionalFunding: max(0n, sum(projects.map((project) => project.required)) - totalCapital(pledges)),
    minimumAdditionalFundingExact: false,
    semantics: 'independent project totals; shared pledges may be counted repeatedly',
  };
}

function compareProjectSets(a, b, projects) {
  if (a.length !== b.length) return a.length - b.length;
  const aAmount = sum(a.map((id) => projects.find((project) => project.id === id).required));
  const bAmount = sum(b.map((id) => projects.find((project) => project.id === id).required));
  if (aAmount !== bAmount) return aAmount > bAmount ? 1 : -1;
  return a.join(',').localeCompare(b.join(','));
}

export function thresholdPoolBaseline(projects, pledges) {
  const capital = totalCapital(pledges);
  let best = [];
  const walk = (index, picked, required) => {
    if (index === projects.length) {
      if (required <= capital && compareProjectSets(picked, best, projects) > 0) best = [...picked];
      return;
    }
    walk(index + 1, picked, required);
    const project = projects[index];
    if (required + project.required <= capital) {
      picked.push(project.id);
      walk(index + 1, picked, required + project.required);
      picked.pop();
    }
  };
  walk(0, [], 0n);
  const allocated = sum(best.map((id) => projects.find((project) => project.id === id).required));
  const hasUnprovenRules = projects.some((project) => project.deps.length > 0)
    || pledges.some((pledge) => pledge.requires.length > 0)
    || pledges.some((pledge) => pledge.allowed.length > 1);
  return {
    ...metricBase(capital, allocated),
    activatedProjects: best.length,
    activatedProjectIds: best,
    constraintSatisfied: !hasUnprovenRules && allocated <= capital,
    minimumAdditionalFunding: max(0n, sum(projects.map((project) => project.required)) - capital),
    minimumAdditionalFundingExact: false,
    semantics: 'single aggregate threshold; no allocation certificate or dependency proof',
  };
}

function dependencyClosure(projects, ids) {
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const result = new Set(ids);
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of [...result]) {
      for (const dependency of projectById.get(id).deps) {
        if (!result.has(dependency)) {
          result.add(dependency);
          changed = true;
        }
      }
    }
  }
  return result;
}

/**
 * Exact bounded top-up calculation. New capital is modeled as unrestricted
 * per-project top-up, while existing pledges remain one-use and conditional.
 * This answers a deliberately narrow question: the least new capital needed
 * to make the requested project set fundable under current pledges.
 */
export function minimumAdditionalFunding(projects, pledges, requestedIds) {
  const target = dependencyClosure(projects, requestedIds);
  const byId = new Map(projects.map((project) => [project.id, project]));
  let best = null;
  const amounts = new Map(projects.map((project) => [project.id, 0n]));
  const used = [];
  const walk = (index) => {
    if (index === pledges.length) {
      for (const id of target) {
        const amount = amounts.get(id);
        if (amount > byId.get(id).required) return;
      }
      for (const pledgeIndex of used) {
        const pledge = pledges[pledgeIndex];
        if (pledge.requires.some((id) => !target.has(id))) return;
      }
      const topUp = sum([...target].map((id) => byId.get(id).required - amounts.get(id)));
      if (best === null || topUp < best.amount) {
        best = { amount: topUp, existingUsed: [...used], targetProjects: [...target] };
      }
      return;
    }
    walk(index + 1);
    const pledge = pledges[index];
    for (const projectId of pledge.allowed) {
      if (!target.has(projectId)) continue;
      amounts.set(projectId, amounts.get(projectId) + pledge.amount);
      if (amounts.get(projectId) <= byId.get(projectId).required) {
        used.push(index);
        walk(index + 1);
        used.pop();
      }
      amounts.set(projectId, amounts.get(projectId) - pledge.amount);
    }
  };
  walk(0);
  return best;
}

function directOracle(projects, pledges) {
  let best = null;
  const assignment = [];
  const amounts = new Map(projects.map((project) => [project.id, 0n]));
  const evaluate = () => {
    const funded = projects.filter((project) => amounts.get(project.id) === project.required);
    if (funded.length === 0) return;
    const fundedIds = new Set(funded.map((project) => project.id));
    if (projects.some((project) => {
      const amount = amounts.get(project.id);
      return amount !== 0n && amount !== project.required;
    })) return;
    if (funded.some((project) => project.deps.some((dependency) => !fundedIds.has(dependency)))) return;
    if (assignment.some((projectId, index) => projectId !== null
      && pledges[index].requires.some((dependency) => !fundedIds.has(dependency)))) return;
    const allocated = sum(funded.map((project) => project.required));
    const ranking = [funded.length, allocated];
    if (!best || ranking[0] > best.ranking[0]
      || (ranking[0] === best.ranking[0] && ranking[1] > best.ranking[1])) {
      best = {
        funded: funded.map((project) => project.id),
        allocated,
        ranking,
        assignments: assignment
          .map((projectId, index) => projectId === null ? null : { pledgeIndex: index, projectId })
          .filter(Boolean),
      };
    }
  };
  const walk = (index) => {
    if (index === pledges.length) {
      evaluate();
      return;
    }
    assignment[index] = null;
    walk(index + 1);
    for (const projectId of pledges[index].allowed) {
      assignment[index] = projectId;
      amounts.set(projectId, amounts.get(projectId) + pledges[index].amount);
      walk(index + 1);
      amounts.set(projectId, amounts.get(projectId) - pledges[index].amount);
    }
    assignment[index] = null;
  };
  walk(0);
  return best;
}

function exactEligibleSubset(project, pledges) {
  const eligible = pledges.filter((pledge) => pledge.allowed.includes(project.id));
  const reachable = new Set([0n]);
  for (const pledge of eligible) {
    for (const amount of [...reachable]) reachable.add(amount + pledge.amount);
  }
  return reachable.has(project.required);
}

function blockedReasons(projects, pledges, result) {
  const funded = new Set(result?.funded ?? []);
  return projects
    .filter((project) => !funded.has(project.id))
    .map((project) => {
      const eligibleTotal = sum(pledges
        .filter((pledge) => pledge.allowed.includes(project.id))
        .map((pledge) => pledge.amount));
      if (eligibleTotal < project.required) {
        return { projectId: project.id, reason: `eligible commitments ${eligibleTotal} < target ${project.required}` };
      }
      if (!exactEligibleSubset(project, pledges)) {
        return { projectId: project.id, reason: `no exact eligible allocation reaches target ${project.required}` };
      }
      const missing = project.deps.filter((dependency) => !funded.has(dependency));
      if (missing.length) {
        return { projectId: project.id, reason: `dependency not activated: ${missing.join(', ')}` };
      }
      return { projectId: project.id, reason: 'not selected by the highest-count valid certificate' };
    });
}

export function compareScenario(input) {
  const current = {
    ...input,
    projects: input.projects.map(normalizeProject),
    pledges: input.pledges.map(normalizePledge),
  };
  const total = totalCapital(current.pledges);
  const started = process.hrtime.bigint();
  const pactResult = solve(current.projects, current.pledges);
  const runtimeMs = Number(process.hrtime.bigint() - started) / 1e6;
  const topUp = minimumAdditionalFunding(current.projects, current.pledges, current.targetProjects);
  const pact = {
    ...metricBase(total, pactResult?.allocated ?? 0n),
    activatedProjects: pactResult?.funded.length ?? 0,
    activatedProjectIds: pactResult?.funded ?? [],
    constraintSatisfied: pactResult !== null,
    minimumAdditionalFunding: topUp?.amount ?? null,
    minimumAdditionalFundingExact: topUp !== null,
    allocationCertificate: pactResult?.allocations ?? [],
    blockedReasons: blockedReasons(current.projects, current.pledges, pactResult),
    runtimeMs,
    semantics: 'bounded exact one-use allocation with conditions and dependency closure',
  };
  const oracle = current.oracleEligible ? directOracle(current.projects, current.pledges) : null;
  return {
    name: current.name,
    description: current.description,
    projects: current.projects.length,
    pledges: current.pledges.length,
    totalCapital: total,
    independent: independentBaseline(current.projects, current.pledges),
    thresholdPool: thresholdPoolBaseline(current.projects, current.pledges),
    pact,
    oracle: oracle ? { ranking: oracle.ranking, funded: oracle.funded } : null,
    optimalityChecked: oracle ? oracle.ranking[0] === pact.activatedProjects
      && oracle.ranking[1] === pact.allocated : null,
  };
}

export function runCompetitiveBenchmark(inputs = benchmarkScenarios()) {
  const results = inputs.map(compareScenario);
  return {
    schema: 'pact-atlas-competitive-benchmark/v1',
    generatedAt: new Date().toISOString(),
    amountUnit: 'integer benchmark units; not yoctoNEAR',
    baselineDefinitions: {
      independent: 'Each project independently counts every eligible pledge; shared pledges can be double-counted and conditions/dependencies are not certified.',
      thresholdPool: 'A single aggregate target is checked for a selected project subset; no project-level allocation or dependency certificate is produced.',
      pact: 'The bounded exact reference solver uses each pledge at most once and checks exact targets, allowed projects, pledge conditions and dependencies.',
    },
    results,
    optimality: {
      checkedScenarios: results.filter((result) => result.optimalityChecked === true).map((result) => result.name),
      allCheckedScenariosMatch: results.filter((result) => result.optimalityChecked !== null)
        .every((result) => result.optimalityChecked),
      method: 'independent exhaustive assignment enumerator for oracle-eligible bounded scenarios',
    },
    limitations: [
      'Baselines are capability models, not reimplementations of Gitcoin, Deep Funding or Codo production systems.',
      'PACT exact search is bounded at 8 projects and 12 pledges in this reference implementation; runtime is hardware-dependent.',
      'Minimum additional funding is exact only for the bounded model and unrestricted per-project top-up assumption described in the source.',
      'No result proves project delivery, governance legitimacy, confidentiality, or production financial safety.',
    ],
  };
}

export function toJsonSafe(value) {
  return JSON.parse(JSON.stringify(value, (_key, item) => (
    typeof item === 'bigint' ? item.toString() : item
  )));
}

export { directOracle as exhaustiveOracle };
