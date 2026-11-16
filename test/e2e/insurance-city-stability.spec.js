import {test,expect} from '@playwright/test';

async function open(page,width=1440){
 await page.setViewportSize({width,height:960});
 await page.addInitScript(()=>localStorage.setItem('listools-language','zh-Hans'));
 await page.goto('/insurance.html');const f=page.frameLocator('iframe[data-workspace-active]');
 await f.locator('#insurance-month').fill('2026-11');await f.locator('#insurance-salary').fill('20000');return f;
}
async function city(f,id){
 const picker=f.locator('#insurance-city-control');await picker.click();await picker.locator('input[type=search]').fill(id);
 await picker.locator('[data-choice-selectable][data-value="'+id+'"]').click();await expect(f.locator('#insurance-city')).toHaveValue(id);
}
const controls=['insurance-city-control','insurance-salary','insurance-housing-choice','insurance-run'];
const measure=f=>f.locator('body').evaluate(async(_,ids)=>{
 await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 return Object.fromEntries(ids.map(id=>{const {x,y,width,height}=document.getElementById(id).getBoundingClientRect();return[id,{x,y,width,height}];}));
},controls);

for(const width of [390,1440])test('Insurance keeps all primary controls in place across three city cycles at '+width,async({page},info)=>{
 const f=await open(page,width),measurements=[];
 for(let cycle=0;cycle<3;cycle++)for(const id of ['beijing','guangzhou','shenzhen']){
  await city(f,id);measurements.push({city:id,boxes:await measure(f)});
 }
 await info.attach('insurance-city-geometry',{body:JSON.stringify(measurements),contentType:'application/json'});
 for(const {city,boxes} of measurements)for(const id of controls)for(const key of ['x','y','width','height'])
  expect(Math.abs(boxes[id][key]-measurements[0].boxes[id][key]),id+' '+key+' in '+city).toBeLessThanOrEqual(1);
 await expect(f.locator('#insurance-month')).toHaveValue('2026-11');await expect(f.locator('#insurance-salary')).toHaveValue('20000');
});

test('Insurance city conditions retain drafts, invalidate old charts, and focus the submitted error',async({page})=>{
 const f=await open(page);await city(f,'shenzhen');
 const settings=f.locator('#insurance-city-settings'),summary=settings.locator('summary');
 if(!await settings.evaluate(n=>n.open))await summary.click();
 await expect(f.locator('#insurance-tier')).toBeVisible();await f.locator('#insurance-tier').selectOption('1');await f.locator('#insurance-hukou').check();
 await f.locator('#insurance-run').click();const personal=f.locator('[data-breakdown=personal]');await expect(personal).toBeVisible();
 await personal.evaluate(n=>{window.insuranceChart=n;});await f.locator('#insurance-run').click();
 expect(await personal.evaluate(n=>n===window.insuranceChart)).toBe(true);
 await f.locator('#insurance-tier').selectOption('0');await expect(personal).toHaveCount(0);await expect(f.locator('#insurance-exports')).toBeHidden();
 await city(f,'guangzhou');await city(f,'shenzhen');await expect(f.locator('#insurance-hukou')).toBeChecked();
 await f.locator('#insurance-housing-choice').selectOption('custom');await f.locator('#insurance-housing-employee').fill('13');await summary.click();
 await f.locator('#insurance-run').click();await expect(settings).toHaveAttribute('open');await expect(f.locator('#insurance-housing-employee')).toBeFocused();
 await f.locator('#insurance-housing-employee').fill('7');await f.locator('#insurance-run').click();await expect(personal).toBeVisible();
});

test('Insurance charts follow the chosen bases, participation and tax-assistant draft',async({page})=>{
 const f=await open(page);await city(f,'beijing');await f.locator('#insurance-month').fill('2026-08');await f.locator('#insurance-housing-choice').selectOption('7');
 await f.locator('#insurance-bases > summary').click();await f.locator('#insurance-mode').selectOption('actual');
 await f.locator('#insurance-base').fill('10000');await f.locator('#insurance-base-housing').fill('12000');
 await f.locator('#insurance-settings > summary').click();await f.locator('#insurance-base-pension').fill('11000');await f.locator('#insurance-active-unemployment').uncheck();
 await f.locator('#insurance-tax-settings > summary').click();await f.locator('#insurance-tax-enabled').check();await f.locator('#insurance-tax-help').click();
 await f.locator('#insurance-deduction-children').fill('1');await f.locator('#insurance-deduction-assistant-apply').click();await expect(f.locator('#insurance-tax-special')).toHaveValue('2000.00');
 await f.locator('#insurance-run').click();const personal=f.locator('[data-breakdown=personal]');await expect(f.locator('[data-value=employeeTotal]')).toHaveText('1,923.00');
 for(const [id,amount] of [['pension','880.00'],['medical','203.00'],['unemployment','0.00'],['housing','840.00']])await expect(personal.locator('[data-breakdown-item='+id+'] td').first()).toHaveText(amount);
 await expect(personal.locator('[data-breakdown-item=tax] td').first()).toHaveText(await f.locator('[data-value=currentTax]').textContent());await expect(personal.locator('[data-breakdown-item=beforeTax]')).toHaveCount(0);
 await f.locator('#insurance-base').fill('15000');await expect(personal).toHaveCount(0);await expect(f.locator('#insurance-base-pension')).toHaveValue('11000');await expect(f.locator('#insurance-base-housing')).toHaveValue('12000');
 await f.locator('#insurance-run').click();await expect(f.locator('[data-value=employeeTotal]')).toHaveText('2,023.00');await expect(f.locator('#insurance-tax-month-summary')).toContainText('2026-08');
});
