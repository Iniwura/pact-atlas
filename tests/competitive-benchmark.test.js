import test from 'node:test';
import assert from 'node:assert/strict';
import {
  benchmarkScenarios,
  compareScenario,
  exhaustiveOracle,
  minimumAdditionalFunding,
  runCompetitiveBenchmark,
} from '../reference/competitive.js';

test('benchmark covers the requested network classes', () => {
  assert.deepEqual(
    benchmarkScenarios().map((scenario) => scenario.name),
    [
      'cyclic-dependencies',
      'competing-coalitions',
      'restricted-budgets',
      'mutual-conditions',
      'infeasible-network',
      'large-realistic',
    ],
  );
});

test('PACT produces a valid cyclic coalition and exact top-up', () => {
  const result = compareScenario(benchmarkScenarios()[0]);
  assert.deepEqual(result.pact.activatedProjectIds, ['A', 'B', 'C']);
  assert.equal(result.pact.activatedProjects, 3);
  assert.equal(result.pact.allocated, 10n);
  assert.equal(result.pact.minimumAdditionalFunding, 1n);
  assert.equal(result.pact.constraintSatisfied, true);
  assert.equal(result.independent.overcommitted, 1n);
});

test('one-use allocation distinguishes competing coalitions from double counting', () => {
  const result = compareScenario(benchmarkScenarios()[1]);
  assert.equal(result.independent.activatedProjects, 4);
  assert.equal(result.thresholdPool.activatedProjects, 3);
  assert.equal(result.pact.activatedProjects, 2);
  assert.equal(result.pact.constraintSatisfied, true);
  assert.equal(result.pact.minimumAdditionalFunding, 5n);
});

test('mutual pledge conditions are included in the exact certificate', () => {
  const result = compareScenario(benchmarkScenarios()[3]);
  assert.deepEqual(result.pact.activatedProjectIds, ['A', 'B', 'C']);
  assert.equal(result.pact.constraintSatisfied, true);
  assert.equal(result.pact.allocationCertificate.length, 3);
});

test('infeasible networks expose blocked reasons and a bounded top-up', () => {
  const result = compareScenario(benchmarkScenarios()[4]);
  assert.deepEqual(result.pact.activatedProjectIds, ['C']);
  assert.equal(result.pact.minimumAdditionalFunding, 2n);
  assert.ok(result.pact.blockedReasons.some(({ projectId, reason }) => projectId === 'A' && reason.includes('dependency')));
});

test('the larger scenario stays within the documented exact solver bound', () => {
  const result = compareScenario(benchmarkScenarios()[5]);
  assert.equal(result.projects, 8);
  assert.equal(result.pledges, 12);
  assert.equal(result.pact.activatedProjects, 8);
  assert.equal(result.pact.constraintSatisfied, true);
  assert.equal(result.optimalityChecked, null);
});

test('independent exhaustive oracle matches PACT on every oracle-eligible scenario', () => {
  for (const scenario of benchmarkScenarios().filter((item) => item.oracleEligible)) {
    const result = compareScenario(scenario);
    const oracle = exhaustiveOracle(scenario.projects, scenario.pledges);
    assert.equal(result.optimalityChecked, true, scenario.name);
    assert.equal(oracle?.ranking[0], result.pact.activatedProjects, scenario.name);
    assert.equal(oracle?.ranking[1], result.pact.allocated, scenario.name);
  }
});

test('minimum top-up includes dependency closure without mutating approved inputs', () => {
  const scenario = benchmarkScenarios()[4];
  const before = structuredClone(scenario);
  const topUp = minimumAdditionalFunding(scenario.projects, scenario.pledges, ['A']);
  assert.equal(topUp.amount, 2n);
  assert.deepEqual(scenario, before);
  assert.ok(topUp.targetProjects.includes('B'));
});

test('benchmark output has reproducible, explicit capability fields', () => {
  const report = runCompetitiveBenchmark();
  assert.equal(report.schema, 'pact-atlas-competitive-benchmark/v1');
  assert.equal(report.optimality.allCheckedScenariosMatch, true);
  for (const result of report.results) {
    for (const baseline of ['independent', 'thresholdPool', 'pact']) {
      assert.equal(typeof result[baseline].activatedProjects, 'number');
      assert.ok(Object.hasOwn(result[baseline], 'constraintSatisfied'));
      assert.ok(Object.hasOwn(result[baseline], 'minimumAdditionalFunding'));
    }
  }
});
