import {test,expect} from '@playwright/test';
const widths=[320,390,768,1160,1440];
test.describe('PACT premium experience integrity',()=>{
 for(const width of widths){
  test('real solver drives responsive Atlas at '+width+'px',async({page})=>{
   await page.setViewportSize({width,height:900});
   await page.goto('/');
   await expect(page.locator('#graph-outcome-label')).toHaveText('03 PROJECTS FUNDABLE');
   await expect(page.locator('#graph-allocated')).toContainText('10 / 12 NEAR');
   await page.locator('.graph-node[data-project="d"]').click();
   await expect(page.locator('#inspector-heading')).toHaveText('Community Events.');
   await expect(page.locator('#inspector-coverage')).toHaveText('0%');
   await page.locator('#topup-button').click();
   await expect(page.locator('#graph-outcome-label')).toHaveText('04 PROJECTS FUNDABLE');
   await expect(page.locator('#graph-allocated')).toContainText('13 / 13 NEAR');
   await expect(page.locator('#inspector-coverage')).toHaveText('100%');
   await expect(page.locator('.node-d')).toHaveAttribute('data-funding','fundable');
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
   expect(overflow).toBeLessThanOrEqual(1);
   await page.locator('.graph-node[data-project="a"]').click();
   await expect(page.locator('.node-b')).toHaveClass(/related/);
   await expect(page.locator('.node-c')).toHaveClass(/related/);
  });
  test('campaign lifecycle uses recorded history and reflows at '+width+'px',async({page})=>{
   await page.setViewportSize({width,height:900});
   await page.goto('/console');
   const first=page.locator('.campaign-tile[data-record="funded"]').first();
   const refund=page.locator('.campaign-tile[data-record="refund"]').first();
   await expect(first).toBeVisible();
   await expect(refund).toBeVisible();
   await expect(first.locator('.tile-step-copy strong')).toHaveText(['Pledged','Validated','Settled']);
   await expect(refund.locator('.tile-step-copy strong')).toHaveText(['Pledged','Expired','Refunded']);
   await page.waitForFunction(() => [...document.querySelectorAll('.tile-rpc')].every(x => !x.textContent.includes('Checking latest state')), null, {timeout:18000});
   const before=await first.evaluate(e=>e.getBoundingClientRect().height);
   await first.hover();
   const after=await first.evaluate(e=>e.getBoundingClientRect().height);
   expect(Math.abs(before-after)).toBeLessThanOrEqual(1);
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
   expect(overflow).toBeLessThanOrEqual(1);
  });
 }
 test('benchmark distinguishes invalid raw counts from valid allocations',async({page})=>{
  await page.goto('/');
  for(const value of ['dependency','competing','restricted','mutual','infeasible','larger']){
   const selector=page.locator('#benchmark-select');
   const options=await selector.locator('option').evaluateAll(items=>items.map(o=>o.value));
   if(!options.includes(value))continue;
   await selector.selectOption(value);
   await expect(page.locator('.bench-approach')).toHaveCount(3);
   await expect(page.locator('.bench-capital-visual')).toHaveCount(3);
   const records=await page.locator('.bench-approach').evaluateAll(cards=>cards.map(el=>{
     const fill=el.querySelector('.bench-budget-fill');
     return {valid:el.dataset.valid,cap:el.dataset.overLimit,ratio:parseFloat(fill.style.width),text:el.querySelector('.bench-budget-note').textContent};
   }));
   expect(records.every(r=>['true','false'].includes(r.valid)&&r.ratio>=0&&r.ratio<=100)).toBe(true);
   expect(records.every(r=>r.cap!=='true'||r.text.includes('OVER BUDGET'))).toBe(true);
  }
 });
 test('reduced motion disables theatrical animation',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  const anim=await page.locator('.atlas-core::before').count().catch(()=>0);
  const style=await page.locator('.atlas-core').evaluate(e=>getComputedStyle(e,'::before').animationName);
  expect(style).toBe('none');
 });
});

