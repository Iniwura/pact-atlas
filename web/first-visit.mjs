/* PACT / Field guide. Guided discovery only: no wallet operations and no mock transactions. */
const STORAGE_KEY = "pact-atlas-field-guide-v2";
const journeys = {
  explore: [
    {target:"#campaigns",location:"CAMPAIGN DIRECTORY",title:"See what's being funded.",copy:"Open a real NEAR testnet campaign. Its funding status, projects and conditions are visible before you act.",preview:"01 / PUBLIC AGREEMENTS"},
    {target:"#featured",location:"THE AGREEMENT",title:"Follow the dependency.",copy:"Beta can only receive funds when Alpha is also funded. PACT checks the complete agreement rather than an isolated amount.",preview:"02 / CONDITIONS"},
    {target:"#join-form",location:"SHARED CAMPAIGNS",title:"Open an agreement safely.",copy:"When someone shares a campaign, open its link here. PACT checks the configuration against its contract before showing the funding action.",preview:"03 / OPEN AN AGREEMENT"},
    {target:"#activity",location:"PUBLIC HISTORY",title:"Check the result.",copy:"Every recorded contribution and payout has a public receipt. Historical testnet evidence is not a live payment or a security audit.",preview:"04 / VERIFIED RECORDS"}
  ],
  create: [
    {target:".entryway[href='./create.html']",location:"CREATE A CAMPAIGN",title:"Start with the projects.",copy:"Create names and funding targets, then define exactly which projects each supporter is willing to fund.",preview:"01 / BUILD AN AGREEMENT"},
    {target:"#featured",location:"HOW CONDITIONS WORK",title:"Make dependencies explicit.",copy:"Choose which outcomes must happen together. A valid allocation must satisfy every recorded condition.",preview:"02 / COMMITMENTS"},
    {target:"#campaigns",location:"PUBLIC CAMPAIGNS",title:"Review the real examples.",copy:"Compare your plan with real deployed testnet campaigns before asking a wallet to approve any transaction.",preview:"03 / ACTUAL CAMPAIGNS"},
    {target:"#activity",location:"FINAL RECEIPTS",title:"Prove the outcome.",copy:"Review finalized public receipts. A proposed or submitted transaction never counts as a confirmed payout.",preview:"04 / RECEIPTS"}
  ]
};
const panel=document.getElementById("pact-tour-panel");
const launcher=document.getElementById("pact-tour-open");
if(panel&&launcher){
  const $=s=>panel.querySelector(s);
  const welcome=$("#pact-tour-welcome"),guided=$("#pact-tour-guided");
  const backdrop=document.getElementById("pact-tour-backdrop");
  const cutout=document.getElementById("pact-tour-spotlight");
  const next=$("#pact-tour-next"),back=$("#pact-tour-back"),visit=$("#pact-tour-visit");
  const bars=[...panel.querySelectorAll(".pact-tour-track span")];
  let journey="explore",index=0,origin=null,spotlight=null;
  function persist(){try{localStorage.setItem(STORAGE_KEY,"seen")}catch{}}
  function clear(){
    spotlight?.classList.remove("pact-tour-focus","pact-tour-target-live");
    spotlight=null;cutout.hidden=true;
  }
  function close(){
    clear();panel.hidden=true;backdrop.hidden=true;panel.dataset.stage="closed";
    panel.setAttribute("aria-modal","false");
    panel.setAttribute("aria-labelledby","pact-tour-title");
    document.body.classList.remove("pact-tour-running","pact-tour-welcome-open");
    persist();if(origin?.isConnected&&origin!==document.body)origin.focus({preventScroll:true});
  }
  function open(){
    origin=document.activeElement;clear();
    panel.hidden=false;panel.dataset.stage="welcome";
    welcome.hidden=false;guided.hidden=true;backdrop.hidden=false;
    panel.setAttribute("aria-modal","true");
    panel.setAttribute("aria-labelledby","pact-tour-title");
    document.body.classList.add("pact-tour-welcome-open");
    document.body.classList.remove("pact-tour-running");
    $("#pact-tour-title").focus({preventScroll:true});
  }
  function targetRect(){
    if(!spotlight)return null;
    if(spotlight.id==="campaigns")return spotlight.querySelector(".campaign-tile")?.getBoundingClientRect()||spotlight.getBoundingClientRect();
    if(spotlight.id==="activity")return spotlight.querySelector(".activity-entry")?.getBoundingClientRect()||spotlight.getBoundingClientRect();
    if(spotlight.id==="featured")return spotlight.querySelector(".feature-panel")?.getBoundingClientRect()||spotlight.getBoundingClientRect();
    return spotlight.getBoundingClientRect();
  }
  function updateSpotlight(){
    if(panel.hidden||panel.dataset.stage!=="guided"||!spotlight){cutout.hidden=true;return}
    const r=targetRect();
    if(!r||!r.width||r.bottom<5||r.top>innerHeight-5){cutout.hidden=true;return}
    const pad=innerWidth<700?4:10;
    const l=Math.max(7,r.left-pad),t=Math.max(7,r.top-pad);
    const right=Math.min(innerWidth-7,r.right+pad),bottom=Math.min(innerHeight-7,r.bottom+pad);
    if(right<=l||bottom<=t){cutout.hidden=true;return}
    Object.assign(cutout.style,{left:l+"px",top:t+"px",width:right-l+"px",height:bottom-t+"px"});
    cutout.hidden=false;
  }
  function go(smooth=false){
    if(!spotlight)return;
    const r=targetRect();
    const top=Math.max(0,scrollY+r.top-(innerWidth<700?125:130));
    const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
    scrollTo({top,behavior:smooth&&!reduce?"smooth":"instant"});
    spotlight.classList.add("pact-tour-target-live");
    requestAnimationFrame(updateSpotlight);
  }
  function paint(){
    clear();
    const step=journeys[journey][index];
    panel.hidden=false;panel.dataset.stage="guided";panel.dataset.step=String(index+1);
    panel.setAttribute("aria-modal","false");
    panel.setAttribute("aria-labelledby","pact-tour-step-title");
    welcome.hidden=true;guided.hidden=false;backdrop.hidden=true;
    document.body.classList.add("pact-tour-running");
    document.body.classList.remove("pact-tour-welcome-open");
    $("#pact-tour-current").textContent=journey==="explore"?"SUPPORTER PATH":"ORGANIZER PATH";
    $("#pact-tour-counter").textContent=String(index+1).padStart(2,"0")+" / "+String(journeys[journey].length).padStart(2,"0");
    $("#pact-tour-location").textContent=step.location;
    $("#pact-tour-step-title").textContent=step.title;
    $("#pact-tour-step-copy").textContent=step.copy;
    $("#pact-tour-preview-label").textContent=step.preview;
    bars.forEach((bar,i)=>bar.classList.toggle("active",i<=index));
    back.disabled=index===0;next.textContent=index===journeys[journey].length-1?"Finish ↗":"Next →";
    const target=document.querySelector(step.target);
    visit.disabled=!target;
    if(target){spotlight=target;target.classList.add("pact-tour-focus");go(false)}
    requestAnimationFrame(updateSpotlight);
  }
  launcher.addEventListener("click",open);
  const headerLauncher=document.getElementById("pact-guide-header");
  headerLauncher?.addEventListener("click",open);
  backdrop.addEventListener("click",()=>{if(panel.dataset.stage==="welcome")close()});
  panel.querySelectorAll("[data-tour-journey]").forEach(button=>{
    button.addEventListener("click",()=>{
      journey=Object.hasOwn(journeys,button.dataset.tourJourney)?button.dataset.tourJourney:"explore";
      index=0;paint();visit.focus({preventScroll:true});
    });
  });
  next.addEventListener("click",()=>{
    if(index+1>=journeys[journey].length){close();return}
    index++;paint();visit.focus({preventScroll:true});
  });
  back.addEventListener("click",()=>{
    if(index>0){index--;paint();visit.focus({preventScroll:true})}
  });
  visit.addEventListener("click",()=>go(true));
  [$("#pact-tour-dismiss"),$("#pact-tour-skip"),$("#pact-tour-exit")].forEach(button=>button.addEventListener("click",close));
  document.addEventListener("keydown",event=>{
    if(panel.hidden)return;
    if(event.key==="Escape"){event.preventDefault();close();return}
    if(event.key!=="Tab"||panel.dataset.stage!=="welcome")return;
    const buttons=[...panel.querySelectorAll("button:not([disabled])")].filter(b=>!b.closest("[hidden]"));
    if(!buttons.length)return;
    if(event.shiftKey&&document.activeElement===buttons[0]){event.preventDefault();buttons.at(-1).focus()}
    else if(!event.shiftKey&&document.activeElement===buttons.at(-1)){event.preventDefault();buttons[0].focus()}
  });
  window.addEventListener("scroll",updateSpotlight,{passive:true});
  window.addEventListener("resize",updateSpotlight,{passive:true});
  let seen=false;try{seen=localStorage.getItem(STORAGE_KEY)==="seen"}catch{seen=true}
  if(!seen){launcher.dataset.firstVisit="true";launcher.setAttribute("aria-label","First visit? Start a guided PACT walkthrough");if(headerLauncher)headerLauncher.dataset.firstVisit="true"}
  if(new URLSearchParams(location.search).get("tour")==="1")open();
}
