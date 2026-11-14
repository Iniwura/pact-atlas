/* PACT first-use guide. No wallet calls, payment simulation or automatic transactions. */
const key = "pact-atlas-console-tour-v1";
const tourSteps = [
  {target:"#campaigns",title:"Find a campaign.",copy:"Browse public testnet campaigns. Open one to inspect its funding conditions and recorded status."},
  {target:"#featured",title:"Understand the condition.",copy:"Alpha and Beta need a valid agreement before both projects can be paid. See their recorded outcome here."},
  {target:".new-button",title:"Create an agreement.",copy:"Set up a campaign and review its rules. Actual wallet signing is separate and must be explicitly approved."},
  {target:"#activity",title:"Check every receipt.",copy:"Inspect historical contributions, payouts and refunds. Public receipts do not guarantee production safety."}
];
const openButton = document.getElementById("pact-tour-open");
const panel = document.getElementById("pact-tour-panel");
if (openButton && panel) {
  let active = -1;
  let lastFocus = null;
  const title = panel.querySelector("#pact-tour-title");
  const copy = panel.querySelector("#pact-tour-copy");
  const count = panel.querySelector("#pact-tour-counter");
  const next = panel.querySelector("#pact-tour-next");
  const dismiss = panel.querySelector("#pact-tour-dismiss");
  const bars = Array.from(panel.querySelectorAll(".pact-tour-track span"));
  function clearFocus() { document.querySelectorAll(".pact-tour-focus").forEach(el => el.classList.remove("pact-tour-focus")); }
  function close(markSeen=true) {
    clearFocus(); panel.hidden = true; active = -1;
    if (markSeen) { try { localStorage.setItem(key,"seen"); } catch {} }
    if (lastFocus?.isConnected) lastFocus.focus({preventScroll:true});
  }
  function show(index) {
    clearFocus();
    active = index;
    const step = tourSteps[index];
    title.textContent = step.title;
    copy.textContent = step.copy;
    count.textContent = String(index + 1).padStart(2,"0") + " / 04";
    bars.forEach((bar,i) => bar.classList.toggle("active",i <= index));
    next.textContent = index === tourSteps.length-1 ? "Finish tour ↗" : "Next ↗";
    const el = document.querySelector(step.target);
    if (el) {
      el.classList.add("pact-tour-focus");
      if (index !== 0) el.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth",block:"center"});
    }
    panel.hidden = false;
    next.focus({preventScroll:true});
  }
  function start() { lastFocus = document.activeElement; show(0); }
  openButton.addEventListener("click", start);
  next.addEventListener("click", () => active >= tourSteps.length-1 ? close() : show(active+1));
  dismiss.addEventListener("click", () => close());
  document.addEventListener("keydown", event => { if (!panel.hidden && event.key === "Escape") close(); });
  let visited = false;
  try { visited = localStorage.getItem(key) === "seen"; } catch { visited = true; }
  if (!visited) start();
}
