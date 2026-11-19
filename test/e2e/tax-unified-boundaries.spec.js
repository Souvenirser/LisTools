import {test,expect} from '@playwright/test';

async function wages(page,period='2026-11'){
 await page.clock.setFixedTime(new Date('2026-12-15T12:00:00Z'));
 await page.addInitScript(()=>localStorage.setItem('listools-language','zh-Hans'));
 await page.goto('/tax.html');
 const f=page.frameLocator('iframe[data-workspace-active]');
 await f.locator('#tax-period').fill(period);await f.locator('#tax-source').selectOption('manual');
 await f.locator('#tax-salary').fill('20000');await f.locator('#tax-contributions').fill('2000');return f;
}
const out=(f,name)=>f.locator(`[data-value="${name}"]`);
for(const [mode,start,period,confirmation,tax,net] of [
 ['first-employment','3','2026-03','tax-firstConfirmed','90.00','17,910.00'],
 ['annual-60000','1','2026-02','tax-annualReliefConfirmed','0.00','18,000.00']
])test(`shared salary projection retains ${mode} withholding in both the month and the schedule`,async({page})=>{
 const f=await wages(page,period);await f.locator('#tax-employment>summary').click();
 await f.locator('#tax-startMonth').fill(start);await f.locator('#tax-basicDeductionMode').selectOption(mode);
 await f.locator('#'+confirmation).check();await f.locator('#tax-run').click();
 await expect(out(f,'currentTax')).toHaveText(tax);await expect(out(f,'net')).toHaveText(net);
 const current=f.locator('#tax-months-table tbody tr.is-current-month');await expect(current).toContainText(net);
});

test('editing annual projection leaves the payslip reconciliation based on actual income and withholding',async({page})=>{
 const f=await wages(page,'2026-02');await f.locator('#tax-check').click();
 for(const [field,value] of Object.entries({Income:'30000',Contributions:'2000',Special:'0',Withheld:'690'}))await f.locator('#tax-previous'+field).fill(value);
 await f.locator('#tax-annual-section>summary').click();await f.locator('#tax-annual-mode').selectOption('monthly');
 await f.locator('#tax-month-2>summary').click();await f.locator('#tax-a-2-salary').fill('30000');
 await f.locator('#tax-run').click();
 await expect(out(f,'salary')).toHaveText('20,000.00');await expect(out(f,'currentTax')).toHaveText('390.00');
 await expect(out(f,'net')).toHaveText('17,610.00');
 await expect(f.locator('#tax-months-table tbody tr.is-current-month')).toContainText('30,000.00');
});

test('opening monthly editing does not invent salary before employment started',async({page})=>{
 const f=await wages(page);await f.locator('#tax-employment>summary').click();await f.locator('#tax-startMonth').fill('6');
 await f.locator('#tax-run').click();await expect(out(f,'gross')).toHaveText('140,000.00');
 await f.locator('#tax-annual-section>summary').click();await f.locator('#tax-annual-mode').selectOption('monthly');
 await f.locator('#tax-run').click();await expect(out(f,'gross')).toHaveText('140,000.00');
 await expect(f.locator('#tax-months-table tbody tr')).toHaveCount(7);
});

test('monthly editing keeps the actual social and housing bases until a row explicitly overrides them',async({page})=>{
 const f=await wages(page);await f.locator('#tax-source').selectOption('city');const picker=f.locator('#tax-city-control');await picker.click();await picker.locator('input[type=search]').fill('Beijing');await picker.locator('[data-choice-selectable][data-value=beijing]').click();await f.locator('#tax-salary').fill('100000');
 await f.locator('#tax-city-options>summary').click();await f.locator('#tax-base-mode').selectOption('actual');
 await f.locator('#tax-base').fill('20000');await f.locator('#tax-base-housing').fill('10000');await f.locator('#tax-run').click();
 const monthlyCash=f.locator('#tax-months-table tr.is-current-month td').nth(2);await expect(monthlyCash).toHaveText('3,303.00');
 await f.locator('#tax-annual-section>summary').click();await f.locator('#tax-annual-mode').selectOption('monthly');await f.locator('#tax-run').click();
 await expect(monthlyCash).toHaveText('3,303.00');
});

test('combined bonus in the first month of first employment uses the calendar-month allowance',async({page})=>{
 const f=await wages(page,'2026-03');await f.locator('#tax-employment>summary').click();
 await f.locator('#tax-startMonth').fill('3');await f.locator('#tax-basicDeductionMode').selectOption('first-employment');await f.locator('#tax-firstConfirmed').check();
 await f.locator('#tax-bonus-section>summary').click();await f.locator('#tax-bonus').fill('36000');await f.locator('#tax-bonusMonth').fill('3');await f.locator('#tax-bonus-method').selectOption('combined');
 await f.locator('#tax-run').click();await expect(out(f,'currentTax')).toHaveText('90.00');await expect(out(f,'net')).toHaveText('17,910.00');await expect(out(f,'monthNetWithBonus')).toHaveText('52,620.00');await expect(f.locator('#tax-months-table tr.is-current-month')).toContainText('1,380.00');
});

test('an invalid entered bonus suppresses refund conclusions while preserving the valid salary',async({page})=>{
 const f=await wages(page,'2026-12');
 await f.locator('#tax-annual-section>summary').click();await f.locator('#tax-annual-options>summary').click();
 await f.locator('#tax-actualWithheld').fill('20000');await f.locator('#tax-bonus-section>summary').click();await f.locator('#tax-bonus').fill('bad');
 await f.locator('#tax-run').click();await expect(out(f,'salary')).toHaveText('20,000.00');await expect(out(f,'refund')).toHaveCount(0);
});

test('monthly changes update every calculation-process field and exported cumulative amount',async({page})=>{
 const f=await wages(page);await f.locator('#tax-annual-section>summary').click();await f.locator('#tax-annual-mode').selectOption('monthly');await f.locator('#tax-month-1>summary').click();await f.locator('#tax-a-1-salary').fill('40000');await f.locator('#tax-run').click();await f.locator('#tax-process>summary').click();
 await expect(out(f,'currentTax')).toHaveText('2,600.00');await expect(out(f,'cumulativeIncome')).toHaveText('240,000.00');await expect(out(f,'cumulativeTax')).toHaveText('15,680.00');await expect(out(f,'cumulativeTaxable')).toHaveText('163,000.00');await expect(out(f,'rate')).toHaveText('20%');
 const [d]=await Promise.all([page.waitForEvent('download'),f.locator('#tax-downloadTxt').click()]);const chunks=[];for await(const c of await d.createReadStream())chunks.push(c);const data=Buffer.concat(chunks).toString();expect(data).toContain('240000.00');expect(data).toContain('15680.00');expect(data).toContain('163000.00');
});

test('the month chooser selects another year and month with the keyboard',async({page})=>{
 await page.setViewportSize({width:1160,height:760});
 const f=await wages(page);
 const monthValue=f.locator('#tax-period');
 expect((await monthValue.boundingBox()).width).toBeGreaterThanOrEqual(120);
 const trigger=f.locator('#tax-period-picker');
 const chooser=f.locator('#tax-period-options');
 await trigger.click();
 await expect(chooser).toBeVisible();
 await f.locator('#tax-period-options [data-month]').first().press('Escape');
 await expect(chooser).toBeHidden();
 await trigger.focus();
 await trigger.press('Enter');
 await expect(chooser).toBeVisible();
 await chooser.locator('#tax-period-year-choice').fill('2027');
 await chooser.locator('[data-month="3"]').press('Enter');
 await expect(monthValue).toHaveValue('2027-03');
 await expect(trigger).toBeFocused();
 await expect(chooser).toBeHidden();
 await f.locator('#tax-run').click();
 await expect(out(f,'salary')).toHaveText('20,000.00');
 await expect(f.locator('#tax-months-table tr.is-current-month td').first()).toHaveText('3 · 预测月份');
 const [download]=await Promise.all([page.waitForEvent('download'),f.locator('#tax-downloadTxt').click()]);
 const chunks=[];for await(const chunk of await download.createReadStream())chunks.push(chunk);
 const data=Buffer.concat(chunks).toString();
 const conditions=JSON.parse(data.slice(data.lastIndexOf('\n{\n')+1,data.lastIndexOf('\n}')+2));
 expect(conditions.wage).toMatchObject({year:'2027',month:3,predicted:true});
});

test('combined bonus for a future year is available and export says it is an estimate',async({page})=>{
 const f=await wages(page,'2028-01');
 await f.locator('#tax-bonus-section>summary').click();
 await f.locator('#tax-bonus').fill('36000');
 await f.locator('#tax-bonusMonth').fill('1');
 await expect(f.locator('#tax-bonus-method')).toHaveValue('combined');
 await f.locator('#tax-run').click();
 await expect(out(f,'totalAnnualTax')).toHaveText('21,480.00');
 await expect(out(f,'separateTax')).toHaveCount(0);
 await expect(out(f,'refund')).toHaveCount(0);
 await expect(f.locator('#tax-bonus-result')).toContainText('预测');
 const [download]=await Promise.all([page.waitForEvent('download'),f.locator('#tax-downloadTxt').click()]);
 const chunks=[];for await(const chunk of await download.createReadStream())chunks.push(chunk);
 const data=Buffer.concat(chunks).toString();
 expect(data).toMatch(/"method":\s*"combined"/);
 expect(data).toMatch(/"bonusCombinedEstimate":\s*true/);
});
