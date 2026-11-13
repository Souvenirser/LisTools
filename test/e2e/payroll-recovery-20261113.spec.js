import {test,expect} from '@playwright/test';

const tool=page=>page.frameLocator('iframe[data-workspace-active]');
async function open(page,kind='insurance'){
 await page.addInitScript(()=>localStorage.setItem('listools-language','zh-Hans'));
 await page.goto('/'+kind+'.html');const f=tool(page);await f.locator('#'+kind+'-salary').waitFor();
 await f.locator('#'+(kind==='tax'?'tax-period':'insurance-month')).fill('2026-11');return f;
}
async function reveal(f,id){await f.locator('#'+id).evaluate(n=>{for(let p=n.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});}
async function city(f,prefix,name='beijing'){
 const picker=f.locator('#'+prefix+'-city').locator('xpath=ancestor::div[contains(@class,"choices")][last()]');await picker.click();await picker.locator('input[type=search]').fill(name);await picker.locator(`[data-choice-selectable][data-value=${name}]`).click();
}
for(const [task,bad] of [['wage','13'],['annual','13'],['annual','bad']])test(`${task} city housing ${bad} focuses the housing field and recovers without losing salary`,async({page})=>{
 const f=await open(page,'tax'),prefix=task==='wage'?'tax':'tax-annual';
 if(task==='annual')await f.locator('[data-task=annual]').click();
 await f.locator('#'+prefix+'-salary').fill('20000');await reveal(f,prefix+'-source');await f.locator('#'+prefix+'-source').selectOption('city');await city(f,prefix);
 await f.locator('#'+prefix+'-housing').fill(bad);await f.locator(task==='wage'?'#tax-run':'#tax-annual-run').click();
 await expect(f.locator('#'+prefix+'-housing')).toHaveAttribute('aria-invalid','true');await expect(f.locator('#'+prefix+'-housing')).toBeFocused();await expect(f.locator('#tax-exports')).toBeHidden();
 await f.locator('#'+prefix+'-housing').fill('7');await f.locator(task==='wage'?'#tax-run':'#tax-annual-run').click();
 await expect(f.locator('#'+prefix+'-salary')).toHaveValue('20000');await expect(f.locator('#tax-exports')).toBeVisible();await expect(f.locator(`[data-value=${task==='wage'?'net':'gross'}]`)).toHaveText(task==='wage'?'15,347.30':'240,000.00');
});
for(const side of ['employee','employer'])test(`manual ${side} fixed fee error identifies the fee rather than the valid rate`,async({page})=>{
 const f=await open(page);await reveal(f,'insurance-custom-mode');await f.locator('#insurance-custom-mode').check();await f.locator('#insurance-confirm').check();await f.locator('#insurance-salary').fill('10000');
 await f.locator('#insurance-housing-choice').selectOption('none');for(const id of ['pension','unemployment','maternity','injury'])await f.locator('#insurance-active-'+id).uncheck();
 await f.locator('#insurance-employee-medical').fill('2');await f.locator('#insurance-employer-medical').fill('7');
 const field=f.locator(side==='employee'?'#insurance-fixed-medical':'#insurance-fixed-employer-medical');await field.fill('bad');await f.locator('#insurance-run').click();
 await expect(field).toHaveAttribute('aria-invalid','true');await expect(field).toBeFocused();await expect(f.locator('#insurance-exports')).toBeHidden();
 await field.fill('5');await f.locator('#insurance-run').click();await expect(f.locator(`[data-value=${side==='employee'?'employeeTotal':'employerTotal'}]`)).toHaveText(side==='employee'?'205.00':'705.00');await expect(f.locator('#insurance-exports')).toBeVisible();
});
test('Shanghai employer supplemental rate outside its range identifies the employer input',async({page})=>{
 const f=await open(page);await city(f,'insurance','shanghai');await f.locator('#insurance-salary').fill('10000');await reveal(f,'insurance-supplemental-active');await f.locator('#insurance-supplemental-active').check();await f.locator('#insurance-supplemental-employee').fill('2');await f.locator('#insurance-supplemental-employer').fill('6');await f.locator('#insurance-run').click();
 await expect(f.locator('#insurance-supplemental-employer')).toHaveAttribute('aria-invalid','true');await expect(f.locator('#insurance-supplemental-employer')).toBeFocused();await expect(f.locator('#insurance-supplemental-employee')).not.toHaveAttribute('aria-invalid','true');
 await f.locator('#insurance-supplemental-employer').fill('2');await f.locator('#insurance-run').click();await expect(f.locator('[data-value=employeeHousing]')).toHaveText('900.00');await expect(f.locator('#insurance-exports')).toBeVisible();
});
test('annual city mode identifies the invalid monthly salary instead of the contribution amount',async({page})=>{
 const f=await open(page,'tax');await f.locator('[data-task=annual]').click();await f.locator('#tax-annual-salary').fill('20000');await reveal(f,'tax-annual-source');await f.locator('#tax-annual-source').selectOption('city');await city(f,'tax-annual');await f.locator('#tax-annual-mode').selectOption('monthly');await reveal(f,'tax-a-2-salary');await f.locator('#tax-a-2-salary').fill('bad');await f.locator('#tax-annual-run').click();
 await expect(f.locator('#tax-a-2-salary')).toHaveAttribute('aria-invalid','true');await expect(f.locator('#tax-a-2-salary')).toBeFocused();await expect(f.locator('#tax-a-2-contributions')).not.toHaveAttribute('aria-invalid','true');
 await f.locator('#tax-a-2-salary').fill('20000');await f.locator('#tax-annual-run').click();await expect(f.locator('[data-value=gross]')).toHaveText('240,000.00');await expect(f.locator('#tax-exports')).toBeVisible();
});
for(const width of [320,390])for(const theme of ['light','dark'])test(`phone errors stay visible and downloads retain full inputs at ${width}px ${theme}`,async({page},testInfo)=>{
 await page.setViewportSize({width,height:844});await page.addInitScript(theme=>localStorage.setItem('listools-preferences-v1',JSON.stringify({theme})),theme);
 let f=await open(page,'tax');await f.locator('[data-task=annual]').click();await f.locator('#tax-annual-salary').fill('20000');await reveal(f,'tax-annual-source');await f.locator('#tax-annual-source').selectOption('city');await city(f,'tax-annual');await f.locator('#tax-annual-housing').fill('13');await f.locator('#tax-annual-run').click();
 for(const id of ['tax-annual-housing','tax-annual-housing-error']){const box=await f.locator('#'+id).boundingBox();expect(box.y).toBeGreaterThanOrEqual(64);expect(box.y+box.height).toBeLessThanOrEqual(844);}
 await f.locator('#tax-annual-housing').fill('7');await f.locator('#tax-annual-run').click();
 const [taxDownload]=await Promise.all([page.waitForEvent('download'),f.locator('#tax-downloadTxt').click()]);let stream=await taxDownload.createReadStream(),chunks=[];for await(const c of stream)chunks.push(c);const taxText=Buffer.concat(chunks).toString();expect(taxText).toContain('240000.00');expect(taxText).toContain('"employee": "0.07"');
 f=await open(page);await reveal(f,'insurance-custom-mode');await f.locator('#insurance-custom-mode').check();await f.locator('#insurance-confirm').check();await f.locator('#insurance-salary').fill('10000');await f.locator('#insurance-housing-choice').selectOption('none');for(const id of ['pension','unemployment','maternity','injury'])await f.locator('#insurance-active-'+id).uncheck();await f.locator('#insurance-employee-medical').fill('2');await f.locator('#insurance-employer-medical').fill('7');await f.locator('#insurance-fixed-medical').fill('bad');await f.locator('#insurance-run').click();
 for(const id of ['insurance-fixed-medical','insurance-fixed-medical-error']){const box=await f.locator('#'+id).boundingBox();expect(box.y).toBeGreaterThanOrEqual(64);expect(box.y+box.height).toBeLessThanOrEqual(844);}
 await page.screenshot({path:testInfo.outputPath('fixed-fee-error.png')});
 await f.locator('#insurance-fixed-medical').fill('5');await f.locator('#insurance-run').click();const [insuranceDownload]=await Promise.all([page.waitForEvent('download'),f.locator('#insurance-downloadTxt').click()]);stream=await insuranceDownload.createReadStream();chunks=[];for await(const c of stream)chunks.push(c);const insuranceText=Buffer.concat(chunks).toString();expect(insuranceText).toContain('205.00');expect(insuranceText).toContain('"employeeFixed": "5.00"');expect(insuranceText).toContain('"custom": true');
 for(const root of [page.locator('html'),f.locator('html')])expect(await root.evaluate(n=>n.scrollWidth-n.clientWidth)).toBeLessThanOrEqual(1);
});
