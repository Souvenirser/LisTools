import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

const png=readFileSync('public/icons/icon-128.png');
const pdf=Buffer.from(JSON.parse(readFileSync('src/tools/pdf/examples.json','utf8'))[0],'base64');
async function open(page,name){
  await page.goto('/'+name+'.html');
  await page.locator('html[data-ui-state=ready]').waitFor({state:'attached'});
  const frame=page.locator('iframe[data-workspace-active]');
  return (await frame.count())?frame.contentFrame():page;
}
async function downloadBytes(page,button){
  const pending=page.waitForEvent('download');
  await button.click();
  const download=await pending;
  return readFileSync(await download.path());
}

for(const {tool,name,mime,buffer,errorList,download} of [
  {tool:'pdf',name:'example.pdf',mime:'application/pdf',buffer:pdf,errorList:'#pdf-import-errors',download:'#pdf-download'},
  {tool:'images',name:'example.png',mime:'image/png',buffer:png,errorList:'#images-queue',download:'#images-download'},
])test(tool+' labels and preserves the last output when an import is rejected',async({page})=>{
  const f=await open(page,tool);
  await f.locator('#'+tool+'-files').setInputFiles({name,mimeType:mime,buffer});
  await f.locator('#'+tool+'-run').click();
  await expect(f.locator(download)).toBeVisible();
  const original=await downloadBytes(page,f.locator(download));
  const bad='rejected-'+name;
  await f.locator('#'+tool+'-files').setInputFiles({name:bad,mimeType:mime,buffer:Buffer.from('invalid synthetic file')});
  await expect(f.locator(errorList)).toContainText(bad);
  const prior=f.locator('#'+tool+'-previous-result');
  await expect(prior).toBeVisible();
  await expect(prior).toHaveText('Download is from the previous input.');
  expect(await downloadBytes(page,f.locator(download))).toEqual(original);
  await f.locator('#'+tool+'-files').setInputFiles({name:'next-'+name,mimeType:mime,buffer});
  await expect(prior).toBeHidden();
  await expect(f.locator(download)).toBeHidden();
});

test('the first speed test screen displays the action and traffic budget before results',async({page})=>{
  const f=await open(page,'speedtest');
  await expect(f.locator('#speed-status')).toHaveText('Ready to test');
  await expect(f.locator('#speed-budget')).toBeVisible();
  await expect(f.locator('#speed-unit')).toHaveValue('MB/s');
  await expect(f.locator('#speed-start')).toBeEnabled();
  await expect(f.locator('#speed-metrics')).toBeHidden();
  await expect(f.locator('.speed-chart-card')).toBeHidden();
});
