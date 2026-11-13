import {test,expect} from '@playwright/test';
const tool=p=>p.frameLocator('iframe[data-workspace-active]');
async function open(page,task='annual'){await page.addInitScript(()=>localStorage.setItem('listools-language','zh-Hans'));await page.goto('/tax.html#'+task);const f=tool(page);await f.locator(task==='annual'?'#tax-annual-salary':'#tax-salary').waitFor();await f.locator('#tax-year').evaluate(n=>{n.value='2026';n.dispatchEvent(new Event('change',{bubbles:true}));});return f;}
async function reveal(f,id){await f.locator('#'+id).evaluate(n=>{for(let p=n.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});}
async function city(f,prefix='tax-annual'){await reveal(f,prefix+'-source');await f.locator('#'+prefix+'-source').selectOption('city');const p=f.locator('#'+prefix+'-city-control');await p.click();await p.locator('input[type=search]').fill('beijing');await p.locator('[data-value=beijing][data-choice-selectable]').click();}
async function download(page,button){const [d]=await Promise.all([page.waitForEvent('download'),button.click()]);const s=await d.createReadStream(),a=[];for await(const c of s)a.push(c);return Buffer.concat(a).toString('utf8');}
test('annual city estimate respects the visible non-deductible payment setting',async({page})=>{
 const f=await open(page);await f.locator('#tax-annual-salary').fill('20000');await city(f);await reveal(f,'tax-annual-reduced');await f.locator('#tax-annual-reduced').check();await f.locator('#tax-annual-deductible').fill('1000');await f.locator('#tax-annual-run').click();await expect(f.locator('[data-value=contributions]')).toHaveText('54,036.00');await expect(f.locator('[data-value=annualTax]')).toHaveText('16,680.00');
});
test('annual city estimate respects visible taxable adjustments',async({page})=>{
 const f=await open(page);await f.locator('#tax-annual-salary').fill('20000');await city(f);await reveal(f,'tax-annual-adjustment');await f.locator('#tax-annual-adjustment').fill('1000');await f.locator('#tax-annual-run').click();await expect(f.locator('[data-value=annualTax]')).toHaveText('11,276.40');
});
test('monthly city estimates respect each visible non-deductible payment setting',async({page})=>{
 const f=await open(page);await f.locator('#tax-annual-salary').fill('20000');await city(f);await f.locator('#tax-annual-mode').selectOption('monthly');await reveal(f,'tax-a-1-reduced');await f.locator('#tax-a-1-reduced').check();await f.locator('#tax-a-1-deductible').fill('1000');await f.locator('#tax-annual-run').click();await expect(f.locator('[data-value=annualTax]')).toHaveText('10,426.70');
});
test('wage city estimates include the entered taxable adjustment',async({page})=>{
 const f=await open(page,'wage');await f.locator('#tax-period').fill('2026-11');await f.locator('#tax-salary').fill('20000');await city(f,'tax');await reveal(f,'tax-taxableAdjustment');await f.locator('#tax-taxableAdjustment').fill('1000');await f.locator('#tax-run').click();await expect(f.locator('[data-value=currentTax]')).toHaveText('1,149.70');await expect(f.locator('[data-value=net]')).toHaveText('14,347.30');
});
test('annual extra tax has the same positive label and amount on screen and in the TXT summary',async({page})=>{
 const f=await open(page);await f.locator('#tax-annual-salary').fill('10000');await f.locator('#tax-annual-source').selectOption('manual');await f.locator('#tax-annual-contributions').fill('0');await f.locator('#tax-annual-mode').selectOption('monthly');for(let n=1;n<=12;n++){await reveal(f,'tax-a-'+n+'-predicted');await f.locator('#tax-a-'+n+'-predicted').uncheck();}await reveal(f,'tax-actualWithheld');await f.locator('#tax-actualWithheld').fill('3000');await f.locator('#tax-annual-run').click();await expect(f.locator('[data-value=refund]')).toHaveText('480.00');const text=await download(page,f.locator('#tax-downloadTxt'));expect(text.split('\n\n')[0]).toContain('预计补税: 480.00');
});
for(const mode of ['same','monthly'])test(`a blank explicit city deduction is not silently replaced by a default (${mode})`,async({page})=>{
 const f=await open(page);await f.locator('#tax-annual-salary').fill('20000');await city(f);const p=mode==='same'?'tax-annual':'tax-a-1';if(mode==='monthly')await f.locator('#tax-annual-mode').selectOption('monthly');await reveal(f,p+'-reduced');await f.locator('#'+p+'-reduced').check();await f.locator('#'+p+'-deductible').fill('');await f.locator('#tax-annual-run').click();await expect(f.locator('#'+p+'-deductible')).toHaveAttribute('aria-invalid','true');await expect(f.locator('#'+p+'-deductible')).toBeFocused();await expect(f.locator('#tax-exports')).toBeHidden();
 await f.locator('#'+p+'-deductible').fill('0');await f.locator('#tax-annual-run').click();await expect(f.locator('#tax-exports')).toBeVisible();
});
test('actual city wage mode also consumes the visible taxable adjustment',async({page})=>{
 const f=await open(page,'wage');await f.locator('#tax-period').fill('2026-01');await f.locator('#tax-salary').fill('20000');await city(f,'tax');await reveal(f,'tax-taxableAdjustment');await f.locator('#tax-taxableAdjustment').fill('1000');await f.locator('#tax-check').click();await f.locator('#tax-run').click();await expect(f.locator('[data-value=currentTax]')).toHaveText('344.91');await expect(f.locator('[data-value=net]')).toHaveText('15,152.09');
});
test('city deduction validation points at the editable monthly field and preserves salary',async({page})=>{
 const f=await open(page);await f.locator('#tax-annual-salary').fill('20000');await city(f);await f.locator('#tax-annual-mode').selectOption('monthly');await reveal(f,'tax-a-2-reduced');await f.locator('#tax-a-2-reduced').check();await f.locator('#tax-a-2-deductible').fill('5000');await f.locator('#tax-annual-run').click();await expect(f.locator('#tax-a-2-deductible')).toHaveAttribute('aria-invalid','true');await expect(f.locator('#tax-a-2-deductible')).toBeFocused();await f.locator('#tax-a-2-deductible').fill('1000');await f.locator('#tax-annual-run').click();await expect(f.locator('[data-value=annualTax]')).toHaveText('10,426.70');await expect(f.locator('#tax-a-2-salary')).toHaveValue('20000.00');
});
test('annual city mode hides the payslip payment hint and manual mode restores it',async({page})=>{
 const f=await open(page),hint=f.locator('#tax-annual-same>[data-i18n="taxEase.paymentHint"]');await expect(hint).toBeHidden();await city(f);await expect(hint).toBeHidden();await f.locator('#tax-annual-source').selectOption('manual');await expect(hint).toBeVisible();await expect(f.locator('#tax-annual-contributions')).toBeVisible();
});
