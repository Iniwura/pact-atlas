import assert from "node:assert/strict";
import test from "node:test";
import { MODEL, evaluate } from "../engine.mjs";
import { fundingView, checkAllocation } from "../funding-view.mjs";

test("blocked baseline shows 10 NEAR core candidate and 2 NEAR reserved for D, without fake activation", () => {
  const view=fundingView();
  assert.equal(view.status,"blocked");
  assert.equal(view.certificate,null);
  assert.equal(view.committed,12n);
  assert.equal(view.required,13n);
  assert.equal(view.missing,1n);
  assert.deepEqual(view.projects.map(p=>p.visible),[4n,3n,3n,2n]);
  assert.equal(view.eligibilityOvercount,3n);
  assert.equal(view.rows.length,0);
});

test("one simulated NEAR yields a valid one-use allocation of 13 NEAR", () => {
  const view=fundingView("abcd",true);
  assert.equal(view.status,"viable");
  assert.equal(view.committed,13n);
  assert.equal(view.required,13n);
  assert.equal(view.unassigned,0n);
  assert.deepEqual(view.projects.map(p=>p.visible),[4n,3n,3n,3n]);
  assert.equal(view.rows.length,6);
  assert.equal(new Set(view.rows.map(r=>r.id)).size,6);
  assert.deepEqual(view.certificate.target,["a","b","c","d"]);
  assert.equal(view.certificate.network,"OFFLINE-NOT-ONCHAIN");
  assert.equal(view.certificate.assignedNear,"13");
  assert.equal(view.validation.ok,true);
});

test("approved-condition what-if does not fabricate a sixth donor", () => {
  const view=fundingView("abcd",false,"donor5");
  assert.equal(view.status,"viable");
  assert.equal(view.rows.length,5);
  assert.equal(view.certificate.assignedNear,"13");
  assert.equal(view.rows.find(r=>r.id==="05").amount,3n);
});

test("mandatory A+B+C can be valid with unused, refundable D capital", () => {
  const view=fundingView("abc");
  assert.equal(view.status,"viable");
  assert.equal(view.validation.unused,2n);
  assert.equal(view.certificate.assignedNear,"10");
  assert.equal(view.rows.length,4);
  assert.equal(view.projects.find(p=>p.id==="d").visible,0n);
});

test("isolated D stays blocked even with nominal eligibility", () => {
  const view=fundingView("d");
  assert.equal(view.status,"blocked");
  assert.equal(view.certificate,null);
  assert.match(view.reasons.join(" "),/requires A \+ B \+ C/);
});

test("audit rejects duplicate use even when identical destination totals seem plausible", () => {
  const res=evaluate("abcd",true);
  const tampered=structuredClone(res.plans[0]);
  tampered.allocations.push({...tampered.allocations[0]});
  const audit=checkAllocation(tampered,res.pledges,res.targetIds);
  assert.equal(audit.ok,false);
  assert.match(audit.errors.join(" "),/more than once/);
});

test("audit rejects ineligible destinations, missing dependencies, and partial requirements", () => {
  const res=evaluate("abcd",true);
  const tampered=structuredClone(res.plans[0]);
  tampered.allocations[0]={...tampered.allocations[0],project:"d"};
  const audit=checkAllocation(tampered,res.pledges,res.targetIds);
  assert.equal(audit.ok,false);
  assert.match(audit.errors.join(" "),/cannot fund|requirements do not match/);
});

test("reference model stays immutable across counterfactual views", () => {
  const before=MODEL.pledges.map(p=>p.amount);
  fundingView("abcd",true);
  fundingView("abcd",false,"donor5");
  fundingView("abc");
  assert.deepEqual(MODEL.pledges.map(p=>p.amount),before);
});
