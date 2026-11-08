/**
 * Offline custom-campaign calculator. It models whole commitments, permitted
 * destinations, conditional pledges and project dependencies.
 *
 * NOT an onchain PACT campaign, funding transaction, or proof of settlement.
 * The original fixed reference model and contract are not modified.
 */
export const CAMPAIGN_LIMITS=Object.freeze({maxProjects:5,maxSupporters:8,maxAmount:100,maxSearchStates:300000});
const int=x=>Number.isSafeInteger(x)&&x>=1&&x<=CAMPAIGN_LIMITS.maxAmount;
const sum=a=>a.reduce((v,x)=>v+x,0);
const nameOK=(s,max=50)=>typeof s==="string"&&s.trim().length>0&&s.trim().length<=max;
const unique=a=>new Set(a).size===a.length;

export function validateCampaign(c){
  if(!c||typeof c!=="object"||Array.isArray(c))return ["Campaign must be an object."];
  const errors=[];
  if(!nameOK(c.title,70))errors.push("Campaign needs a title of 1–70 characters.");
  const projects=c.projects, supporters=c.supporters;
  if(!Array.isArray(projects)||projects.length<1||projects.length>CAMPAIGN_LIMITS.maxProjects)errors.push("Use 1–5 projects.");
  if(!Array.isArray(supporters)||supporters.length<1||supporters.length>CAMPAIGN_LIMITS.maxSupporters)errors.push("Add 1–8 supporters.");
  if(!Array.isArray(projects)||!Array.isArray(supporters))return errors;
  const projectIds=projects.map(p=>p?.id);
  if(!unique(projectIds)||projectIds.some(id=>typeof id!=="string"||!/^[a-z][a-z0-9]{0,11}$/.test(id)))errors.push("Project IDs must be unique and valid.");
  const active=new Set(projects.filter(p=>p && p.included!==false).map(p=>p.id));
  if(!active.size)errors.push("Include at least one project.");
  for(const p of projects){
    if(!p||!nameOK(p.name)){errors.push("Each project needs a name of 1–50 characters.");continue;}
    if(!int(p.goal))errors.push(p.name+": goal must be 1–100 whole NEAR.");
    if(!Array.isArray(p.dependencies)||!unique(p.dependencies)||p.dependencies.some(id=>!projectIds.includes(id)||id===p.id))
      errors.push(p.name+": choose valid, distinct dependencies.");
    else if(active.has(p.id)&&p.dependencies.some(id=>!active.has(id)))
      errors.push(p.name+" depends on a project excluded from this plan.");
  }
  const supporterIds=supporters.map(s=>s?.id);
  if(!unique(supporterIds)||supporterIds.some(id=>typeof id!=="string"||!/^[a-z][a-z0-9]{0,11}$/.test(id)))errors.push("Supporter IDs must be unique and valid.");
  for(const s of supporters){
    if(!s||!nameOK(s.name)){errors.push("Each supporter needs a name of 1–50 characters.");continue;}
    if(!int(s.amount))errors.push(s.name+": commitment must be 1–100 whole NEAR.");
    if(!Array.isArray(s.allowed)||!s.allowed.length||!unique(s.allowed)||s.allowed.some(id=>!projectIds.includes(id)))
      errors.push(s.name+": choose at least one permitted destination.");
    if(!Array.isArray(s.requires)||!unique(s.requires)||s.requires.some(id=>!projectIds.includes(id)))
      errors.push(s.name+": choose valid conditional projects.");
  }
  return errors;
}

/** Independent verification of a proposed allocation, not a contract audit. */
export function verifyCampaignAllocation(c,allocations){
  const errors=validateCampaign(c);
  if(errors.length)return {valid:false,errors};
  if(!Array.isArray(allocations))return {valid:false,errors:["Allocation must be an array."]};
  const projects=c.projects.filter(p=>p.included!==false);
  const targets=new Set(projects.map(p=>p.id));
  const pledges=new Map(c.supporters.map(s=>[s.id,s]));
  const totals=new Map(projects.map(p=>[p.id,0]));
  const used=new Set();
  for(const row of allocations){
    if(!row||!pledges.has(row.supporterId)){errors.push("Unknown supporter in allocation.");continue;}
    const s=pledges.get(row.supporterId);
    if(used.has(row.supporterId))errors.push(s.name+" was allocated more than once.");
    used.add(row.supporterId);
    if(!targets.has(row.projectId)){errors.push(s.name+" assigned to an excluded or unknown project.");continue;}
    if(!s.allowed.includes(row.projectId))errors.push(s.name+" does not permit that project.");
    if(!s.requires.every(id=>targets.has(id)))errors.push(s.name+"'s conditions were not met.");
    if(row.amount!==s.amount)errors.push(s.name+"'s commitment must be assigned whole.");
    totals.set(row.projectId,totals.get(row.projectId)+row.amount);
  }
  for(const p of projects){
    if(totals.get(p.id)!==p.goal)errors.push(p.name+" does not have exactly "+p.goal+" NEAR.");
    if(!p.dependencies.every(id=>targets.has(id)))errors.push(p.name+"'s dependencies are not funded.");
  }
  const assigned=sum([...used].map(id=>pledges.get(id).amount));
  const committed=sum(c.supporters.map(s=>s.amount));
  if(assigned>committed)errors.push("Assigned capital exceeds committed capital.");
  return {valid:errors.length===0,errors,assigned,committed,unused:committed-assigned,
    totals:Object.fromEntries(totals),
    checks:{wholePledges:true,oneUse:true,permissions:true,conditions:true,dependencies:true,exactGoals:true,conservation:true}};
}

export function solveCampaign(c){
  const errors=validateCampaign(c);
  if(errors.length)return {status:"invalid",errors,certificate:null};
  const selected=c.projects.filter(p=>p.included!==false);
  const selectedIds=new Set(selected.map(p=>p.id));
  const required=sum(selected.map(p=>p.goal));
  const committed=sum(c.supporters.map(s=>s.amount));
  const eligible=Object.fromEntries(selected.map(p=>[p.id,sum(c.supporters
    .filter(s=>s.allowed.includes(p.id)&&s.requires.every(id=>selectedIds.has(id)))
    .map(s=>s.amount))]));
  const issues=[];
  if(committed<required)issues.push((required-committed)+" more NEAR is needed.");
  for(const p of selected)if(eligible[p.id]<p.goal)issues.push(p.name+" needs "+p.goal+" NEAR but only "+eligible[p.id]+" NEAR can support it.");
  const context={title:c.title,required,committed,shortfall:Math.max(0,required-committed),
    eligible,targets:selected.map(p=>p.id),issues};
  if(issues.length)return {status:"blocked",...context,reason:issues[0],certificate:null};
  const totals=Object.fromEntries(selected.map(p=>[p.id,0]));
  const rows=[];
  let states=0,solution=null,overBudget=false;
  const walk=index=>{
    if(solution||overBudget)return;
    if(++states>CAMPAIGN_LIMITS.maxSearchStates){overBudget=true;return;}
    if(index===c.supporters.length){
      if(selected.every(p=>totals[p.id]===p.goal))solution=rows.map(r=>({...r}));
      return;
    }
    const s=c.supporters[index];
    if(s.requires.every(id=>selectedIds.has(id))){
      for(const id of s.allowed){
        if(!selectedIds.has(id))continue;
        const goal=selected.find(p=>p.id===id).goal;
        if(totals[id]+s.amount>goal)continue;
        totals[id]+=s.amount;
        rows.push({supporterId:s.id,projectId:id,amount:s.amount});
        walk(index+1);
        rows.pop();totals[id]-=s.amount;
        if(solution||overBudget)return;
      }
    }
    walk(index+1);
  };
  walk(0);
  if(overBudget)return {status:"undetermined",...context,states,certificate:null,
    reason:"The example exceeds the interactive calculation limit. Simplify it or verify it offline."};
  if(!solution)return {status:"blocked",...context,states,certificate:null,
    reason:"Supporters can fund only their permitted projects. Their whole contributions cannot be split or reused, so no arrangement covers every goal exactly."};
  const audit=verifyCampaignAllocation(c,solution);
  if(!audit.valid)return {status:"invalid",...context,errors:audit.errors,certificate:null};
  const projectMap=new Map(selected.map(p=>[p.id,p]));
  const supporterMap=new Map(c.supporters.map(s=>[s.id,s]));
  return {status:"fundable",...context,states,
    reason:"An exact funding plan satisfies every included project and permitted contribution.",
    certificate:{kind:"PACT-CUSTOM-OFFLINE-CERTIFICATE",network:"OFFLINE-NOT-ONCHAIN",
      title:c.title,allocations:solution.map(r=>({...r,
        supporter:supporterMap.get(r.supporterId).name,project:projectMap.get(r.projectId).name})),
      assigned:audit.assigned,unused:audit.unused,checks:audit.checks},
    audit};
}
