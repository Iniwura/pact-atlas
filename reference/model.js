/**
 * Executable financial reference model, NOT the NEAR runtime or a proof that
 * the Rust implementation compiles. All financial values are BigInt yoctoNEAR.
 * A pledge must be allocated in full to ONE permitted project.
 */
export const ONE = 10n ** 24n;
const fail = (message) => { throw new Error(message); };
const assert = (condition, message) => { if (!condition) fail(message); };
const sum = (numbers) => numbers.reduce((n, x) => n + x, 0n);

export function verifyPlan(projects, pledges, allocations) {
  const projectById = new Map(projects.map(p => [p.id, p]));
  assert(projectById.size === projects.length, 'duplicate project');
  const amounts = new Map(projects.map(p => [p.id, 0n]));
  const used = new Set();
  for (const { pledgeIndex, projectId } of allocations) {
    assert(Number.isInteger(pledgeIndex) && pledgeIndex >= 0 && pledgeIndex < pledges.length, 'unknown pledge');
    assert(!used.has(pledgeIndex), 'double-spend pledge');
    const pledge = pledges[pledgeIndex];
    assert(projectById.has(projectId), 'unknown project');
    assert(pledge.allowed.includes(projectId), 'not allowed');
    used.add(pledgeIndex);
    amounts.set(projectId, amounts.get(projectId) + pledge.amount);
  }
  const funded = new Set(projects.filter(p => amounts.get(p.id) === p.required).map(p => p.id));
  assert(funded.size > 0, 'no funded project');
  for (const p of projects) {
    assert(amounts.get(p.id) === 0n || amounts.get(p.id) === p.required, 'partial or over-funded');
    if (funded.has(p.id)) assert(p.deps.every(d => funded.has(d)), 'project dependency unsatisfied');
  }
  for (const i of used) assert(pledges[i].requires.every(d => funded.has(d)), 'pledge condition unsatisfied');
  return { funded: [...funded], amounts, used, allocated: sum([...amounts.values()]) };
}

export function solve(projects, pledges) {
  assert(projects.length <= 8 && pledges.length <= 12, 'reference exhaustive solver has bounded inputs');
  let best = null;
  const walk = (index, picked) => {
    if (index === pledges.length) {
      let result;
      try { result = verifyPlan(projects, pledges, picked); } catch { return; }
      const ranking = [result.funded.length, result.allocated];
      if (!best || ranking[0] > best.ranking[0] ||
          (ranking[0] === best.ranking[0] && ranking[1] > best.ranking[1])) {
        best = { allocations: structuredClone(picked), ...result, ranking };
      }
      return;
    }
    walk(index + 1, picked);
    for (const projectId of pledges[index].allowed) {
      picked.push({ pledgeIndex: index, projectId });
      walk(index + 1, picked);
      picked.pop();
    }
  };
  walk(0, []);
  return best;
}

export class EscrowModel {
  constructor(projects, deadlineMs, { activateAfterMs = 1, minFundedProjects = 1, requiredForActivation = [] } = {}) {
    assert(new Set(projects.map(p => p.id)).size === projects.length, 'duplicate ids');
    for (const p of projects) {
      assert(p.required > 0n, 'zero project target');
      assert(p.deps.every(d => projects.some(q => q.id === d && d !== p.id)), 'bad dependency');
    }
    this.projects = projects;
    assert(minFundedProjects >= 1 && minFundedProjects <= projects.length, "invalid project minimum");
    assert(activateAfterMs > 0 && activateAfterMs < deadlineMs, "bad activation window");
    assert(new Set(requiredForActivation).size === requiredForActivation.length, 'duplicate activation requirement');
    assert(requiredForActivation.every(id => projects.some(p => p.id === id)), 'unknown activation requirement');
    this.deadlineMs = deadlineMs;
    this.activateAfterMs = activateAfterMs;
    this.minFundedProjects = minFundedProjects;
    this.requiredForActivation = requiredForActivation;
    this.activatedAllocations = [];
    this.fundedProjects = [];
    this.pledges = [];
    this.phase = 'OPEN';
    this.credits = new Map();
    this.pending = new Map();
    this.liabilities = 0n;
    this.balance = 0n;
  }
  credit(owner, amount) { this.credits.set(owner, (this.credits.get(owner) ?? 0n) + amount); }
  commit(owner, amount, allowed, requires = [], now = 0) {
    assert(this.phase === 'OPEN' && now < this.activateAfterMs, 'funding window closed');
    assert(typeof amount === 'bigint' && amount > 0n, 'bad deposit');
    assert(allowed.length && new Set(allowed).size === allowed.length, 'bad allowed list');
    assert(allowed.every(id => this.projects.some(p => p.id === id)), 'unknown allowed project');
    assert(requires.every(id => this.projects.some(p => p.id === id)), 'unknown required project');
    const id = this.pledges.length;
    this.pledges.push({ owner, amount, allowed, requires });
    this.balance += amount;
    this.liabilities += amount;
    this.invariant();
    return id;
  }
  activate(allocations, now = 0) {
    assert(this.phase === 'OPEN' && now < this.deadlineMs, 'activation closed');
    assert(now >= this.activateAfterMs, 'activation too early');
    const result = verifyPlan(this.projects, this.pledges, allocations);
    assert(result.funded.length >= this.minFundedProjects, 'activation below campaign minimum');
    assert(this.requiredForActivation.every(id => result.funded.includes(id)), 'required coalition project missing');
    this.phase = 'ACTIVATED';
    this.activatedAllocations = structuredClone(allocations);
    this.fundedProjects = [...result.funded];
    for (const p of this.projects) if (result.funded.includes(p.id)) this.credit(p.beneficiary, p.required);
    for (let i = 0; i < this.pledges.length; i++) {
      if (!result.used.has(i)) this.credit(this.pledges[i].owner, this.pledges[i].amount);
    }
    this.invariant();
    return result;
  }
  expire(now) {
    assert(this.phase === 'OPEN' && now >= this.deadlineMs, 'not expirable');
    this.phase = 'EXPIRED';
    for (const p of this.pledges) this.credit(p.owner, p.amount);
    this.invariant();
  }
  withdraw(owner) {
    assert(!this.pending.has(owner), 'withdrawal pending');
    const amount = this.credits.get(owner) ?? 0n;
    assert(amount > 0n, 'nothing claimable');
    this.credits.delete(owner);
    this.pending.set(owner, amount);
    this.invariant();
    return amount;
  }
  resolve(owner, amount, succeeded) {
    assert(this.pending.get(owner) === amount, 'bad callback');
    this.pending.delete(owner);
    if (succeeded) { this.balance -= amount; this.liabilities -= amount; }
    else this.credit(owner, amount);
    this.invariant();
  }
  invariant() {
    const outstanding = this.phase === 'OPEN'
      ? sum(this.pledges.map(p => p.amount))
      : sum([...this.credits.values()]) + sum([...this.pending.values()]);
    assert(outstanding === this.liabilities, 'liability conservation failed');
    assert(this.balance >= this.liabilities, 'insolvent');
    return true;
  }
}

export function example() {
  const projects = [
    { id: 'A', beneficiary: 'training.near', required: 4n * ONE, deps: ['B', 'C'] },
    { id: 'B', beneficiary: 'internet.near', required: 3n * ONE, deps: ['A'] },
    { id: 'C', beneficiary: 'equipment.near', required: 3n * ONE, deps: ['A'] },
    { id: 'D', beneficiary: 'events.near', required: 3n * ONE, deps: [] },
  ];
  const pledges = [
    { owner: 'donor1.near', amount: 3n * ONE, allowed: ['A', 'D'], requires: [] },
    { owner: 'donor2.near', amount: 1n * ONE, allowed: ['A'], requires: ['B', 'C'] },
    { owner: 'donor3.near', amount: 3n * ONE, allowed: ['B'], requires: ['A'] },
    { owner: 'donor4.near', amount: 3n * ONE, allowed: ['C'], requires: ['A'] },
    { owner: 'donor5.near', amount: 2n * ONE, allowed: ['D'], requires: [] },
  ];
  return { projects, pledges };
}
