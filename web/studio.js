
/**
 * Executable financial reference model, NOT the NEAR runtime or a proof that
 * the Rust implementation compiles. All financial values are BigInt yoctoNEAR.
 * A pledge must be allocated in full to ONE permitted project.
 */
const ONE = 10n ** 24n;
const fail = (message) => { throw new Error(message); };
const assert = (condition, message) => { if (!condition) fail(message); };
const sum = (numbers) => numbers.reduce((n, x) => n + x, 0n);

function verifyPlan(projects, pledges, allocations) {
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

function solve(projects, pledges) {
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

class EscrowModel {
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

function example() {
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

/**
 * Historical, user-supplied Codex benchmark summary for cfa67ef.
 * These figures are evidence labels, not computed by this demo's four-project model.
 * 'invalid' means an allocation did not satisfy the stated global constraints.
 * Never compare raw invalid project counts to valid funded project counts as wins.
 */
const BENCHMARKS = [
 {id:'dependency',label:'Dependency coalition',short:'A cycle of interdependent projects',budget:12,
   independent:{projects:4,allocated:13,topup:1,valid:false},
   threshold:{projects:3,allocated:10,topup:1,valid:false},
   pact:{projects:3,allocated:10,valid:true,exact:true},
   insight:'Three projects become feasible together. Independent funding claims four with 13N from a 12N budget, an impossible allocation.'},
 {id:'competing',label:'Competing coalitions',short:'Projects compete for the same constrained pledges',budget:15,
   independent:{projects:4,allocated:20,topup:5,valid:false},
   threshold:{projects:3,allocated:15,topup:5,valid:false},
   pact:{projects:2,allocated:10,valid:true,exact:true},
   insight:'PACT funds two projects without violating shared pledge restrictions. The larger baseline counts do not form valid coalitions.'},
 {id:'restricted',label:'Restricted budgets',short:'Contributions have explicit project permissions',budget:11,
   independent:{projects:3,allocated:12,topup:1,valid:false},
   threshold:{projects:2,allocated:8,topup:1,valid:false},
   pact:{projects:2,allocated:8,valid:true,exact:true},
   insight:'A funded arrangement must respect both the amount and the donor’s permitted destinations.'},
 {id:'mutual',label:'Mutual conditions',short:'Funding pledges require each other’s success',budget:12,
   independent:{projects:3,allocated:12,topup:0,valid:false},
   threshold:{projects:3,allocated:12,topup:0,valid:false},
   pact:{projects:3,allocated:12,valid:true,exact:true},
   insight:'All three projects are funded with an inspectable, dependency-closed allocation certificate.'},
 {id:'infeasible',label:'Infeasible network',short:'Some combinations cannot satisfy all commitments',budget:12,
   independent:{projects:2,allocated:9,topup:2,valid:false},
   threshold:{projects:2,allocated:10,topup:2,valid:false},
   pact:{projects:1,allocated:4,valid:true,exact:true},
   insight:'A smaller valid plan is preferable to reporting an impossible larger one as activated.'},
 {id:'large',label:'Larger network',short:'A wider project network with constrained allocations',budget:30,
   independent:{projects:8,allocated:29,topup:0,valid:false},
   threshold:{projects:8,allocated:29,topup:0,valid:false},
   pact:{projects:8,allocated:29,valid:true,exact:false},
   insight:'PACT reports a valid allocation for eight projects. Global optimality was not established for this larger example.'},
];

function verifyBenchmarkRecord(b) {
 if (!b || typeof b.budget !== 'number' || b.budget <= 0) return false;
 if (!['independent','threshold','pact'].every(k => Number.isInteger(b[k]?.projects) && b[k].projects >= 0 &&
     Number.isFinite(b[k]?.allocated) && b[k].allocated >= 0 && typeof b[k].valid === 'boolean')) return false;
 return b.pact.allocated <= b.budget && b.pact.valid === true && b.independent.valid === false && b.threshold.valid === false;
}



const $ = (q) => document.querySelector(q);
const $$ = (q) => Array.from(document.querySelectorAll(q));
const NEAR = (n) => BigInt(n) * ONE;
const projects = [
  { id:'a', required:NEAR(4), deps:['b','c'], beneficiary:'training.near', label:'Training Centre', short:'TRAINING', explanation:'Requires internet and equipment to be funded in the same coalition.' },
  { id:'b', required:NEAR(3), deps:['a'], beneficiary:'internet.near', label:'Internet Access', short:'INTERNET', explanation:'This network project only activates if the training centre is funded.' },
  { id:'c', required:NEAR(3), deps:['a'], beneficiary:'equipment.near', label:'Equipment', short:'EQUIPMENT', explanation:'Equipment is conditional on the training centre activating alongside it.' },
  { id:'d', required:NEAR(3), deps:[], beneficiary:'events.near', label:'Community Events', short:'EVENTS', explanation:'This independent project is short by one NEAR under the base commitments.' },
];
const originalPledges = [
  {owner:'Donor 01',amount:NEAR(3),allowed:['a','d'],requires:[]},
  {owner:'Donor 02',amount:NEAR(1),allowed:['a'],requires:['b','c']},
  {owner:'Donor 03',amount:NEAR(3),allowed:['b'],requires:['a']},
  {owner:'Donor 04',amount:NEAR(3),allowed:['c'],requires:['a']},
  {owner:'Donor 05',amount:NEAR(2),allowed:['d'],requires:[]},
];
const names={a:'Training',b:'Internet',c:'Equipment',d:'Events'};
const state={topped:false,selected:'a'};
const funds = (v) => Number(v/ONE);
function currentData(){
 const pledges=[...originalPledges];
 if(state.topped) pledges.push({owner:'Additional donor',amount:NEAR(1),allowed:['d'],requires:[]});
 const best=solve(projects, pledges);
 if(!best) throw new Error('No valid allocation certificate');
 const checked=verifyPlan(projects,pledges,best.allocations);
 return {pledges,best,checked,funded:new Set(checked.funded)};
}
function update(){
 const d=currentData();
 document.body.classList.toggle('topup-on',state.topped);
 $('#network-mode').textContent=state.topped?'TOP-UP / 13N AVAILABLE':'BASE / 12N AVAILABLE';
 $('#funded-count').innerHTML=`${d.funded.size}<span>/4</span>`;
 $('#topup-display').textContent=state.topped?'1 NEAR':'0 NEAR';
 $('#topup-button').setAttribute('aria-pressed',String(state.topped));
 $('#topup-caption').innerHTML=state.topped?'REMOVE THE ADDED 1N <b>↗</b>':'ADD THE MISSING 1N <b>↗</b>';
 $('#topup-foot').textContent=state.topped?'ALL FOUR PROJECTS FUNDED / CONDITIONS PRESERVED':'FOURTH PROJECT BLOCKED / CONDITIONS PRESERVED';
 for(const btn of $$('.graph-node')){
  const valid=d.funded.has(btn.dataset.project),selected=btn.dataset.project===state.selected;
  btn.classList.toggle('blocked',!valid);btn.classList.toggle('selected',selected);
  btn.setAttribute('aria-pressed',String(selected));
 }
 const p=projects.find(x=>x.id===state.selected);
 const allocated=d.checked.amounts.get(p.id);
 const isFunded=d.funded.has(p.id);
 $('#inspector-id').textContent=`0${projects.indexOf(p)+1} / 04`;
 $('#inspector-heading').replaceChildren(document.createTextNode(p.label), Object.assign(document.createElement('span'), {className:'period',textContent:'.'}));
 $('#inspector-description').textContent=p.explanation;
 $('#inspector-required').textContent=`${funds(p.required)} NEAR`;
 $('#inspector-allocated').textContent=`${funds(allocated)} NEAR`;
 $('#inspector-deps').textContent=p.deps.length?p.deps.map(x=>names[x]).join(' / ').toUpperCase():'NONE';
 $('#inspector-status').className=`state-tag ${isFunded?'good-tag':'block-tag'}`;
 $('#inspector-status').innerHTML=`<span>${isFunded?'✓':'×'}</span> ${isFunded?'CONSTRAINT-VALID':'NOT FUNDED'}`;
 $('#cert-total').textContent=`${funds(d.checked.allocated)} N`;
 $('#cert-count').textContent=`0${d.funded.size} / 04`;
 $('#cert-unused').textContent=`${d.pledges.reduce((n,p)=>n+p.amount,0n)/ONE-d.checked.allocated/ONE} N`;
 $('#pledge-rows').replaceChildren(...d.pledges.map((pledge, i) => {
   const target=d.best.allocations.find(x=>x.pledgeIndex===i);
   const row=document.createElement('div');row.className='pledge-row'+(target?'':' unused');
   const data=[['pledge-index',String(i+1).padStart(2,'0')],['pledge-owner',pledge.owner],['pledge-amount',`${funds(pledge.amount)} N`],['pledge-terms',`PERMITTED: ${pledge.allowed.map(id=>names[id]).join(', ')}${pledge.requires.length?' · REQUIRES: '+pledge.requires.map(id=>names[id]).join(', '):''}`],['pledge-route',target?`→ ${names[target.projectId].toUpperCase()}`:'UNALLOCATED']];
   for(const [cls,label] of data){const el=document.createElement('span');el.className=cls;el.textContent=label;row.appendChild(el)}
   return row;
 }));
 $('#certificate-rows').replaceChildren(...projects.map((proj,i)=>{
  const row=document.createElement('div');row.className='cert-row';
  const amount=d.checked.amounts.get(proj.id);const valid=d.funded.has(proj.id);
  const allocs=d.best.allocations.filter(a=>a.projectId===proj.id).map(a=>`#${String(a.pledgeIndex+1).padStart(2,'0')}`).join(', ')||'—';
  const cells=[['row-id',String(i+1).padStart(2,'0')],['row-project',proj.label],['row-route',`PLEDGES ${allocs} · ${funds(amount)}/${funds(proj.required)} N`],['row-valid'+(valid?'':' pending'),valid?'✓ VALID':'— UNFUNDED']];
  for(const [cls,label] of cells){const x=document.createElement('span');x.className=cls;x.textContent=label;row.appendChild(x);}return row;
 }));
 // Expose a bounded non-transactional certificate for independent UI checks.
 window.__pactModelState={topup:state.topped,funded:[...d.funded],allocatedNear:funds(d.checked.allocated),unusedNear:funds(d.pledges.reduce((n,p)=>n+p.amount,0n)-d.checked.allocated),valid:true};
}
$$('.graph-node').forEach(btn=>btn.addEventListener('click',()=>{state.selected=btn.dataset.project;update()}));
$('#topup-button').addEventListener('click',()=>{state.topped=!state.topped;update()});
const navToggle=$('#menu-toggle'),mobileNav=$('#mobile-menu');
function setMenuOpen(open) {
 navToggle.setAttribute('aria-expanded',String(open));
 navToggle.setAttribute('aria-label',open?'Close menu':'Open menu');
 mobileNav.hidden=!open;
}
navToggle.addEventListener('click',()=>setMenuOpen(navToggle.getAttribute('aria-expanded')!=='true'));
mobileNav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>setMenuOpen(false)));
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&!mobileNav.hidden){setMenuOpen(false);navToggle.focus()}
});
document.addEventListener('pointerdown',event=>{
 if(!mobileNav.hidden&&!mobileNav.contains(event.target)&&!navToggle.contains(event.target))setMenuOpen(false);
});
window.matchMedia('(min-width: 791px)').addEventListener('change',event=>{
 if(event.matches)setMenuOpen(false);
});
update();

function renderBenchmark(id){
 const data=BENCHMARKS.find(b=>b.id===id);
 if(!data || !verifyBenchmarkRecord(data)) throw new Error('Invalid benchmark evidence record');
 const root=$('#benchmark-results');
 root.replaceChildren();
 const context=document.createElement('div');context.className='bench-context';
 const title=document.createElement('h3');title.textContent=data.label;
 const note=document.createElement('p');note.textContent=data.short+` / ${data.budget} NEAR available`;
 context.append(title,note);root.append(context);
 const group=document.createElement('div');group.className='bench-approaches';
 for(const [key,label] of [['independent','INDEPENDENT'],['threshold','THRESHOLD'],['pact','PACT ATLAS']]){
  const item=data[key],col=document.createElement('div');col.className='bench-approach'+(key==='pact'?' pact':'');
  const top=document.createElement('div');top.className='bench-name';
  const name=document.createElement('span');name.textContent=label;
  const index=document.createElement('span');index.textContent=key==='pact'?'03 / 03':key==='threshold'?'02 / 03':'01 / 03';
  top.append(name,index);
  const num=document.createElement('div');num.className='bench-num';num.textContent=item.projects;
  const sub=document.createElement('small');sub.textContent='PROJECTS';num.append(sub);
  const rule=document.createElement('div');rule.className='bench-rule';
  const bottom=document.createElement('div');bottom.className='bench-bottom';
  const capital=document.createElement('span');capital.textContent=`${item.allocated} / ${data.budget} N ALLOCATED`;
  const status=document.createElement('span');status.className='bench-status';
  status.textContent=item.valid?(item.exact?'✓ EXACT VALID':'✓ VALID · OPTIMUM UNPROVEN'):'× CONSTRAINT-INVALID';
  bottom.append(capital,status);col.append(top,num,rule,bottom);group.append(col);
 }
 root.append(group);
 const closing=document.createElement('div');closing.className='bench-context-bottom';
 const emphasis=document.createElement('strong');emphasis.textContent=data.insight;
 const detail=document.createElement('span');detail.textContent='Raw counts from invalid plans are NOT successfully activated projects. No baseline runtime comparison is claimed.';
 closing.append(emphasis,detail);root.append(closing);
}
$('#benchmark-select').addEventListener('change',event=>renderBenchmark(event.target.value));
renderBenchmark('dependency');


