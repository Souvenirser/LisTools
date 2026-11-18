import {test,expect} from '@playwright/test';
import {selectLanguage} from './language-helpers.js';
import Papa from 'papaparse';

const tool=page=>page.frameLocator('iframe[data-workspace-active]');
async function open(page,url){
 await page.clock.setFixedTime(new Date('2027-01-01T00:00:00Z'));
 await page.goto('/'+url);const f=tool(page);await f.locator('#tool-root').waitFor();return f;
}
async function wage(f,period='2026-08'){
 await f.locator('#tax-period').fill(period);await f.locator('#tax-source').selectOption('manual');
 await f.locator('#tax-salary').fill('10000');await f.locator('#tax-contributions').fill('0');
}
async function customInsurance(f,pension='0'){
 await f.locator('#insurance-custom-options>summary').click();await f.locator('#insurance-custom-mode').check();
 await f.locator('#insurance-housing-choice').selectOption('none');
 for(const item of ['pension','medical','unemployment','maternity','injury'])await f.locator('#insurance-employee-'+item).fill(item==='pension'?pension:'0');
}
async function city(page,prefix,name){const picker=page.locator(`#${prefix}-city`).locator('xpath=ancestor::div[contains(@class,"choices")][last()]');await picker.click();await picker.locator('input[type=search]').fill(name);await picker.locator('[data-choice-selectable][data-value="beijing"]').click();}
test('city pickers have no duplicate placeholder choices on first open or language change',async({page})=>{
 for(const prefix of ['insurance','tax']){
  const f=await open(page,prefix+'.html');const picker=f.locator('#'+prefix+'-city-control');
  await picker.click();expect(await picker.locator('.choices__list--dropdown [data-choice][data-value=""]').count()).toBeLessThanOrEqual(1);
  await picker.press('Escape');await selectLanguage(page,'de');await picker.click();
  expect(await picker.locator('.choices__list--dropdown [data-choice][data-value=""]').count()).toBeLessThanOrEqual(1);
  await picker.press('Escape');await selectLanguage(page,'en');
 }
});
test('insurance computes a traceable result, preserves same-request nodes and invalidates real edits',async({page})=>{
 const f=await open(page,'insurance.html');await city(f,'insurance','Beijing');await f.locator('#insurance-month').fill('2026-11');await f.locator('#insurance-salary').fill('10000');await f.locator('#insurance-run').click();
 await expect(f.locator('[data-value="employeeTotal"]')).toHaveText('2,253.00');await expect(f.locator('[data-value="cashBeforeTax"]')).toHaveText('7,747.00');
 await expect(f.locator('#insurance-values .payroll-table-scroll')).toHaveAttribute('role','region');
 await f.locator('[data-value="employeeTotal"]').evaluate(n=>n.dataset.identity='retained');await f.locator('#insurance-run').click();await expect(f.locator('[data-value="employeeTotal"]')).toHaveAttribute('data-identity','retained');
 await f.locator('#insurance-salary').fill('12000');await expect(f.locator('#insurance-copyAll')).toBeHidden();
});
test('insurance custom mode requires explicit confirmation and tax deduction is independent',async({page})=>{
 const f=await open(page,'insurance.html');await customInsurance(f);await f.locator('#insurance-salary').fill('10000');await f.locator('#insurance-run').click();await expect(f.locator('#insurance-confirm')).toHaveAttribute('aria-invalid','true');
 await f.locator('#insurance-confirm').check();await f.locator('#insurance-run').click();await expect(f.locator('[data-value="cashBeforeTax"]')).toHaveText('10,000.00');
});
test('unified salary and bonus compare preserve the result on repeated calculation',async({page})=>{
 const f=await open(page,'tax.html');await wage(f);await f.locator('#tax-run').click();
 const current=f.locator('[data-value="currentTax"]');await expect(current).toHaveText('430.00');
 await f.locator('#tax-bonus-section>summary').click();await f.locator('#tax-bonus').fill('36001');await f.locator('#tax-run').click();
 await expect(f.locator('[data-value="separateTax"]')).toHaveText('3,390.10');
 await f.locator('#tax-compare').check();await f.locator('#tax-bonusAnnualSalary').fill('120000');await f.locator('#tax-run').click();
 await expect(f.locator('[data-value="combinedTotal"]')).toHaveText('7,080.10');
 await current.evaluate(n=>n.dataset.identity='retained');await f.locator('#tax-run').click();
 await expect(current).toHaveText('430.00');await expect(current).toHaveAttribute('data-identity','retained');
});
test('annual actual withholding is separate from a prediction and medical deduction is annual only',async({page})=>{
 const f=await open(page,'tax.html#annual');await wage(f,'2026-12');
 await f.locator('#tax-annual-mode').selectOption('monthly');
 for(let n=1;n<=12;n++){
  await f.locator('#tax-month-'+n+'>summary').click();await f.locator(`#tax-a-${n}-history`).selectOption('actual');
 }
 await f.locator('#tax-annual-options>summary').click();await f.locator('#tax-medicalDeduction').fill('10000');
 await f.locator('#tax-run').click();await expect(f.locator('[data-value="annualTax"]')).toHaveText('2,480.00');
 await expect(f.locator('#tax-months-table tfoot')).toContainText('3,480.00');await expect(f.locator('[data-value="currentTax"]')).toHaveText('500.00');await expect(f.locator('[data-value="refund"]')).toHaveCount(0);
 await f.locator('#tax-actualWithheld').fill('3500');await f.locator('#tax-run').click();await expect(f.locator('[data-value="refund"]')).toHaveText('1,020.00');
});
test('a missing city policy month accepts an explicit actual-contribution override for the annual projection',async({page})=>{
 const f=await open(page,'tax.html#annual');await f.locator('#tax-period').fill('2027-01');await city(f,'tax','Beijing');
 await f.locator('#tax-annual-mode').selectOption('monthly');
 for(let n=2;n<=12;n++){await f.locator(`#tax-month-${n}>summary`).click();await f.locator(`#tax-a-${n}-active`).uncheck();}
 await f.locator('#tax-month-1>summary').click();await f.locator('#tax-a-1-salary').fill('10000');await f.locator('#tax-a-1-manual').check();
 await f.locator('#tax-a-1-contributions').fill('1000');await f.locator('#tax-a-1-reduced').check();await f.locator('#tax-a-1-deductible').fill('800');
 await f.locator('#tax-run').click();await expect(f.locator('#tax-months-table tbody tr')).toHaveCount(1);
 await expect(f.locator('#tax-months-table tbody tr').first()).toContainText('1,000.00');
});
test('field errors expand settings and language preserves inputs',async({page})=>{
 const f=await open(page,'tax.html');await wage(f);await f.locator('#tax-salary').fill('abc');await f.locator('#tax-run').click();
 await expect(f.locator('#tax-salary')).toHaveAttribute('aria-invalid','true');
 await f.locator('#tax-salary').fill('10000');await f.locator('#tax-run').click();await selectLanguage(page,'ar');
 await expect(f.locator('html')).toHaveAttribute('dir','rtl');await expect(f.locator('#tax-salary')).toHaveValue('10000');await expect(f.locator('[data-value="currentTax"]')).toBeVisible();
});
test('insurance CSV contains complete item amounts and optional tax errors preserve contributions',async({page})=>{
 const f=await open(page,'insurance.html');await city(f,'insurance','Beijing');await f.locator('#insurance-month').fill('2026-11');await f.locator('#insurance-salary').fill('10000');await f.locator('#insurance-run').click();
 const [download]=await Promise.all([page.waitForEvent('download'),f.locator('#insurance-downloadCsv').click()]);const stream=await download.createReadStream();const chunks=[];for await(const c of stream)chunks.push(c);const parsed=Papa.parse(Buffer.concat(chunks).toString('utf8'),{header:true});expect(parsed.data.some(row=>row.employeeAmount==='800.00'&&row.base==='10000.00')).toBe(true);
 await customInsurance(f,'8');await f.locator('#insurance-confirm').check();await f.locator('#insurance-tax-settings>summary').click();await f.locator('#insurance-tax-enabled').check();await f.locator('#insurance-run').click();await expect(f.locator('[data-value="employeeTotal"]')).toHaveText('800.00');await expect(f.locator('#insurance-partial')).toBeVisible();await expect(f.locator('[data-value="currentTax"]')).toHaveCount(0);await expect(f.locator('#insurance-copyAll')).toBeVisible();
});
test('changing the shared period invalidates results and refill protects manual monthly edits',async({page})=>{
 const f=await open(page,'tax.html#bonus');await wage(f);await f.locator('#tax-bonus').fill('10000');await f.locator('#tax-run').click();
 await expect(f.locator('[data-value="separateTax"]')).toBeVisible();await f.locator('#tax-period').fill('2028-08');
 await expect(f.locator('[data-value="separateTax"]')).toHaveCount(0);await expect(f.locator('[data-value="currentTax"]')).toHaveCount(0);
 await f.locator('#tax-annual-section>summary').click();await f.locator('#tax-annual-mode').selectOption('monthly');
 await f.locator('#tax-month-1>summary').click();await f.locator('#tax-a-1-salary').fill('12345');
 page.once('dialog',d=>d.dismiss());await f.locator('#tax-annual-fill').click();await expect(f.locator('#tax-a-1-salary')).toHaveValue('12345');
});
test('primary actions remain reachable before optional settings on a desktop short screen',async({page})=>{
 await page.setViewportSize({width:1366,height:768});
 for(const name of ['insurance','tax']){
  const f=await open(page,name+'.html');const box=await f.locator('#'+name+'-run').boundingBox();expect(box.y+box.height).toBeLessThanOrEqual(768);
 }
});
for(const width of [320,390,768,1366,1440,1920,2560])for(const name of ['insurance','tax'])test(`${name} fits ${width}px without whole-page horizontal overflow`,async({page})=>{
 await page.setViewportSize({width,height:900});const f=await open(page,name+'.html');
 for(const root of [page.locator('html'),f.locator('html')])expect(await root.evaluate(n=>n.scrollWidth<=n.clientWidth+1)).toBe(true);
});
