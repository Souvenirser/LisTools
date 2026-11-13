import {test,expect} from '@playwright/test';
import {selectLanguage} from './language-helpers.js';

const tool=page=>page.frameLocator('iframe[data-workspace-active]');
async function open(page,task='wage'){
 await page.clock.setFixedTime(new Date('2026-11-13T04:00:00Z'));await page.addInitScript(()=>localStorage.setItem('listools-language','zh-Hans'));await page.goto('/tax.html#'+task);const f=tool(page);await f.locator('#tax-salary').waitFor({state:'attached'});return f;
}
async function reveal(f,id){await f.locator('#'+id).evaluate(n=>{for(let p=n.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});}
async function wage(f){await f.locator('#tax-salary').fill('20000');await f.locator('#tax-source').selectOption('manual');await f.locator('#tax-contributions').fill('2000');await f.locator('#tax-special').fill('1000');await reveal(f,'tax-other');await f.locator('#tax-other').fill('300');await f.locator('#tax-taxableAdjustment').fill('200');await f.locator('#tax-run').click();await expect(f.locator('[data-value=net]')).toBeVisible();}
const comparisonFields={Contributions:'24000.00',Special:'12000.00',Other:'3600.00',Medical:'0',Adjustment:'2400.00'};
for(const [name,expected] of Object.entries(comparisonFields))test(`bonus import confirms before replacing a ${name} draft without a salary`,async({page})=>{
 const f=await open(page);await wage(f);await f.locator('[data-task=bonus]').click();await f.locator('#tax-compare').check();const field=f.locator('#tax-bonusAnnual'+name);await field.fill('1234');
 let prompts=0;const cancel=async d=>{prompts++;expect(d.message()).not.toContain('逐月');await d.dismiss();};page.on('dialog',cancel);await f.locator('#tax-use-wage').click();expect(prompts).toBe(1);await expect(field).toHaveValue('1234');await expect(f.locator('#tax-bonusAnnualSalary')).toHaveValue('');
 page.removeListener('dialog',cancel);page.once('dialog',d=>d.accept());await f.locator('#tax-use-wage').click();await expect(field).toHaveValue(expected);await expect(f.locator('#tax-bonusAnnualSalary')).toHaveValue('240000.00');
});
test('an untouched bonus comparison can import without an unnecessary confirmation',async({page})=>{
 const f=await open(page);await wage(f);await f.locator('[data-task=bonus]').click();await f.locator('#tax-compare').check();let prompts=0;page.on('dialog',async d=>{prompts++;await d.dismiss();});await f.locator('#tax-use-wage').click();expect(prompts).toBe(0);await expect(f.locator('#tax-bonusAnnualSalary')).toHaveValue('240000.00');
});
test('future year marks an unfilled monthly draft as predicted',async({page})=>{
 const f=await open(page,'annual');await f.locator('#tax-year').fill('2027');await f.locator('#tax-annual-mode').selectOption('monthly');for(let n=1;n<=12;n++)await expect(f.locator(`#tax-a-${n}-predicted`)).toBeChecked();
});
test('changing a prepared year refreshes prediction flags but preserves amounts and same-year choices',async({page},testInfo)=>{
 const f=await open(page,'annual');await f.locator('#tax-annual-salary').fill('10000');await f.locator('#tax-annual-source').selectOption('manual');await f.locator('#tax-annual-contributions').fill('0');await f.locator('#tax-annual-mode').selectOption('monthly');await reveal(f,'tax-a-1-salary');await f.locator('#tax-a-1-salary').fill('21000');
 await f.locator('#tax-year').fill('2027');for(let n=1;n<=12;n++)await expect(f.locator(`#tax-a-${n}-predicted`)).toBeChecked();await expect(f.locator('#tax-a-1-salary')).toHaveValue('21000');await f.locator('#tax-annual-run').click();await expect(f.locator('#tax-forecast-note')).toBeVisible();await expect(f.locator('[data-value=refund]')).toHaveCount(0);
 await f.locator('#tax-values').screenshot({path:testInfo.outputPath('future-year-result.png')});const [download]=await Promise.all([page.waitForEvent('download'),f.locator('#tax-downloadTxt').click()]);const stream=await download.createReadStream(),chunks=[];for await(const c of stream)chunks.push(c);const text=Buffer.concat(chunks).toString();expect(text).toContain('"year": "2027"');expect(text).toContain('"predicted": true');expect(text).not.toContain('"predicted": false');
 await f.locator('#tax-year').fill('2026');for(let n=1;n<=11;n++)await expect(f.locator(`#tax-a-${n}-predicted`)).not.toBeChecked();await expect(f.locator('#tax-a-12-predicted')).toBeChecked();await expect(f.locator('#tax-a-1-salary')).toHaveValue('21000');
 await f.locator('#tax-a-1-predicted').check();await f.locator('#tax-year').fill('2026');await expect(f.locator('#tax-a-1-predicted')).toBeChecked();
});
test('the shared wage year also refreshes monthly annual predictions',async({page})=>{
 const f=await open(page);await f.locator('#tax-period').fill('2027-11');await f.locator('[data-task=annual]').click();await f.locator('#tax-annual-mode').selectOption('monthly');for(let n=1;n<=12;n++)await expect(f.locator(`#tax-a-${n}-predicted`)).toBeChecked();
});
for(const [code,message] of Object.entries({'zh-Hans':'这将覆盖已填写的计算参数，是否继续？',en:'This will replace the existing calculation inputs. Continue?',de:'Die eingegebenen Berechnungswerte werden ersetzt. Fortfahren?',ar:'سيؤدي هذا إلى استبدال بيانات الحساب المدخلة. هل تريد المتابعة؟'}))test(`translated confirmation preserves the comparison draft in ${code}`,async({page})=>{
 const f=await open(page);await wage(f);await f.locator('[data-task=bonus]').click();await f.locator('#tax-compare').check();await f.locator('#tax-bonusAnnualSpecial').fill('1234');await selectLanguage(page,code);
 let prompts=0;page.on('dialog',async d=>{prompts++;expect(d.message()).toBe(message);await d.dismiss();});await f.locator('#tax-use-wage').click();expect(prompts).toBe(1);await expect(f.locator('#tax-bonusAnnualSpecial')).toHaveValue('1234');await expect(f.locator('#tax-bonusAnnualSalary')).toHaveValue('');
});
