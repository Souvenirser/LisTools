import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {writeFile} from 'node:fs/promises';
import {pages} from '../../src/tools/shared/navigation.js';
import {tryExample} from './task-helpers.js';

const tags=['wcag2a','wcag2aa','wcag21a','wcag21aa'];
async function scan(page,testInfo){
  await page.evaluate(()=>document.fonts.ready);
  const results=await new AxeBuilder({page}).withTags(tags).analyze();
  const resultFile=testInfo.outputPath('axe-results.json');await writeFile(resultFile,JSON.stringify(results,null,2));
  await testInfo.attach('axe-results',{path:resultFile,contentType:'application/json'});
  const violations=results.violations.map(({id,impact,help,helpUrl,nodes})=>({id,impact,help,helpUrl,nodes:nodes.map(({target,failureSummary,html})=>({target,failureSummary,html}))}));
  expect(violations,'Every WCAG A/AA violation is reported in the axe-results attachment').toEqual([]);
}
async function open(page,file){
  await page.addInitScript(()=>localStorage.setItem('listools-language','en'));
  await page.goto('/'+file);await expect(page.locator('h1')).toBeVisible();
}

for(const {id,file} of pages)test(`${id} initial state passes WCAG A and AA checks`,async({page},testInfo)=>{
  await open(page,file);await scan(page,testInfo);
});

const states=[
  {name:'JSON parsed result',file:'index.html',async prepare(page){await page.locator('#source').fill('{"name":"LisTools","items":[1,2]}');await page.locator('#format').click();await expect(page.locator('#copy')).toBeEnabled();}},
  {name:'JSON parse error',file:'index.html',async prepare(page){await page.locator('#source').fill('{"name":}');await page.locator('#format').click();await expect(page.locator('#error-detail')).toBeVisible();}},
  {name:'diff comparison result',file:'diff.html',async prepare(page){await page.locator('#left-source .cm-content').fill('{"value":1}');await page.locator('#right-source .cm-content').fill('{"value":2}');await page.locator('#compare').click();await expect(page.locator('body')).toHaveAttribute('data-status','ready');}},
  {name:'diff validation error',file:'diff.html',async prepare(page){await page.locator('#left-source .cm-content').fill('{"value":}');await page.locator('#right-source .cm-content').fill('{"value":2}');await page.locator('#compare').click();await expect(page.locator('body')).toHaveAttribute('data-status','error');}},
  {name:'conversion result',file:'convert.html#base64',async prepare(page){await page.locator('#convert-source .cm-content').fill('Hello LisTools');await page.locator('#convert-run').click();await expect(page.locator('#convert-copy')).toBeEnabled();}},
  {name:'timestamp validation error',file:'timestamp.html',async prepare(page){await page.locator('#timestamp-source').fill('invalid');await expect(page.locator('#timestamp-panel')).toHaveAttribute('data-status','error');}},
  {name:'Cron validation error',file:'cron.html',async prepare(page){await page.locator('#cron-expression').fill('invalid');await page.locator('#cron-run').click();await expect(page.locator('#cron-error')).toBeVisible();}},
  {name:'regex validation error',file:'regex.html',async prepare(page){await page.locator('#regex-pattern').fill('(');await page.locator('#regex-run').click();await expect(page.locator('#regex-status')).toHaveAttribute('data-task-state','error');}},
  {name:'password generated result',file:'password.html',async prepare(page){await page.locator('#password-generate').click();await expect(page.locator('#password-results input[type="password"]')).toHaveCount(1);}},
  {name:'PDF merged result',file:'pdf.html',async prepare(page){await tryExample(page,'pdf');await expect(page.locator('#pdf-result')).toBeVisible();}},
  {name:'image processed result',file:'images.html',async prepare(page){await tryExample(page,'images');await expect(page.locator('#images-results')).toBeVisible();}},
  {name:'QR generated result',file:'qr.html',async prepare(page){await page.locator('#qr-input').fill('LisTools offline QR');await page.locator('#qr-generate').click();await expect(page.locator('#qr-canvas')).toBeVisible();}},
  {name:'text processed result',file:'text.html',async prepare(page){await page.locator('#text-input').fill('one\none\ntwo');await page.locator('#text-run').click();await expect(page.locator('#text-copy')).toBeEnabled();}},
  {name:'calculator result',file:'calculator.html',async prepare(page){await page.locator('#expression').fill('12+30');await page.locator('#calculate').click();await expect(page.locator('#result')).toHaveText('42');}}
];
for(const state of states)test(`${state.name} passes WCAG A and AA checks`,async({page},testInfo)=>{
  await open(page,state.file);await state.prepare(page);await scan(page,testInfo);
});
