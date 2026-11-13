import {test,expect} from '@playwright/test';
import {resolveEstimatePolicy} from '../../src/tools/payroll/policy.js';
import {calculateContributions} from '../../src/tools/payroll/contributions.js';
import {readFile} from 'node:fs/promises';
const catalog=JSON.parse(await readFile(new URL('../../src/tools/payroll/reference-cities.json',import.meta.url),'utf8'));
const tool=p=>p.frameLocator('iframe[data-workspace-active]');
async function open(page,kind='insurance'){await page.addInitScript(()=>{localStorage.setItem('listools-language','zh-Hans');localStorage.setItem('listools-theme','dark');});await page.goto('/'+kind+'.html');const f=tool(page);await f.locator('#'+kind+'-salary').waitFor();await f.locator(kind==='insurance'?'#insurance-month':'#tax-period').fill('2026-11');return f;}
async function selectCity(f,id,prefix='insurance'){const p=f.locator('#'+prefix+'-city').locator('xpath=ancestor::div[contains(@class,"choices")][last()]');await p.click();await p.locator('input[type=search]').fill(id);await p.locator(`[data-choice-selectable][data-value="${id}"]`).click();}
async function reveal(f,id){await f.locator('#'+id).evaluate(n=>{for(let p=n.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});}
async function download(page,button){const [d]=await Promise.all([page.waitForEvent('download'),button.click()]);const s=await d.createReadStream(),parts=[];for await(const c of s)parts.push(c);return Buffer.concat(parts).toString('utf8');}
const money=n=>Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
test('all twenty city forms calculate sourced personal and employer values, with no unverified blocker',async({page},info)=>{
 const f=await open(page);await expect(f.locator('#insurance-city')).toHaveValue('');await f.locator('#insurance-salary').fill('10000');
 for(const c of catalog.cities){await selectCity(f,c.id);await f.locator('#insurance-run').click();const p=resolveEstimatePolicy(c.id,'2026-11'),rate=p.items.find(i=>i.id==='housing').rateMax,r=calculateContributions({salary:'10000',rates:{housing:{employee:rate,employer:rate}}},p),e=Number(r.employeeTotal)*100,u=r.employerTotal===null?null:Number(r.employerTotal)*100;
  await expect(f.locator('[data-value=employeeTotal]')).toHaveText(money(e/100));await expect(f.locator('[data-value=employerTotal]')).toHaveText(u===null?'未确认':money(u/100));if(p.reference)await expect(f.locator('#insurance-condition')).toContainText('参考试算');await expect(f.locator('#insurance-exports')).toBeVisible();await expect(f.locator('#tool-error')).toBeHidden();
 }
 await page.screenshot({path:info.outputPath('insurance-reference-dark.png'),fullPage:true});
});
test('reference source and cent values survive full CSV export and unchanged re-run',async({page})=>{
 const f=await open(page);await selectCity(f,'guangzhou');await f.locator('#insurance-salary').fill('10000');await f.locator('#insurance-run').click();await f.locator('[data-value=employeeTotal]').evaluate(n=>n.dataset.keep='same');await f.locator('#insurance-run').click();await expect(f.locator('[data-keep=same]')).toHaveCount(1);
 const csv=await download(page,f.locator('#insurance-downloadCsv'));for(const text of ['2220.00','3585.00','https://','referenceAsOf'])expect(csv).toContain(text);
 await reveal(f,'insurance-policy');await expect(f.locator('#insurance-policy a').first()).toHaveAttribute('href',resolveEstimatePolicy('guangzhou','2026-11').sources[0].url);await expect(f.locator('#insurance-policy')).not.toContainText('已核验');
});
test('tax city mode shares the reference contributions and cumulative tax core',async({page},info)=>{
 const f=await open(page,'tax');await f.locator('#tax-salary').fill('20000');await reveal(f,'tax-source');await f.locator('#tax-source').selectOption('city');await selectCity(f,'beijing','tax');await f.locator('#tax-run').click();await expect(f.locator('[data-value=contributions]')).toHaveText('4,503.00');await expect(f.locator('[data-value=currentTax]')).toHaveText('1,049.70');await expect(f.locator('[data-value=net]')).toHaveText('14,447.30');await expect(f.locator('#tax-values')).toContainText('逐月匹配');
 const txt=await download(page,f.locator('#tax-downloadTxt'));expect(txt).toContain('beijing');expect(txt).toContain('14447.30');await page.screenshot({path:info.outputPath('tax-reference-dark.png'),fullPage:true});
});
test('annual city estimate uses the labelled reference snapshot and preserves manual tax mode',async({page})=>{
 const f=await open(page,'tax');await f.locator('[data-task=annual]').click();await f.locator('#tax-annual-salary').fill('20000');await reveal(f,'tax-annual-source');await f.locator('#tax-annual-source').selectOption('city');await selectCity(f,'guangzhou','tax-annual');await f.locator('#tax-annual-run').click();await expect(f.locator('[data-value=gross]')).toHaveText('240,000.00');await expect(f.locator('[data-value=contributions]')).toHaveText('53,280.00');await expect(f.locator('#tax-values')).toContainText('参考参数');
 await f.locator('[data-task=wage]').click();await expect(f.locator('#tax-source')).toHaveValue('city');await f.locator('#tax-salary').fill('20000');await f.locator('#tax-source').selectOption('manual');await f.locator('#tax-contributions').fill('2000');await f.locator('#tax-run').click();await expect(f.locator('[data-value=net]')).toHaveText('16,700.00');
});
