import { CAMPAIGN_LIMITS, solveCampaign, validateCampaign } from "./campaign-solver.mjs";
import {
  PACT_WASM_SHA256,
  buildCampaignDeploymentRequest,
  campaignUrl,
  slugFor,
  validateDeployableCampaign,
} from "./campaign-chain.mjs";
import { ensureWalletAdapter } from "./wallet-selector-host.mjs";
import { notifyUser } from "./notification-center.mjs";

const $ = selector => document.querySelector(selector);
const element=(tag,cls="",content)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(content!==undefined)node.textContent=String(content);return node;};
const safeNumber=value=>value==="" ? NaN : Number(value);
const sum=items=>items.reduce((a,x)=>a+(Number.isSafeInteger(x)?x:0),0);
const store="pact-atlas-custom-campaign-v1";
const blank=()=>({
  title:"",projects:[
    {id:"p1",name:"",goal:1,dependencies:[],beneficiary:"",included:true}
  ],supporters:[]
});
const restore=()=>{try{const raw=localStorage.getItem(store);if(!raw)return blank();const obj=JSON.parse(raw);
  if(!obj||typeof obj!=="object"||!Array.isArray(obj.projects)||!Array.isArray(obj.supporters)||
    obj.projects.length>CAMPAIGN_LIMITS.maxProjects||obj.supporters.length>CAMPAIGN_LIMITS.maxSupporters||
    obj.projects.some(p=>!p||typeof p.id!=="string"||!Array.isArray(p.dependencies))||
    obj.supporters.some(s=>!s||typeof s.id!=="string"||!Array.isArray(s.allowed)||!Array.isArray(s.requires)))
    return blank();
  return obj;
}catch{return blank();}};
let campaign=restore();
let step=1,latest=null;

function save(){try{localStorage.setItem(store,JSON.stringify(campaign));}catch{}}
const deployedStore="pact-atlas-deployed-campaigns-v1";
function saveSuccessfulDeployment(deployed){
  // Only the fully finalized transaction path calls this. The saved data
  // contains public immutable campaign facts, never private signing keys.
  try{
    const previous=JSON.parse(localStorage.getItem(deployedStore)||"[]");
    const entries=Array.isArray(previous)?previous:[];
    const record=JSON.parse(JSON.stringify(deployed));
    const next=[record,...entries.filter(item=>item?.deployment?.contractId!==record.deployment.contractId)].slice(0,12);
    localStorage.setItem(deployedStore,JSON.stringify(next));
  }catch{/* Storage can be unavailable: a shareable campaign link still exists. */}
}

function touch(){latest=null;save();renderPreview();hideErrors();}
function hideErrors(){const holder=$("#form-errors");holder.hidden=true;holder.replaceChildren();}
function showErrors(errors){const holder=$("#form-errors");holder.replaceChildren();
  const list=element("ul");errors.slice(0,6).forEach(error=>list.append(element("li","",error)));
  holder.append(list);holder.hidden=false;holder.scrollIntoView({block:"nearest",behavior:"smooth"});
  if(errors.length)notifyUser("error",errors[0],{title:"Check your campaign"});}

function nextId(type,records){let i=1;while(records.some(x=>x.id===type+i))i++;return type+i;}
function textField(label,value,fn,placeholder="",max=50){
  const wrapper=element("label","field");
  wrapper.append(element("span","field-title",label));
  const input=element("input");input.type="text";input.maxLength=max;input.placeholder=placeholder;input.value=value??"";
  input.addEventListener("input",()=>{fn(input.value);touch();});
  wrapper.append(input);return wrapper;
}
function numberField(label,value,fn){
  const wrapper=element("label","field");
  wrapper.append(element("span","field-title",label));
  const input=element("input");input.type="number";input.min="1";input.max="100";input.step="1";input.inputMode="numeric";
  input.value=Number.isFinite(value)?String(value):"";
  input.addEventListener("input",()=>{fn(safeNumber(input.value));touch();});
  wrapper.append(input);return wrapper;
}
function checklist(label,options,values,fn){
  const field=element("fieldset","rules-field");const legend=element("legend","",label);field.append(legend);
  if(!options.length){field.append(element("p","empty-rules","No other projects available."));return field;}
  const choices=element("div","choice-list");
  for(const option of options){
    const item=element("label","choice-pill");item.dataset.projectId=option.id;
    const input=element("input");input.type="checkbox";input.checked=values.includes(option.id);
    const caption=element("span","",option.name?.trim()||"Unnamed project");
    input.addEventListener("change",()=>{
      const current=new Set(values);
      if(input.checked)current.add(option.id);else current.delete(option.id);
      fn([...current]);touch();renderForm();
    });
    item.append(input,caption);choices.append(item);
  }
  field.append(choices);return field;
}
function heading(title,help){
  const wrapper=element("div","section-intro");
  wrapper.append(element("h3","",title),element("p","",help));return wrapper;
}
function actionButton(label,fn,cls="quiet-button"){
  const button=element("button",cls,label);button.type="button";button.addEventListener("click",fn);return button;
}

function projectRow(p,index){
  const article=element("article","edit-item");article.dataset.project=p.id;
  const head=element("div","edit-item-head");
  const name=element("span","item-number","PROJECT "+String(index+1).padStart(2,"0"));
  const remove=actionButton("Remove",()=>{
    campaign.projects=campaign.projects.filter(x=>x.id!==p.id);
    campaign.projects.forEach(x=>x.dependencies=x.dependencies.filter(id=>id!==p.id));
    campaign.supporters.forEach(s=>{s.allowed=s.allowed.filter(id=>id!==p.id);s.requires=s.requires.filter(id=>id!==p.id);});
    touch();renderForm();
  });
  remove.disabled=campaign.projects.length<=1;
  head.append(name,remove);
  const fields=element("div","edit-fields");
  fields.append(textField("Project name",p.name,v=>{
      p.name=v;
      // Keep names in dependency choices synchronized without replacing inputs
      // or disrupting keyboard focus during typing.
      document.querySelectorAll(".choice-pill[data-project-id]").forEach(choice=>{
        if(choice.dataset.projectId===p.id){
          const caption=choice.querySelector("span");
          if(caption)caption.textContent=v.trim()||"Unnamed project";
        }
      });
    },"e.g. Community Wi-Fi"),
    numberField("Goal · NEAR",p.goal,v=>p.goal=v),
    textField("Beneficiary · *.testnet",p.beneficiary,v=>p.beneficiary=v,"e.g. project.testnet",64));
  const included=element("label","include-toggle");
  const toggle=element("input");toggle.type="checkbox";toggle.checked=p.included!==false;
  toggle.addEventListener("change",()=>{p.included=toggle.checked;touch();renderForm();});
  included.append(toggle,element("span","","Include in funding plan"));
  article.append(head,fields,included,
    checklist("Only works if these projects are also funded",
      campaign.projects.filter(x=>x.id!==p.id),p.dependencies,values=>p.dependencies=values));
  return article;
}
function supporterRow(s,index){
  const article=element("article","edit-item");article.dataset.supporter=s.id;
  const head=element("div","edit-item-head");
  head.append(element("span","item-number","SUPPORTER "+String(index+1).padStart(2,"0")),
    actionButton("Remove",()=>{campaign.supporters=campaign.supporters.filter(x=>x.id!==s.id);touch();renderForm();}));
  const fields=element("div","edit-fields");
  fields.append(textField("Supporter name",s.name,v=>s.name=v,"e.g. Alex"),
    numberField("Commitment · NEAR",s.amount,v=>s.amount=v));
  article.append(head,fields,
    checklist("This money may fund",campaign.projects,s.allowed,values=>s.allowed=values),
    checklist("Only if these projects are funded",campaign.projects,s.requires,values=>s.requires=values));
  return article;
}
function renderForm(){
  const pane=$("#step-content");pane.replaceChildren();
  if(step===1){
    pane.append(heading("Which projects need funding?","Start with the goal for each project. Projects may depend on one another."));
    campaign.projects.forEach((p,i)=>pane.append(projectRow(p,i)));
    const add=actionButton("+ Add project",()=>{
      if(campaign.projects.length>=CAMPAIGN_LIMITS.maxProjects)return;
      campaign.projects.push({id:nextId("p",campaign.projects),name:"",goal:1,dependencies:[],included:true});
      touch();renderForm();
    },"add-button");
    add.disabled=campaign.projects.length>=CAMPAIGN_LIMITS.maxProjects;
    pane.append(add);
  } else if(step===2){
    pane.append(heading("Who is contributing?","Each supporter chooses where their full contribution may go. PACT will never count it twice."));
    campaign.supporters.forEach((s,i)=>pane.append(supporterRow(s,i)));
    const add=actionButton("+ Add supporter",()=>{
      if(campaign.supporters.length>=CAMPAIGN_LIMITS.maxSupporters)return;
      campaign.supporters.push({id:nextId("s",campaign.supporters),name:"Supporter "+(campaign.supporters.length+1),amount:1,
        allowed:campaign.projects[0]?[campaign.projects[0].id]:[],requires:[]});
      touch();renderForm();
    },"add-button");
    add.disabled=campaign.supporters.length>=CAMPAIGN_LIMITS.maxSupporters;
    pane.append(add);
  } else {
    const result=latest??solveCampaign(campaign);latest=result;
    pane.append(heading("Your funding plan","Review the proposed allocation. No NEAR moves before a separately approved testnet transaction."));
    const verdict=element("div","editor-verdict");
    const status=result.status==="fundable"?"A valid plan exists":
      result.status==="blocked"?"The funding conditions aren't met":
      result.status==="undetermined"?"More analysis is needed":"Please correct the campaign";
    verdict.append(element("span","verdict-kicker",result.status.toUpperCase()),
      element("h3","",status),element("p","",result.reason||"Check the campaign details."));
    pane.append(verdict);
    if(result.status==="fundable"||result.status==="blocked"){
      pane.append(element("p","plan-detail","PACT either assigns an entire contribution to one allowed project or leaves it unassigned. No partial spending."));
      pane.append(actionButton("Export funding plan ↗",download,"export-button"));
    }
    if(result.status==="fundable") pane.append(renderChainLaunch());
    if(result.status!=="fundable")pane.append(actionButton("Edit supporters",()=>changeStep(2),"quiet-button"));
  }
  $(".creator-steps").querySelectorAll("button").forEach((button,i)=>{
    if(i+1===step)button.setAttribute("aria-current","step");else button.removeAttribute("aria-current");
  });
  $("#previous-step").disabled=step===1;
  $("#next-step").hidden=step===3;
  $("#next-step").innerHTML=step===2?"Check funding <span aria-hidden='true'>↗</span>":"Continue <span aria-hidden='true'>↗</span>";
  renderPreview();
}

function chainParagraph(text){ return element("p","chain-copy",text); }

function renderChainLaunch(){
  const section=element("section","chain-launch");
  section.setAttribute("aria-labelledby","chain-launch-title");
  const title=element("h3","","Put this plan on NEAR testnet"); title.id="chain-launch-title";
  section.append(element("span","chain-kicker","OPTIONAL / REAL TESTNET"),title,
    chainParagraph("Deploying creates a new campaign account, installs the preserved PACT contract, and initializes these exact projects. Every step appears in one wallet approval. No mainnet accounts are accepted."));
  const fields=element("div","chain-fields");
  const slug=element("label","chain-field"); slug.append(element("span","","Campaign account slug"));
  const slugInput=element("input"); slugInput.id="deployment-slug"; slugInput.value=campaign.deployment?.slug||slugFor(campaign.title); slugInput.maxLength=32; slugInput.pattern="[a-z][a-z0-9-]{1,31}"; slugInput.autocomplete="off"; slug.append(slugInput);
  const authority=element("label","chain-field"); authority.append(element("span","","Activation authority · *.testnet"));
  const authorityInput=element("input"); authorityInput.id="deployment-authority"; authorityInput.value=campaign.deployment?.authority||""; authorityInput.placeholder="Your account, or a DAO account"; authorityInput.maxLength=64; authorityInput.autocomplete="off"; authority.append(authorityInput);
  const activation=element("label","chain-field"); activation.append(element("span","","Activation opens after"));
  const activationInput=element("select"); activationInput.id="deployment-activation-delay";
  [["60000","1 minute"],["300000","5 minutes"],["1800000","30 minutes"]].forEach(([value,label])=>{const option=element("option","",label);option.value=value;option.selected=String(campaign.deployment?.activateDelayMs||300000)===value;activationInput.append(option);}); activation.append(activationInput);
  const expiry=element("label","chain-field"); expiry.append(element("span","","Campaign expires after"));
  const expiryInput=element("select"); expiryInput.id="deployment-deadline-delay";
  [["3600000","1 hour"],["86400000","24 hours"],["604800000","7 days"]].forEach(([value,label])=>{const option=element("option","",label);option.value=value;option.selected=String(campaign.deployment?.deadlineDelayMs||86400000)===value;expiryInput.append(option);}); expiry.append(expiryInput);
  fields.append(slug,authority,activation,expiry); section.append(fields);
  const button=actionButton("Connect wallet and deploy campaign ↗",()=>deployCampaign({slugInput,authorityInput,activationInput,expiryInput}),"chain-deploy-button"); button.id="deploy-campaign"; section.append(button);
  const result=element("div","chain-result"); result.id="chain-result"; result.setAttribute("role","status"); result.setAttribute("aria-live","polite"); section.append(result);
  if(campaign.deployment?.contractId){
    result.dataset.tone="success";
    result.append(element("strong","","LIVE TESTNET CAMPAIGN"),chainParagraph("This campaign has a public account. Share the link below; it contains no private keys."));
    const link=campaignUrl(campaign.deployment.contractId,campaign,window.location.href);
    const anchor=document.createElement("a"); anchor.href=link; anchor.target="_blank"; anchor.rel="noopener"; anchor.className="chain-share-link"; anchor.textContent=link;
    result.append(anchor);
    result.append(element("small","","Deployment transaction: "+campaign.deployment.transactionHash));
  }
  return section;
}

async function wasmBytes(){
  const response=await fetch("/api/pact-wasm",{cache:"no-store"});
  if(!response.ok)throw new Error("The preserved PACT Wasm artifact is unavailable.");
  const bytes=new Uint8Array(await response.arrayBuffer());
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),value=>value.toString(16).padStart(2,"0")).join("");
  if(hash!==PACT_WASM_SHA256)throw new Error("The downloaded Wasm does not match the preserved PACT build; deployment stopped.");
  return bytes;
}

function chainState(message,tone="neutral"){
  const result=$("#chain-result"); if(!result)return; result.dataset.tone=tone; result.textContent=message;
  if(tone==="error"||tone==="warning") notifyUser(tone,message,{title:tone==="error"?"Deployment not completed":"Deployment status unknown"});
}

async function deployCampaign({slugInput,authorityInput,activationInput,expiryInput}){
  const slug=slugInput.value.trim().toLowerCase();
  const authority=authorityInput.value.trim().toLowerCase();
  const timing={activateDelayMs:Number(activationInput.value),deadlineDelayMs:Number(expiryInput.value)};
  const button=$("#deploy-campaign"); button.disabled=true;
  try{
    chainState("Connecting to a testnet wallet. The wallet must approve the deployment explicitly.","pending");
    const adapter=await ensureWalletAdapter();
    const owner=await adapter.connect();
    const errors=validateDeployableCampaign(campaign,{owner,authority:authority||owner,slug,timing});
    if(errors.length)throw new Error(errors[0]);
    campaign.deployment={slug,authority:authority||owner,activateDelayMs:timing.activateDelayMs,deadlineDelayMs:timing.deadlineDelayMs,owner};
    save();
    chainState("Loading and checking the preserved PACT Wasm…","pending");
    const request=buildCampaignDeploymentRequest(campaign,{owner,authority:authority||owner,slug,timing,wasm:await wasmBytes()});
    chainState(`Review ${request.estimatedAttachedNear} NEAR plus gas in your wallet. Nothing has been signed yet.`,"pending");
    const submitted=await adapter.call(request);
    if(!submitted?.transactionHash)throw new Error("The wallet returned no deployment hash; outcome is unknown and no retry was made.");
    let final=submitted;
    if(!final.confirmed&&typeof adapter.confirm==="function"){
      chainState(`Deployment submitted as ${submitted.transactionHash}. Checking finality without resubmitting…`,"pending");
      try{final=await adapter.confirm({transactionHash:submitted.transactionHash});}catch(error){button.dataset.outcome="unknown";button.disabled=true;chainState(`Deployment submitted as ${submitted.transactionHash}, but finality is unknown. Do not retry blindly.`,"warning");return;}
    }
    if(!final.confirmed){button.dataset.outcome="unknown";button.disabled=true;chainState(`Deployment submitted as ${submitted.transactionHash}, but finality is not verified. Do not retry blindly.`,"warning");return;}
    campaign.deployment={...campaign.deployment,contractId:request.campaignId,transactionHash:submitted.transactionHash,timing:request.timing};
    save(); saveSuccessfulDeployment(campaign); renderForm();
  }catch(error){chainState(error.message||"Deployment was not confirmed.","error");}
  finally{if(button.dataset.outcome!=="unknown")button.disabled=false;}
}
function plainPreview(){
  const selected=campaign.projects.filter(p=>p.included!==false);
  const committed=sum(campaign.supporters.map(s=>s.amount));
  const required=sum(selected.map(p=>p.goal));
  $("#preview-committed").textContent=String(committed);
  $("#preview-required").textContent=String(required);
  $("#preview-progress-bar").style.width=required>0?String(Math.min(100,100*committed/required))+"%":"0%";
  $("#preview-title").textContent=campaign.title?.trim()||"Your funding, at a glance.";
  $("#preview-subtitle").textContent=String(selected.length)+" projects · "+String(campaign.supporters.length)+" supporters";
  const list=$("#preview-projects");list.replaceChildren();
  for(const p of selected){
    const item=element("div","preview-project");
    item.append(element("span","",p.name?.trim()||"Unnamed project"),
      element("strong","",String(Number.isSafeInteger(p.goal)?p.goal:"—")+" NEAR"));
    list.append(item);
  }
  return {selected,committed,required};
}
function renderPreview(){
  plainPreview();
  const box=$("#preview-result");box.replaceChildren();
  if(step!==3){box.hidden=true;$("#preview-status").textContent="Editing";return;}
  box.hidden=false;
  const r=latest??solveCampaign(campaign);latest=r;
  $("#preview-status").textContent=r.status==="fundable"?"EXACT PLAN":r.status==="blocked"?"BLOCKED":"REVIEW";
  box.dataset.status=r.status;
  if(r.status==="fundable"){
    box.append(element("h3","","Where the money goes"));
    const groups=element("div","allocation-groups");
    for(const p of campaign.projects.filter(p=>p.included!==false)){
      const group=element("div","allocation-group");
      const head=element("div","allocation-head");
      head.append(element("strong","",p.name),element("span","",p.goal+" NEAR"));
      group.append(head);
      const rows=r.certificate.allocations.filter(row=>row.projectId===p.id);
      for(const row of rows)group.append(element("p","",row.supporter+" · "+row.amount+" NEAR"));
      groups.append(group);
    }
    box.append(groups);
    const checks=element("p","verified-checks","✓ Whole contributions  ✓ Allowed projects  ✓ Dependencies  ✓ No double-spending");
    box.append(checks,element("p","local-warning","Checked locally against the funding rules. No onchain transaction has occurred."));
    if(r.certificate.unused)box.append(element("p","unused-funds",r.certificate.unused+" NEAR is unassigned in this plan."));
  }else{
    box.append(element("h3","",r.status==="blocked"?"What prevents funding?":"Review your campaign"),
      element("p","",r.reason||r.errors?.join(" ")||"Enter valid project and supporter details."));
    if(r.issues?.length>1){
      const issues=element("ul");r.issues.slice(1,5).forEach(issue=>issues.append(element("li","",issue)));box.append(issues);
    }
  }
}
function projectErrors(){
  const temporary={...campaign,supporters:[{id:"temp",name:"Temporary",amount:1,
    allowed:campaign.projects[0]?[campaign.projects[0].id]:[],requires:[]}]};
  return validateCampaign(temporary);
}
function changeStep(requested){
  hideErrors();
  if(requested===2&&step===1){const errors=projectErrors();if(errors.length){showErrors(errors);return;}}
  if(requested===3){
    const errors=validateCampaign(campaign);if(errors.length){showErrors(errors);return;}
    latest=solveCampaign(campaign);
  }
  step=requested;renderForm();
  $("#campaign-editor").scrollIntoView({block:"start",behavior:"smooth"});
}
function download(){
  const r=latest??solveCampaign(campaign);
  const data={schema:"pact-offline-campaign-v1",network:"OFFLINE-NOT-ONCHAIN",
    scenario:campaign,result:r.status,certificate:r.certificate||null};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download="pact-campaign-proof.json";
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

$("#campaign-title").value=campaign.title??"";
$("#campaign-title").addEventListener("input",e=>{campaign.title=e.target.value;touch();});
$("#previous-step").addEventListener("click",()=>changeStep(Math.max(1,step-1)));
$("#next-step").addEventListener("click",()=>changeStep(step+1));
$("#step-projects").addEventListener("click",()=>changeStep(1));
$("#step-supporters").addEventListener("click",()=>changeStep(2));
$("#step-plan").addEventListener("click",()=>changeStep(3));
$("#start-blank").addEventListener("click",()=>{
  campaign=blank();step=1;latest=null;save();$("#campaign-title").value=campaign.title;hideErrors();renderForm();
});
renderForm();
