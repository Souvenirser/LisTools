import {test,expect} from '@playwright/test';
import Papa from 'papaparse';
import {selectLanguage} from './language-helpers.js';

async function open(page,name){
 await page.addInitScript(()=>{localStorage.setItem('listools-language','zh-Hans');localStorage.setItem('listools-preferences-v1',JSON.stringify({theme:'dark'}));});
 await page.goto('/'+name+'.html');
 const f=page.frameLocator('iframe[data-workspace-active]');await f.locator('#'+name+'-salary').waitFor();return f;
}
const card=(f,side)=>f.locator('[data-breakdown='+side+']');
const line=(region,item)=>region.locator('[data-breakdown-item='+item+']');
async function downloadRows(page,f,id){
 const [download]=await Promise.all([page.waitForEvent('download'),f.locator('#'+id+'-downloadCsv').click()]);
 const bytes=[];for await(const chunk of await download.createReadStream())bytes.push(chunk);
 return Papa.parse(Buffer.concat(bytes).toString(),{header:true,skipEmptyLines:true}).data;
}

test('salary charts expose exact amounts, each contribution and its exported percentage',async({page})=>{
 const f=await open(page,'tax');await f.locator('#tax-period').fill('2026-11');await f.locator('#tax-salary').fill('20000');await f.locator('#tax-run').click();
 const personal=card(f,'personal'),employer=card(f,'employer');
 await expect(personal).toHaveAttribute('aria-label','个人工资构成');await expect(employer).toHaveAttribute('aria-label','单位用工成本构成');
 await expect(personal.locator('.breakdown-total')).toHaveText('20,000.00');await expect(employer.locator('.breakdown-total')).toHaveText('27,700.00');
 await expect(line(personal,'net').locator('td')).toHaveText(['14,447.30','72.24%']);
 await expect(line(personal,'housing').locator('td')).toHaveText(['2,400.00','12%']);
 await expect(line(employer,'pension').locator('td')).toHaveText(['3,200.00','11.55%']);
 await expect(personal.locator('svg circle')).toHaveCount(6);await expect(employer.locator('svg circle')).toHaveCount(6);
 await personal.focus();await page.keyboard.press('Tab');await expect(employer).toBeFocused();
 const rows=await downloadRows(page,f,'tax');
 expect(rows.find(row=>row.group==='个人工资构成'&&row.item==='住房公积金')).toMatchObject({amount:'2400.00',percentage:'12%'});
 expect(rows.find(row=>row.group==='单位用工成本构成'&&row.item==='养老保险')).toMatchObject({amount:'3200.00',percentage:'11.55%'});
});

test('a partial employer lists known amounts but has no chart or percentages; unlinked tax stays before tax',async({page})=>{
 const f=await open(page,'insurance');await f.locator('#insurance-month').fill('2026-11');
 const city=f.locator('.insurance-picker .choices');await city.click();await city.locator('input[type=search]').fill('shanghai');await city.locator('[data-choice-selectable][data-value=shanghai]').click();
 await f.locator('#insurance-salary').fill('20000');await f.locator('#insurance-run').click();
 const personal=card(f,'personal'),employer=card(f,'employer');
 await expect(line(personal,'beforeTax')).toContainText('16,500.00');await expect(line(personal,'net')).toHaveCount(0);await expect(line(personal,'tax')).toHaveCount(0);
 await expect(employer).toHaveAttribute('data-status','partial');await expect(employer.locator('svg')).toHaveCount(0);
 await expect(line(employer,'pension').locator('td')).toHaveText(['3,200.00','—']);await expect(line(employer,'unemployment').locator('td')).toHaveText(['未确认','—']);
 const rows=await downloadRows(page,f,'insurance');
 expect(rows.find(row=>row.group==='单位用工成本构成'&&row.item==='养老保险')).toMatchObject({amount:'3200.00',percentage:''});
});

test('at 320px the RTL manual chart fits without horizontal scrolling or fabricated components',async({page})=>{
 await page.setViewportSize({width:320,height:844});const f=await open(page,'tax');
 await f.locator('#tax-period').fill('2026-11');await f.locator('#tax-source').selectOption('manual');await f.locator('#tax-salary').fill('20000');await f.locator('#tax-contributions').fill('2000');await f.locator('#tax-run').click();
 await selectLanguage(page,'ar');await expect(f.locator('html')).toHaveAttribute('dir','rtl');
 const personal=card(f,'personal'),employer=card(f,'employer');
 await expect(personal).toHaveAttribute('aria-label','تفصيل الراتب');
 await expect(line(personal,'employeeTotal')).toBeVisible();await expect(line(personal,'pension')).toHaveCount(0);await expect(employer.locator('svg')).toHaveCount(0);
 for(const region of [personal,employer])expect(await region.evaluate(n=>n.scrollWidth-n.clientWidth)).toBeLessThanOrEqual(1);
});

test('in the bonus payment month the chart and CSV name both parts of gross income',async({page})=>{
 const f=await open(page,'tax');await f.locator('#tax-period').fill('2026-11');await f.locator('#tax-salary').fill('20000');
 await f.locator('#tax-bonus-section>summary').click();await f.locator('#tax-bonus').fill('30000');await f.locator('#tax-bonusMonth').fill('11');
 await f.locator('#tax-run').click();const personal=card(f,'personal'),employer=card(f,'employer');
 const grossLabel='税前工资（元） + 年终奖';
 await expect(personal.locator('.breakdown-overview p')).toHaveText(grossLabel);await expect(personal.locator('.breakdown-total')).toHaveText('50,000.00');
 await expect(line(personal,'net').locator('td').first()).toHaveText('43,547.30');await expect(line(personal,'tax').locator('td').first()).toHaveText('1,949.70');
 await expect(line(employer,'gross').locator('th')).toHaveText(grossLabel);await expect(employer.locator('.breakdown-total')).toHaveText('57,700.00');
 const rows=await downloadRows(page,f,'tax');expect(rows.find(row=>row.group==='个人工资构成'&&row.item===grossLabel)).toMatchObject({amount:'50000.00',percentage:'100%'});
});
