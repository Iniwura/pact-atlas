import { MODEL, evaluate } from "./engine.mjs";

const sum = (amounts) => amounts.reduce((total, amount) => total + amount, 0n);

/**
 * A separate, fail-closed check of the browser reference solver's first plan.
 * It is NOT a security audit or onchain verification. The contract has its own
 * authoritative validation for signed transactions.
 */
export function checkAllocation(plan, pledges, targetIds) {
  const errors = [];
  const targets = new Set(targetIds);
  const pledgeMap = new Map(pledges.map((pledge) => [pledge.id, pledge]));
  const allocations = plan?.allocations?.filter(Boolean) ?? [];
  const seen = new Set();
  const totals = Object.fromEntries(Object.keys(MODEL.projects).map((id) => [id, 0n]));

  if (!plan || !Array.isArray(plan.allocations)) errors.push("Missing allocation certificate.");
  for (const entry of allocations) {
    const pledge = pledgeMap.get(entry.pledge);
    if (!pledge) {
      errors.push(`Unknown commitment ${entry.pledge}.`);
      continue;
    }
    if (seen.has(entry.pledge)) errors.push(`Commitment ${entry.pledge} is assigned more than once.`);
    seen.add(entry.pledge);
    if (!targets.has(entry.project) || !MODEL.projects[entry.project]) {
      errors.push(`Commitment ${entry.pledge} has an invalid destination.`);
      continue;
    }
    if (!pledge.allowed.includes(entry.project)) errors.push(`Commitment ${entry.pledge} cannot fund project ${entry.project}.`);
    totals[entry.project] += pledge.amount;
  }

  const funded = new Set(Object.keys(totals).filter((id) => totals[id] === MODEL.projects[id].required));
  if (funded.size !== targets.size || [...targets].some((id) => !funded.has(id))) {
    errors.push("Project requirements do not match the selected coalition exactly.");
  }
  if (funded.size < MODEL.minimumProjects || !MODEL.requiredForActivation.every((id) => funded.has(id))) {
    errors.push("Mandatory activation coalition is missing.");
  }
  for (const id of funded) {
    if (!MODEL.projects[id].dependencies.every((dependency) => funded.has(dependency))) {
      errors.push(`Project ${id} has an unmet dependency.`);
    }
  }
  for (const entry of allocations) {
    const pledge = pledgeMap.get(entry.pledge);
    if (pledge && !pledge.requires.every((id) => funded.has(id))) {
      errors.push(`Commitment ${entry.pledge} has an unmet condition.`);
    }
  }
  const committed = sum(pledges.map((pledge) => pledge.amount));
  const assigned = sum([...seen].map((id) => pledgeMap.get(id)?.amount ?? 0n));
  const unused = committed - assigned;
  if (assigned > committed) errors.push("Assigned capital exceeds committed capital.");
  return { ok: errors.length === 0, errors, totals, committed, assigned, unused };
}

function rowsFor(plan, pledges) {
  const pledgeMap = new Map(pledges.map((pledge) => [pledge.id, pledge]));
  return plan.allocations.filter(Boolean).map(({pledge, project}) => ({
    id: pledge,
    donor: pledgeMap.get(pledge).owner,
    amount: pledgeMap.get(pledge).amount,
    project,
    projectName: MODEL.projects[project].label
  }));
}

function initialCoverage() {
  const core = evaluate("abc");
  const candidate = core.plans[0];
  if (!candidate) return null;
  const proof = checkAllocation(candidate, core.pledges, core.targetIds);
  if (!proof.ok) return null;
  // An unassigned pledge eligible ONLY for D can be shown as *available*,
  // never as activated or assigned. Flexible pledges are not double-counted.
  const assignedIds = new Set(candidate.allocations.filter(Boolean).map((item) => item.pledge));
  const reservedForD = sum(core.pledges.filter((pledge) => !assignedIds.has(pledge.id) &&
    pledge.allowed.length === 1 && pledge.allowed[0] === "d").map((pledge) => pledge.amount));
  return {...proof.totals, d: reservedForD};
}

export function fundingView(targetKey="abcd", topUp=false, condition="none") {
  const result = evaluate(targetKey, topUp, condition);
  const plan = result.plans[0] ?? null;
  const validation = plan ? checkAllocation(plan, result.pledges, result.targetIds) : null;
  const certified = Boolean(plan && validation?.ok);
  const committed = sum(result.pledges.map((pledge) => pledge.amount));
  const required = sum(result.targetIds.map((id) => MODEL.projects[id].required));
  const baseline = targetKey === "abcd" && !topUp && condition === "none" && !certified;
  const coverage = certified ? validation.totals :
    baseline ? initialCoverage() :
    Object.fromEntries(Object.keys(MODEL.projects).map((id) => [id, 0n]));
  const rows = certified ? rowsFor(plan, result.pledges) : [];
  const eligibleTotal = sum(result.targetIds.map((id) => result.available[id] ?? 0n));

  return {
    targetKey, topUp, condition,
    status: certified ? "viable" : "blocked",
    targetIds: result.targetIds,
    targetLabel: result.targetLabel,
    committed, required,
    missing: result.minimum,
    rows,
    validation,
    unassigned: certified ? validation.unused : committed,
    projects: Object.entries(MODEL.projects).map(([id, project]) => ({
      id, label: project.label, short:project.short,
      required: project.required,
      visible: coverage?.[id] ?? 0n,
      selected: result.targetIds.includes(id),
      source: certified ? "exact allocation" : baseline ? "candidate / available" : "not allocated",
      dependencies: [...project.dependencies]
    })),
    // These are eligibility totals, NOT assigned funds. A flexible donor
    // appears in more than one project and must never be counted twice.
    eligibilityOvercount: !certified && targetKey === "abcd" ? eligibleTotal - committed : 0n,
    baseline: baseline ? "Core A+B+C has a valid 10 NEAR candidate; D has 2 NEAR reserved but cannot activate." : null,
    reasons: [...result.reasons],
    certificate: certified ? {
      kind: "PACT-LOCAL-REFERENCE-CERTIFICATE",
      network: "OFFLINE-NOT-ONCHAIN",
      target:result.targetIds,
      allocations: rows.map((row) => ({pledge:row.id, amountNear:row.amount.toString(), project:row.project})),
      assignedNear: validation.assigned.toString(),
      unusedNear: validation.unused.toString(),
      checks: {
        oneUse:true,
        permissions:true,
        pledgeConditions:true,
        dependencyClosure:true,
        exactProjectAmounts:true,
        capitalConservation:true
      }
    } : null
  };
}
