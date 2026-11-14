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
const panel = document.getElementById("pact-tour-panel");
const launcher = document.getElementById("pact-tour-open");
if (panel && launcher) {
  const $ = (selector) => panel.querySelector(selector);
  const welcome = $("#pact-tour-welcome");
  const guided = $("#pact-tour-guided");
  const next = $("#pact-tour-next");
  const back = $("#pact-tour-back");
  const visit = $("#pact-tour-visit");
  const exit = $("#pact-tour-exit");
  const stepsBar = [...panel.querySelectorAll(".pact-tour-track span")];
  let journey = "explore";
  let index = 0;
  let originFocus = null;
  let spotlight = null;

  function persist() {
    try { window.localStorage.setItem(STORAGE_KEY,"seen"); } catch {}
  }
  function clearTarget() {
    if (spotlight) spotlight.classList.remove("pact-tour-focus");
    spotlight = null;
  }
  function close(remember=true) {
    clearTarget();
    panel.hidden = true;
    panel.dataset.stage = "closed";
    panel.setAttribute("aria-labelledby","pact-tour-title");
    document.body.classList.remove("pact-tour-running");
    if (remember) persist();
    if (originFocus?.isConnected && originFocus !== document.body) originFocus.focus({preventScroll:true});
  }
  function open() {
    originFocus = document.activeElement;
    clearTarget();
    panel.hidden = false;
    panel.dataset.stage = "welcome";
    welcome.hidden = false;
    guided.hidden = true;
    panel.setAttribute("aria-labelledby","pact-tour-title");
    document.body.classList.remove("pact-tour-running");
  }
  function paint() {
    clearTarget();
    const step=journeys[journey][index];
    panel.hidden=false;
    panel.dataset.stage="guided";
    panel.dataset.step=String(index+1);
    panel.setAttribute("aria-labelledby","pact-tour-step-title");
    welcome.hidden=true;
    guided.hidden=false;
    document.body.classList.add("pact-tour-running");
    $("#pact-tour-current").textContent=journey === "explore" ? "SUPPORTER PATH" : "ORGANIZER PATH";
    $("#pact-tour-counter").textContent=String(index+1).padStart(2,"0")+" / 04";
    $("#pact-tour-location").textContent=step.location;
    $("#pact-tour-step-title").textContent=step.title;
    $("#pact-tour-step-copy").textContent=step.copy;
    $("#pact-tour-preview-label").textContent=step.preview;
    stepsBar.forEach((bar,i)=>bar.classList.toggle("active",i<=index));
    back.disabled=index===0;
    next.textContent=index===journeys[journey].length-1?"Finish ↗":"Next →";
    const target=document.querySelector(step.target);
    visit.disabled=!target;
    if(target){ spotlight=target;target.classList.add("pact-tour-focus"); }
  }
  function begin(mode){
    journey=Object.hasOwn(journeys,mode)?mode:"explore";
    index=0;
    paint();
    visit.focus({preventScroll:true});
  }
  launcher.addEventListener("click",()=>{open();$("#pact-tour-title").focus?.({preventScroll:true});});
  panel.querySelectorAll("[data-tour-journey]").forEach(btn=>{
    btn.addEventListener("click",()=>begin(btn.dataset.tourJourney));
  });
  function advance(){
    if(index+1>=journeys[journey].length){close();return;}
    index+=1;paint();visit.focus({preventScroll:true});
  }
  next.addEventListener("click",advance);
  back.addEventListener("click",()=>{if(index>0){index-=1;paint();visit.focus({preventScroll:true});}});
  visit.addEventListener("click",()=>{
    if(!spotlight)return;
    const reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    spotlight.scrollIntoView({behavior:reduce?"auto":"smooth",block:window.innerWidth<700?"start":"center"});
    spotlight.classList.add("pact-tour-target-live");
    // The destination stays interactive. The guide never clicks financial controls.
  });
  [$("#pact-tour-dismiss"),$("#pact-tour-skip"),exit].forEach(el=>el.addEventListener("click",()=>close()));
  document.addEventListener("keydown",e=>{if(!panel.hidden && e.key==="Escape"){e.preventDefault();close();}});
  let alreadySeen = false;
  try {alreadySeen=window.localStorage.getItem(STORAGE_KEY)==="seen";}catch{alreadySeen=true;}
  // Show the entry in the hero, never an unsolicited overlay that can block
  // creation or wallet actions. A tour is useful only if it leaves control with the visitor.
  if (!alreadySeen) {
    launcher.dataset.firstVisit = "true";
    launcher.setAttribute("aria-label", "First visit? Start a guided PACT walkthrough");
  }
}
