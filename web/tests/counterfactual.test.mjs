import assert from "node:assert/strict";
import test from "node:test";
import { evaluate, exactPlans } from "../engine.mjs";

test("the connected A+B+C coalition has an exact certificate", () => {
  const result = evaluate("abc");
  assert.equal(result.plans.length > 0, true);
  assert.equal(result.minimum, 0n);
  assert.deepEqual(result.plans[0].funded.sort(), ["a", "b", "c"]);
});

test("the full four-project coalition needs exactly one additional NEAR", () => {
  const result = evaluate("abcd");
  assert.equal(result.plans.length, 0);
  assert.equal(result.minimum, 1n);
  assert.match(result.reasons.join(" "), /D is the hinge/);
});

test("a model-only top-up creates a full allocation certificate", () => {
  const result = evaluate("abcd", true);
  assert.equal(result.plans.length > 0, true);
  assert.equal(result.minimum, 0n);
  assert.equal(result.plans[0].allocations.some((allocation) => allocation?.pledge === "06"), true);
});

test("a changed approved condition is represented as a counterfactual, not a mutation", () => {
  const result = evaluate("abcd", false, "donor5");
  assert.equal(result.plans.length > 0, true);
  assert.equal(result.condition, "donor5");
  assert.equal(result.pledges[4].amount, 3n);
});

test("the isolated D project is rejected by the mandatory coalition rule", () => {
  const result = evaluate("d");
  assert.equal(result.plans.length, 0);
  assert.match(result.reasons[0], /requires A \+ B \+ C/);
});

test("the exact search rejects partial project totals", () => {
  const plans = exactPlans(["a", "b", "c"], [{ id: "x", owner: "x", amount: 2n, allowed: ["a"], requires: [] }]);
  assert.equal(plans.length, 0);
});
