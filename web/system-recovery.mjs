// Fail-closed, read-only recovery notice. Does not repeat financial actions.
const notice=document.createElement("aside");
notice.id="pact-system-recovery";
notice.className="pact-system-recovery";
notice.hidden=true;
notice.setAttribute("role","alert");
notice.setAttribute("aria-label","Connection or loading status");
const marker=document.createElement("span");
marker.className="pact-recovery-marker";marker.textContent="!";
marker.setAttribute("aria-hidden","true");
const copy=document.createElement("div");copy.className="pact-recovery-copy";
const title=document.createElement("strong"),message=document.createElement("p");
copy.append(title,message);
const buttons=document.createElement("div");buttons.className="pact-recovery-controls";
const retry=document.createElement("button"),dismiss=document.createElement("button");
retry.type=dismiss.type="button";retry.textContent="Reload safely";dismiss.textContent="Dismiss";
buttons.append(retry,dismiss);notice.append(marker,copy,buttons);document.body.append(notice);
let reason=null;
function show(kind){
 reason=kind;notice.hidden=false;notice.dataset.reason=kind;
 if(kind==="offline"){
  title.textContent="Connection lost";
  message.textContent="Live testnet data and wallet operations may be unavailable. No transaction is automatically retried.";
  retry.textContent="Check connection";
 }else{
  title.textContent="Part of PACT could not load";
  message.textContent="Reload this page to recover. If you already submitted a transaction, check its receipt before trying again.";
  retry.textContent="Reload safely";
 }
}
dismiss.addEventListener("click",()=>notice.hidden=true);
retry.addEventListener("click",()=>{
 if(reason==="offline"&&!navigator.onLine){
  title.textContent="Still offline";
  message.textContent="Reconnect to the internet before checking live NEAR data.";
  return;
 }
 // Reloading a read-only page does not repeat an onchain transaction.
 location.reload();
});
window.addEventListener("offline",()=>show("offline"));
window.addEventListener("online",()=>{if(reason==="offline"){reason=null;notice.hidden=true}});
if(navigator.onLine===false)show("offline");
window.addEventListener("error",event=>{if(event.target===window)show("runtime")});
window.addEventListener("unhandledrejection",event=>{
 if(String(event.reason?.name||"")==="AbortError")return;
 show("runtime");
});

