export const MODEL = {
  requiredForActivation: ["a", "b", "c"],
  minimumProjects: 3,
  projects: {
    a: { label: "Training", short: "A", required: 4n, dependencies: ["b", "c"], copy: "Needs B and C funded before the training can activate." },
    b: { label: "Internet", short: "B", required: 3n, dependencies: ["a"], copy: "Needs A funded before the community connection can activate." },
    c: { label: "Equipment", short: "C", required: 3n, dependencies: ["a"], copy: "Needs A funded before the equipment can activate." },
    d: { label: "Events", short: "D", required: 3n, dependencies: [], copy: "Independent of the cycle, but short by 1N in the base commitment set." },
  },
  pledges: [
    { id: "01", owner: "Donor 01", amount: 3n, allowed: ["a", "d"], requires: [], note: "flexible route" },
    { id: "02", owner: "Donor 02", amount: 1n, allowed: ["a"], requires: ["b", "c"], note: "conditional on B + C" },
    { id: "03", owner: "Donor 03", amount: 3n, allowed: ["b"], requires: ["a"], note: "conditional on A" },
    { id: "04", owner: "Donor 04", amount: 3n, allowed: ["c"], requires: ["a"], note: "conditional on A" },
    { id: "05", owner: "Donor 05", amount: 2n, allowed: ["d"], requires: [], note: "independent route" },
  ],
};

const clonePledge = (pledge) => ({ ...pledge, allowed: [...pledge.allowed], requires: [...pledge.requires] });

export function exactPlans(targetIds, pledges = MODEL.pledges) {
  const plans = [];
  const targets = new Set(targetIds);
  const totals = Object.fromEntries(Object.keys(MODEL.projects).map((id) => [id, 0n]));
  const choices = [];
  function isValid() {
    const funded = new Set();
    for (const [id, project] of Object.entries(MODEL.projects)) {
      if (totals[id] === project.required) funded.add(id);
      else if (totals[id] !== 0n) return false;
    }
    if (funded.size < MODEL.minimumProjects) return false;
    if (!MODEL.requiredForActivation.every((id) => funded.has(id))) return false;
    if (funded.size !== targets.size || ![...targets].every((id) => funded.has(id))) return false;
    for (const id of funded) if (!MODEL.projects[id].dependencies.every((dependency) => funded.has(dependency))) return false;
    for (const [index, choice] of choices.entries()) if (choice !== null && !pledges[index].requires.every((id) => funded.has(id))) return false;
    return true;
  }
  function walk(index) {
    if (index === pledges.length) { if (isValid()) plans.push({ allocations: choices.map((choice, i) => choice === null ? null : { pledge: pledges[i].id, project: choice }), funded: [...targets] }); return; }
    const pledge = pledges[index]; choices[index] = null; walk(index + 1);
    for (const projectId of pledge.allowed) { if (!targets.has(projectId)) continue; totals[projectId] += pledge.amount; choices[index] = projectId; walk(index + 1); totals[projectId] -= pledge.amount; }
    choices[index] = null;
  }
  walk(0); return plans;
}

export function evaluate(targetKey, topUp = false, condition = "none") {
  const targetIds = targetKey === "abc" ? ["a", "b", "c"] : targetKey === "abcd" ? ["a", "b", "c", "d"] : ["d"];
  const pledges = MODEL.pledges.map(clonePledge);
  if (topUp || condition === "topup") pledges.push({ id: "06", owner: "New commitment", amount: 1n, allowed: ["d"], requires: [], note: "counterfactual top-up" });
  if (condition === "donor5") pledges[4].amount = 3n;
  const plans = exactPlans(targetIds, pledges);
  const targetLabel = targetIds.map((id) => MODEL.projects[id].short).join(" + ");
  const available = Object.fromEntries(targetIds.map((id) => [id, pledges.filter((pledge) => pledge.allowed.includes(id)).reduce((sum, pledge) => sum + pledge.amount, 0n)]));
  const reasons = [];
  if (!plans.length) {
    if (!MODEL.requiredForActivation.every((id) => targetIds.includes(id))) reasons.push(`The contract requires ${MODEL.requiredForActivation.map((id) => MODEL.projects[id].short).join(" + ")} in every activation.`);
    for (const id of targetIds) if (available[id] < MODEL.projects[id].required) reasons.push(`${MODEL.projects[id].short} needs ${MODEL.projects[id].required}N; permitted commitments currently cover ${available[id]}N.`);
    if (targetKey === "abcd" && !topUp && condition !== "donor5") reasons.push("D is the hinge: one additional 1N commitment, or an approved increase to Donor 05, makes the full coalition exact.");
    if (!reasons.length) reasons.push("The current permission and dependency graph has no exact allocation certificate for this coalition.");
  }
  let minimum = 0n;
  if (targetKey === "abcd" && !plans.length && condition === "none") minimum = 1n;
  return { targetIds, targetLabel, plans, reasons, minimum, available, pledges, condition };
}
