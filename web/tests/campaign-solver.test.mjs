import assert from "node:assert/strict";
import test from "node:test";
import { MODEL } from "../engine.mjs";
import { solveCampaign, validateCampaign, verifyCampaignAllocation, CAMPAIGN_LIMITS } from "../campaign-solver.mjs";

const sample=()=>({
  title:"Community Hub",
  projects:Object.entries(MODEL.projects).map(([id,p])=>({
    id,name:p.label,goal:Number(p.required),dependencies:[...p.dependencies],included:true
  })),
  supporters:MODEL.pledges.map((p,i)=>({
    id:"s"+(i+1),name:"Supporter "+(i+1),amount:Number(p.amount),
    allowed:[...p.allowed],requires:[...p.requires]
  }))
});
const two=()=>({
  title:"Village library",
  projects:[{id:"p1",name:"Books",goal:3,dependencies:[],included:true},
    {id:"p2",name:"Shelves",goal:2,dependencies:["p1"],included:true}],
  supporters:[{id:"s1",name:"Ari",amount:3,allowed:["p1"],requires:[]},
    {id:"s2",name:"Bela",amount:2,allowed:["p2"],requires:["p1"]}]
});

test("the known reference example remains blocked without the sixth contribution",()=>{
  const r=solveCampaign(sample());
  assert.equal(r.status,"blocked");assert.equal(r.committed,12);assert.equal(r.required,13);
  assert.equal(r.certificate,null);assert.equal(r.shortfall,1);
});
test("adding exactly one permitted whole commitment produces a valid one-use plan",()=>{
  const c=sample();c.supporters.push({id:"s6",name:"Extra supporter",amount:1,allowed:["d"],requires:[]});
  const r=solveCampaign(c);assert.equal(r.status,"fundable");assert.equal(r.required,13);
  assert.equal(r.certificate.assigned,13);
  assert.equal(r.certificate.allocations.length,6);
  assert.equal(new Set(r.certificate.allocations.map(x=>x.supporterId)).size,6);
  assert.equal(r.certificate.allocations.find(x=>x.supporterId==="s6").projectId,"d");
  assert.equal(verifyCampaignAllocation(c,r.certificate.allocations).valid,true);
  assert.equal(r.certificate.network,"OFFLINE-NOT-ONCHAIN");
});
test("new user campaigns work with completely different project names and rules",()=>{
  const r=solveCampaign(two());
  assert.equal(r.status,"fundable");
  assert.equal(r.certificate.assigned,5);assert.equal(r.certificate.unused,0);
  assert.equal(r.certificate.allocations.find(x=>x.supporterId==="s2").project,"Shelves");
});
test("enough total capital is not evidence of an exact permitted allocation",()=>{
  const c=two();c.supporters=[{id:"s1",name:"Ari",amount:3,allowed:["p1","p2"],requires:[]},
    {id:"s2",name:"Bela",amount:1,allowed:["p1","p2"],requires:[]},
    {id:"s3",name:"Cole",amount:1,allowed:["p1","p2"],requires:[]}];
  c.projects[0].goal=2;c.projects[1].goal=3;
  const r=solveCampaign(c);
  assert.equal(r.status,"fundable"); // 3 to Shelves; 1+1 to Books
  c.projects[0].goal=2;c.projects[1].goal=2;
  c.supporters=[{id:"s1",name:"Ari",amount:3,allowed:["p1","p2"],requires:[]},
    {id:"s2",name:"Bela",amount:1,allowed:["p1","p2"],requires:[]}];
  const blocked=solveCampaign(c);
  assert.equal(blocked.status,"blocked");assert.equal(blocked.shortfall,0);
  assert.match(blocked.reason,/no exact assignment/i);
});
test("permission restrictions block plans even when total commitments cover the goals",()=>{
  const c=two();c.supporters[0].allowed=["p2"];
  const r=solveCampaign(c);
  assert.equal(r.status,"blocked");
  assert.match(r.reason,/Books needs 3 NEAR/);
});
test("project dependencies and supporter conditions are enforced",()=>{
  const c=two();c.projects[0].included=false;
  assert.match(validateCampaign(c).join(" "),/depends on a project excluded/);
  c.projects[1].dependencies=[];c.supporters[1].allowed=["p2"];
  const r=solveCampaign(c);
  assert.equal(r.status,"blocked");assert.equal(r.eligible.p2,0);
});
test("duplicate, unauthorized, and partial contributions are rejected by independent witness",()=>{
  const c=two();const good=solveCampaign(c).certificate.allocations;
  assert.equal(verifyCampaignAllocation(c,good).valid,true);
  assert.equal(verifyCampaignAllocation(c,[...good,good[0]]).valid,false);
  assert.match(verifyCampaignAllocation(c,[...good,good[0]]).errors.join(" "),/more than once/);
  const wrong=structuredClone(good);wrong[0].projectId="p2";
  assert.equal(verifyCampaignAllocation(c,wrong).valid,false);
  const partial=structuredClone(good);partial[0].amount=1;
  assert.equal(verifyCampaignAllocation(c,partial).valid,false);
});
test("malformed records and larger-than-bounded campaigns fail closed",()=>{
  const c=two();c.projects[0].goal=1.5;
  assert.equal(solveCampaign(c).status,"invalid");
  c.projects[0].goal=3;c.supporters[1].allowed=[];
  assert.equal(solveCampaign(c).status,"invalid");
  c.supporters[1].allowed=["p2"];
  while(c.supporters.length<=CAMPAIGN_LIMITS.maxSupporters)c.supporters.push({
    id:"s"+(c.supporters.length+1),name:"Supporter",amount:1,allowed:["p1"],requires:[]});
  assert.equal(solveCampaign(c).status,"invalid");
});
test("caller models and source reference remain unchanged after custom calculations",()=>{
  const c=two();const before=structuredClone(c);
  solveCampaign(c);assert.deepEqual(c,before);
  assert.equal(MODEL.projects.a.required,4n);
});
