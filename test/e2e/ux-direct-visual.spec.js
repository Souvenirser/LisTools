import {test,expect} from '@playwright/test';
import {chooseTask} from './task-helpers.js';

for(const width of [390,1440])test(`date results distinguish their main conclusion from readable details at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto('/dates.html');
 for(const task of ['difference','shift','milestone','workdays']){
  await chooseTask(page,'dates',task);
  if(task==='difference'){await page.locator('#date-start').fill('2026-10-01');await page.locator('#date-end').fill('2026-10-08');}
  if(task==='workdays')await page.locator('#work-end').fill('2026-10-08');
  if(task==='milestone')await page.locator('#date-origin').fill('2000-02-29');
  await page.locator(`#${task}-run`).click();
  const output=page.locator(`#${task}-output`);await expect(output.locator('.date-conclusion')).not.toBeEmpty();
  const size=await output.evaluate(node=>({details:parseFloat(getComputedStyle(node).fontSize),conclusion:parseFloat(getComputedStyle(node.querySelector('.date-conclusion')).fontSize)}));
  expect(size.details).toBe(18);expect(size.conclusion).toBe(36);
 }
 expect(await page.locator('#work-start').evaluate(node=>parseFloat(getComputedStyle(node).fontSize))).toBe(18);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});

const visualRoutes=['index','diff','convert','md5','timestamp','cron','regex','password','speedtest','calculator','dates','units','money','draw','timer','qr','images','pdf','text'];
async function nativeSelects(page){
 await page.locator('main details').evaluateAll(nodes=>nodes.forEach(node=>{if(node.checkVisibility())node.open=true;}));
 return page.locator('select').evaluateAll(nodes=>nodes.filter(node=>node.checkVisibility()).map(node=>({id:node.id||node.name,height:node.getBoundingClientRect().height,fontSize:parseFloat(getComputedStyle(node).fontSize)})));
}
for(const route of visualRoutes)test(`${route} native selectors retain a44px interaction target in ordinary and advanced tasks`,async({page},testInfo)=>{
 const samples=[];
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:900});await page.goto(route==='md5'?'/convert.html#md5':`/${route}.html`);await page.locator('h1').waitFor();
  const inspect=async(task)=>{const controls=await nativeSelects(page);samples.push({width,task,controls});expect(controls.filter(control=>control.height<43.99),`${route}/${task} at${width}`).toEqual([]);};
  await inspect('initial');
  const tasks=await page.locator('.task-choices [data-task]').evaluateAll(nodes=>nodes.map(node=>node.dataset.task));
  for(const task of tasks){await chooseTask(page,route,task);await inspect(task);}
 }
 await testInfo.attach('native-select-sizes',{body:JSON.stringify(samples),contentType:'application/json'});
});

for(const width of [320,390,1366])for(const language of ['en','de','ar'])test(`calculator mode names stay on one line at${width}px in${language}`,async({page})=>{
 await page.setViewportSize({width,height:width===1366?768:900});await page.goto('/calculator.html');
 const {selectLanguage}=await import('./language-helpers.js');await selectLanguage(page,language);
 for(const button of await page.locator('.calculator-modes button').all()){
  const size=await button.evaluate(node=>{const range=document.createRange();range.selectNodeContents(node);const box=node.getBoundingClientRect();const lines=[...range.getClientRects()].map(rect=>({top:rect.top,bottom:rect.bottom,left:rect.left,right:rect.right}));return{box:{left:box.left,right:box.right},lines};});
  expect(size.lines.length).toBe(1);expect(size.lines[0].left).toBeGreaterThanOrEqual(size.box.left);expect(size.lines[0].right).toBeLessThanOrEqual(size.box.right);
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});
