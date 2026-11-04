import {test,expect} from '@playwright/test';
import {selectLanguage} from './language-helpers.js';
import Papa from 'papaparse';

async function city(page,prefix,name){const picker=page.locator(`#${prefix}-city`).locator('xpath=ancestor::div[contains(@class,"choices")][last()]');await picker.click();await picker.locator('input[type=search]').fill(name);await picker.locator('[data-choice-selectable][data-value="beijing"]').click();}
test('city pickers have no duplicate placeholder choices on first open or language change',async({page})=>{
 for(const [url,prefix] of [['insurance.html','insurance'],['tax.html','tax']]){await page.goto('/'+url);if(prefix==='tax'){await page.locator('#tax-advanced').evaluate(n=>n.open=true);await page.locator('#tax-source').selectOption('city');}const picker=page.locator(`#${prefix}-city`).locator('xpath=ancestor::div[contains(@class,"choices")][last()]');await picker.click();expect(await picker.locator('.choices__list--dropdown [data-choice][data-value=""]').count()).toBeLessThanOrEqual(1);await picker.click();await selectLanguage(page,'de');await picker.click();expect(await picker.locator('.choices__list--dropdown [data-choice][data-value=""]').count()).toBeLessThanOrEqual(1);}
});
test('insurance computes a traceable result, preserves same-request nodes and invalidates real edits',async({page})=>{
 await page.goto('/insurance.html');await city(page,'insurance','Beijing');await page.locator('#insurance-month').fill('2026-11');await page.locator('#insurance-salary').fill('10000');await page.locator('#insurance-run').click();
 await expect(page.locator('[data-value="employeeTotal"]')).toHaveText('1753.00');await expect(page.locator('[data-value="cashBeforeTax"]')).toHaveText('8247.00');
 await expect(page.locator('#insurance-values .payroll-table-scroll')).toHaveAttribute('role','region');
 await page.locator('[data-value="employeeTotal"]').evaluate(n=>n.dataset.identity='retained');await page.locator('#insurance-run').click();await expect(page.locator('[data-value="employeeTotal"]')).toHaveAttribute('data-identity','retained');
 await page.locator('#insurance-salary').fill('12000');await expect(page.locator('#insurance-copyAll')).toBeHidden();
});
test('insurance custom mode requires explicit confirmation and tax deduction is independent',async({page})=>{
 await page.goto('/insurance.html');await page.locator('#insurance-custom-mode').check();await page.locator('#insurance-salary').fill('10000');await page.locator('#insurance-run').click();await expect(page.locator('#tool-status')).toBeVisible();
 await page.locator('#insurance-confirm').check();await page.locator('#insurance-run').click();await expect(page.locator('#insurance-result')).toContainText('10000.00');
});
test('salary tasks and bonus compare do not clear on repeated current-task selection',async({page})=>{
 await page.goto('/tax.html');await page.locator('#tax-salary').fill('10000');await page.locator('#tax-month').fill('8');await page.locator('#tax-run').click();await expect(page.locator('[data-value="currentTax"]')).toHaveText('430.00');
 await page.locator('#tax-task-wage').click();await expect(page.locator('[data-value="currentTax"]')).toHaveText('430.00');
 await page.locator('#tax-task-bonus').click();await page.locator('#tax-bonus').fill('36001');await page.locator('#tax-bonus-run').click();await expect(page.locator('[data-value="separateTax"]')).toHaveText('3390.10');
 await page.locator('#tax-compare').check();await page.locator('#tax-bonusAnnualSalary').fill('120000');await page.locator('#tax-bonus-run').click();await expect(page.locator('[data-value="combinedTotal"]')).toHaveText('7080.10');
 await page.locator('#tax-task-wage').click();await expect(page.locator('[data-value="currentTax"]')).toHaveText('430.00');
});
test('annual actual withholding is separate from a prediction and medical deduction is annual only',async({page})=>{
 await page.goto('/tax.html#annual');await page.locator('#tax-annual-salary').fill('10000');await page.locator('#tax-annual-fill').click();await page.locator('#tax-medicalDeduction').fill('10000');await page.locator('#tax-annual-run').click();
 await expect(page.locator('[data-value="annualTax"]')).toHaveText('2480.00');await expect(page.locator('[data-value="predictedWithheld"]')).toHaveText('3480.00');await expect(page.locator('[data-value="refund"]')).toHaveCount(0);
 await page.locator('#tax-actualWithheld').fill('3500');await page.locator('#tax-annual-run').click();await expect(page.locator('[data-value="refund"]')).toHaveText('1020.00');
});
test('a missing annual city month accepts an explicit actual-contribution override',async({page})=>{
 await page.goto('/tax.html#annual');await page.locator('#tax-year').fill('2027');await page.locator('#tax-annual-source').selectOption('city');await city(page,'tax-annual','Beijing');await page.locator('#tax-months').evaluate(n=>n.open=true);
 for(let n=2;n<=12;n++){await page.locator(`#tax-month-${n}`).evaluate(node=>node.open=true);await page.locator(`#tax-a-${n}-active`).uncheck();}
 await page.locator('#tax-month-1').evaluate(n=>n.open=true);await page.locator('#tax-a-1-salary').fill('10000');await page.locator('#tax-a-1-manual').check();await page.locator('#tax-a-1-contributions').fill('1000');await page.locator('#tax-a-1-deductible').fill('800');await page.locator('#tax-annual-run').click();await expect(page.locator('[data-value="contributions"]')).toHaveText('1000.00');
});
test('field errors expand settings and language/theme preserve inputs',async({page})=>{
 await page.goto('/tax.html');await page.locator('#tax-salary').fill('abc');await page.locator('#tax-run').click();await expect(page.locator('#tax-salary')).toHaveAttribute('aria-invalid','true');
 await page.locator('#tax-salary').fill('10000');await page.locator('#tax-run').click();await selectLanguage(page,'ar');await expect(page.locator('html')).toHaveAttribute('dir','rtl');await expect(page.locator('#tax-salary')).toHaveValue('10000');await expect(page.locator('[data-value="currentTax"]')).toBeVisible();
});
test('insurance CSV contains complete item amounts and optional tax errors preserve contributions',async({page})=>{
 await page.goto('/insurance.html');await city(page,'insurance','Beijing');await page.locator('#insurance-month').fill('2026-11');await page.locator('#insurance-salary').fill('10000');await page.locator('#insurance-run').click();
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#insurance-downloadCsv').click()]);const stream=await download.createReadStream();const chunks=[];for await(const c of stream)chunks.push(c);const parsed=Papa.parse(Buffer.concat(chunks).toString('utf8'),{header:true});expect(parsed.data.some(row=>row.employeeAmount==='800.00'&&row.base==='10000.00')).toBe(true);
 await page.locator('#insurance-custom-mode').check();await page.locator('#insurance-confirm').check();await page.locator('#insurance-tax-settings').evaluate(n=>n.open=true);await page.locator('#insurance-tax-enabled').check();await page.locator('#insurance-run').click();await expect(page.locator('[data-value="employeeTotal"]')).toBeVisible();await expect(page.locator('[data-value="currentTax"]')).toHaveCount(0);await expect(page.locator('#insurance-copyAll')).toBeVisible();
});
test('common year changes invalidate every tax task and fill protects manual monthly edits',async({page})=>{
 await page.goto('/tax.html#bonus');await page.locator('#tax-bonus').fill('10000');await page.locator('#tax-bonus-run').click();await expect(page.locator('[data-value="separateTax"]')).toBeVisible();await page.locator('#tax-task-wage').click();await page.locator('#tax-year').fill('2028');await page.locator('#tax-task-bonus').click();await expect(page.locator('[data-value="separateTax"]')).toHaveCount(0);
 await page.locator('#tax-task-annual').click();await page.locator('#tax-months').evaluate(n=>n.open=true);await page.locator('#tax-month-1').evaluate(n=>n.open=true);await page.locator('#tax-a-1-salary').fill('12345');await page.locator('#tax-annual-salary').fill('10000');page.once('dialog',d=>d.dismiss());await page.locator('#tax-annual-fill').click();await expect(page.locator('#tax-a-1-salary')).toHaveValue('12345');
});
test('primary actions remain reachable before optional settings on a desktop short screen',async({page})=>{
 await page.setViewportSize({width:1366,height:768});for(const tool of ['insurance','tax']){await page.goto('/'+tool+'.html');const button=page.locator(tool==='tax'?'#tax-run':'#insurance-run');const box=await button.boundingBox();expect(box.y+box.height).toBeLessThanOrEqual(768);}
});
for(const width of [320,390,768,1366,1440,1920,2560])for(const tool of ['insurance','tax'])test(`${tool} fits ${width}px without whole-page horizontal overflow`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto('/'+tool+'.html');await page.locator('html[data-ui-state="ready"]').waitFor();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
