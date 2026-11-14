import test from 'node:test';
import assert from 'node:assert/strict';
import { ONE, solve, verifyPlan, EscrowModel, example } from '../reference/model.js';
const { projects, pledges } = example();
const abc = [{pledgeIndex:0,projectId:'A'},{pledgeIndex:1,projectId:'A'},{pledgeIndex:2,projectId:'B'},{pledgeIndex:3,projectId:'C'}];
function deployed() {
  const m = new EscrowModel(projects, 100);
  for (const p of pledges) m.commit(p.owner, p.amount, p.allowed, p.requires, 0);
  return m;
}
const expectBad = (fn, match) => assert.throws(fn, match);
test('finds A+B+C as feasible coalition under strict funding limits', () => {
  const sol = solve(projects, pledges);
  assert.equal(sol.funded.length, 3);
  assert.equal(sol.allocated, 10n*ONE);
  assert.deepEqual(new Set(sol.funded),new Set(['A','B','C']));
});
test('cannot fund A, B, C independently without the cyclic package', () => {
  for (const p of ['A','B','C']) expectBad(()=>verifyPlan(projects, pledges, abc.filter(a=>a.projectId===p)), /dependency|partial|no funded/);
});
test('one extra NEAR is sufficient to make all 4 fundable', () => {
  const full = [...pledges, { owner:'donor6.near', amount:ONE, allowed:['D'], requires:[] }];
  const sol = solve(projects, full);
  assert.equal(sol.funded.length, 4);
  assert.equal(sol.allocated, 13n*ONE);
});
test('fewer than 1 NEAR extra cannot fund all, due to conservation', () => {
  const quarter = { owner:'donor6.near', amount:ONE/4n, allowed:['D'], requires:[] };
  assert.equal(solve(projects, [...pledges, quarter]).funded.length, 3);
});
test('rejects duplicated pledge indices', () => {
  expectBad(()=>verifyPlan(projects, pledges,[...abc, abc[0]]), /double-spend/);
});
test('rejects disallowed funding target', () => {
  expectBad(()=>verifyPlan(projects, pledges,[{pledgeIndex:0,projectId:'B'}]),/not allowed/);
});
test('rejects partial funded projects', () => {
  expectBad(()=>verifyPlan(projects, pledges,[{pledgeIndex:4,projectId:'D'}]),/partial|no funded/);
});
test('rejects an over-funded project', () => {
  const extra = [...pledges,{owner:'x.near',amount:ONE,allowed:['A'],requires:[]}];
  expectBad(()=>verifyPlan(projects,extra,[...abc,{pledgeIndex:5,projectId:'A'}]),/over-funded/);
});
test('rejects dependency condition not in activated set', () => {
  const group = [{owner:'x.near',amount:3n*ONE,allowed:['D'],requires:['A']}];
  expectBad(()=>verifyPlan(projects,group,[{pledgeIndex:0,projectId:'D'}]),/pledge condition/);
});
test('rejects allocations with unknown pledge or project', () => {
  expectBad(()=>verifyPlan(projects,pledges,[{pledgeIndex:15,projectId:'A'}]),/unknown pledge/);
  expectBad(()=>verifyPlan(projects,pledges,[{pledgeIndex:0,projectId:'Z'}]),/unknown project/);
});
test('funded beneficiary receives exact credit and unused donor refunded', () => {
  const m=deployed(); m.activate(abc,1);
  assert.equal(m.credits.get('training.near'),4n*ONE);
  assert.equal(m.credits.get('internet.near'),3n*ONE);
  assert.equal(m.credits.get('equipment.near'),3n*ONE);
  assert.equal(m.credits.get('donor5.near'),2n*ONE);
  assert.equal(m.liabilities,12n*ONE);
});
test('failed campaign expiration makes EVERY pledge reclaimable', () => {
  const m=deployed(); m.expire(100);
  for(const p of pledges) assert.equal(m.credits.get(p.owner),p.amount);
  assert.equal(m.liabilities,12n*ONE);
});
test('deadline blocks late commitment and late activation', () => {
  const m=deployed();
  expectBad(()=>m.commit('late.near',ONE,['A'],[],101),/closed/);
  expectBad(()=>m.activate(abc,100),/closed/);
});
test('unauthorized early expiration is rejected', () => {
  const m=deployed(); expectBad(()=>m.expire(99),/not expirable/);
});
test('double withdraw blocked while callback pending', () => {
  const m=deployed();m.expire(100);
  const amount=m.withdraw('donor1.near');
  expectBad(()=>m.withdraw('donor1.near'),/pending/);
  assert.equal(amount,3n*ONE);
});
test('missing callback keeps the exact liability pending and cannot be reclaimed', () => {
  const m=deployed();m.expire(100);
  const amount=m.withdraw('donor1.near');
  // Model a delayed or permanently missing runtime callback: no resolve call
  // is made. The contract has no safe inference path and must keep the claim
  // pending rather than unlock it or retry the transfer.
  assert.equal(m.pending.get('donor1.near'), amount);
  assert.equal(m.credits.get('donor1.near') ?? 0n, 0n);
  assert.equal(m.liabilities, 12n*ONE);
  assert.equal(m.balance, 12n*ONE);
  m.invariant();
  expectBad(()=>m.withdraw('donor1.near'),/pending/);
});
test('failed transfer restores claim without affecting anyone else', () => {
  const m=deployed();m.expire(100);
  const first=m.withdraw('donor1.near');m.resolve('donor1.near',first,false);
  assert.equal(m.credits.get('donor1.near'),first);
  const second=m.withdraw('donor2.near');m.resolve('donor2.near',second,true);
  assert.equal(m.credits.get('donor1.near'),first);
  assert.equal(m.liabilities,11n*ONE);
  assert.equal(m.balance,11n*ONE);
});
test('wrong callback cannot alter pending funds', () => {
  const m=deployed();m.expire(100);
  const amount=m.withdraw('donor1.near');
  expectBad(()=>m.resolve('donor1.near',amount+ONE,true),/bad callback/);
  assert.equal(m.pending.get('donor1.near'),amount);
});
test('repeated expiration and activation cannot pay twice', () => {
  const m=deployed();m.expire(100);
  expectBad(()=>m.expire(101),/not expirable/);
  expectBad(()=>m.activate(abc,99),/activation closed/);
});
test('complete refund settlement reduces all liabilities to zero', () => {
  const m=deployed();m.expire(100);
  for(const p of pledges) {let amount=m.withdraw(p.owner); m.resolve(p.owner,amount,true);}
  assert.equal(m.liabilities,0n);
  assert.equal(m.balance,0n);
});
test('malicious allocation cannot steal beneficiary funds', () => {
  const m=deployed();
  expectBad(()=>m.activate([{pledgeIndex:0,projectId:'A'}],1),/partial|no funded/);
  assert.equal(m.phase,'OPEN');
  assert.equal(m.liabilities,12n*ONE);
});

test('premature activation blocked even if a smaller coalition is valid', () => {
  const m=new EscrowModel(projects,100,{activateAfterMs:20,minFundedProjects:3});
  for(const p of pledges) m.commit(p.owner,p.amount,p.allowed,p.requires,0);
  expectBad(()=>m.activate(abc,19),/too early/);
  m.activate(abc,20);
  assert.equal(m.phase,'ACTIVATED');
});

test('activation boundary freezes deposits at equality and accepts the certificate at equality', () => {
  const m=new EscrowModel(projects,100,{activateAfterMs:20,minFundedProjects:3});
  for(const p of pledges) m.commit(p.owner,p.amount,p.allowed,p.requires,0);
  expectBad(()=>m.commit('boundary.near',ONE,['D'],[],20),/funding window closed/);
  expectBad(()=>m.activate(abc,19),/too early/);
  m.activate(abc,20);
  assert.equal(m.phase,'ACTIVATED');
});

test('deadline equality closes activation and permits expiry exactly once', () => {
  const m=deployed();
  expectBad(()=>m.activate(abc,100),/closed/);
  m.expire(100);
  assert.equal(m.phase,'EXPIRED');
  expectBad(()=>m.expire(100),/not expirable/);
  m.invariant();
});
test('cannot activate a below-threshold coalition to foreclose others', () => {
  const m=new EscrowModel(projects,100,{minFundedProjects:3});
  m.commit('x.near',3n*ONE,['D']);
  expectBad(()=>m.activate([{pledgeIndex:0,projectId:'D'}],1),/campaign minimum/);
  assert.equal(m.phase,'OPEN');
});

// Additional tests cover the campaign's explicit funding/activation boundary.
test('new contributions cannot race a submitted plan once the funding window ends', () => {
  const m = deployed();
  expectBad(() => m.commit('late.near', ONE, ['D'], [], 1), /funding window closed/);
  m.activate(abc, 1);
  assert.deepEqual(m.fundedProjects, ['A','B','C']);
  assert.deepEqual(m.activatedAllocations, abc);
});
test('required project bundle prevents opportunistic smaller activation', () => {
  const m = new EscrowModel(projects, 100, {activateAfterMs:10, minFundedProjects:1, requiredForActivation:['A','B','C']});
  m.commit('d-only.near', 3n * ONE, ['D']);
  expectBad(() => m.activate([{pledgeIndex:0, projectId:'D'}], 10), /required coalition project missing/);
  assert.equal(m.phase, 'OPEN');
  m.expire(100);
  assert.equal(m.credits.get('d-only.near'), 3n*ONE);
});
test('bad activation requirements are rejected at initialization', () => {
  expectBad(() => new EscrowModel(projects, 100, { requiredForActivation:['A','A'] }), /duplicate/);
  expectBad(() => new EscrowModel(projects, 100, { requiredForActivation:['Z'] }), /unknown/);
});
test('solvency survives mixed success/failure payouts and recoverable credit', () => {
  const m = deployed();m.activate(abc,1);
  let x = m.withdraw('training.near');m.resolve('training.near',x,true);
  x = m.withdraw('internet.near');m.resolve('internet.near',x,false);
  x = m.withdraw('donor5.near');m.resolve('donor5.near',x,true);
  assert.equal(m.liabilities,6n*ONE);
  assert.equal(m.credits.get('internet.near'),3n*ONE);
  assert.equal(m.credits.get('equipment.near'),3n*ONE);
  m.invariant();
});
