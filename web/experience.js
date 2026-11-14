/* PACT evidence theatre: narrative states are historical records, never live wallet activity. */
(() => {
  const theatre=document.querySelector("#real-proof");
  if (!theatre) return;
  const buttons=[...theatre.querySelectorAll("[data-evidence-step]")];
  const title=theatre.querySelector("#evidence-current-title");
  const kicker=theatre.querySelector("#evidence-current-kicker");
  const link=theatre.querySelector("#evidence-current-link");
  const live=theatre.querySelector("#evidence-announcement");
  const stateLabel=theatre.querySelector("#evidence-stage-state");
  const alphaAmount=theatre.querySelector(".evidence-project.alpha .evidence-amount");
  const betaAmount=theatre.querySelector(".evidence-project.beta .evidence-amount");
  function setAmount(el,label){
    if(!el)return;
    const amount=document.createElement("em");amount.textContent="1 NEAR";
    el.replaceChildren(document.createTextNode(label+" "),amount);
  }

  const receipts={
    pledges:{
      title:"Beta's conditional pledge arrives first.",
      kicker:"RECORDED / COMMITMENT",
      link:"View first commitment ↗",
      url:"https://testnet.nearblocks.io/txns/39QG8aueJBWZEcJYHZtVorjbyc9WJiJ1u9gdz9WjuDKN",
      announcement:"The Beta pledge arrived before Alpha was funded. This is a historical testnet transaction, not a simulated live payment."
    },
    conditions:{
      title:"The contract accepts the exact allocation.",
      kicker:"RECORDED / ACTIVATION",
      link:"View activation ↗",
      url:"https://testnet.nearblocks.io/txns/31FxH2YE9FEm7iq49AH6eXMvZYiFv7Y3jeqd8rThK96v",
      announcement:"After Alpha was also funded, the contract accepted a dependency-valid allocation certificate. This is recorded testnet evidence."
    },
    settled:{
      title:"Two beneficiaries paid. Zero liabilities remain.",
      kicker:"RECORDED / SETTLEMENT",
      link:"View final payout ↗",
      url:"https://testnet.nearblocks.io/txns/GuUpGeBNaygqoaepXPrmxbWgEzexoXgyxxFDZ617E9FX",
      announcement:"The historical record shows two completed beneficiary withdrawals and final zero liabilities. This does not mean browser-wallet signing has been verified."
    }
  };
  function select(step,notify=false){
    const item=receipts[step];if(!item)return;
    theatre.dataset.stage=step;
    setAmount(alphaAmount,{pledges:"AWAITING",conditions:"FUNDED",settled:"PAID"}[step]);
    setAmount(betaAmount,{pledges:"PLEDGED",conditions:"READY",settled:"PAID"}[step]);
    if(stateLabel)stateLabel.textContent={pledges:"01 / BETA'S PLEDGE IS RECORDED",conditions:"02 / BOTH REQUIREMENTS MET",settled:"03 / BOTH PAYOUTS FINALIZED"}[step];
    for(const button of buttons)button.setAttribute("aria-pressed",String(button.dataset.evidenceStep===step));
    title.textContent=item.title;kicker.textContent=item.kicker;link.textContent=item.link;link.href=item.url;
    if(notify)live.textContent=item.announcement;
  }
  buttons.forEach(button=>button.addEventListener("click",()=>select(button.dataset.evidenceStep,true)));
  select("pledges");
})();
