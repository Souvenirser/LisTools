import {test,expect} from '@playwright/test';

const tool=page=>page.frameLocator('iframe[data-workspace-active]');
async function open(page,width=1440){
 await page.setViewportSize({width,height:900});await page.addInitScript(()=>{localStorage.setItem('listools-language','zh-Hans');localStorage.setItem('listools-preferences-v1',JSON.stringify({theme:'dark'}));});
 await page.goto('/dates.html');await expect(tool(page).locator('#date-start')).toBeVisible();
}
for(const width of [390,1440])for(const task of ['difference','workdays'])test(`${task} inclusive toggle never blanks its result or shifts the input area — ${width}`,async({page})=>{
 await open(page,width);const f=tool(page);if(task==='workdays'){const select=f.locator('#dates-task-select');if(await select.isVisible())await select.selectOption(task);else await f.locator('[data-task=workdays]').click();}
 const prefix=task==='difference'?'date':'work';await f.locator('#'+prefix+'-start').fill('2026-11-16');await f.locator('#'+prefix+'-end').fill('2026-11-16');await f.locator('#'+task+'-run').click();
 await f.locator('#'+task+'-output .date-interval-times>summary').click();
 await f.locator('#'+prefix+'-inclusive').scrollIntoViewIfNeeded();
 const selectors=['#'+prefix+'-start','#'+prefix+'-end','#'+prefix+'-inclusive','#'+task+'-run'];
 await f.locator('body').evaluate((body,{task,selectors})=>{
  window.dateFrames=[];window.dateCapture=true;window.dateInitialDetails=document.querySelector('#'+task+'-output details');
  const top=selector=>document.querySelector(selector).getBoundingClientRect().top+scrollY+document.querySelector('main').scrollTop;
  window.dateBaseline=selectors.map(top);
  const sample=()=>{if(!window.dateCapture)return;window.dateFrames.push({blank:!document.querySelector('#'+task+'-output .date-conclusion'),tops:selectors.map(top)});requestAnimationFrame(sample);};requestAnimationFrame(sample);
 },{task,selectors});
 for(let i=0;i<4;i++){
  await f.locator('#'+prefix+'-inclusive').setChecked(i%2===0);await expect(f.locator('#'+task+'-output .date-conclusion')).toContainText(i%2===0?'1':'0');
  await expect(f.locator('#'+task+'-output details').first()).toHaveAttribute('open');
 }
 const evidence=await f.locator('body').evaluate((body,task)=>{window.dateCapture=false;return{frames:window.dateFrames,baseline:window.dateBaseline,sameDetails:window.dateInitialDetails===document.querySelector('#'+task+'-output details')};},task);
 await test.info().attach('date-frames.json',{body:JSON.stringify(evidence,null,2),contentType:'application/json'});
 expect(evidence.frames.length).toBeGreaterThan(0);expect(evidence.frames.filter(frame=>frame.blank)).toEqual([]);
 for(const frame of evidence.frames)frame.tops.forEach((top,i)=>expect(Math.abs(top-evidence.baseline[i])).toBeLessThanOrEqual(1));
 expect(evidence.sameDetails).toBe(true);
});

test('unit target checkbox and first copy keep the source controls and full value stable',async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('listools-language','zh-Hans');Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.lastCopied=text;}}});});
 await page.goto('/units.html');const f=tool(page);await f.locator('#unit-value').fill('25');await f.locator('#unit-run').click();const source=await f.locator('#unit-value').boundingBox();
 for(let i=0;i<4;i++){
  await f.locator('#unit-all').setChecked(i%2===0);await expect(f.locator('#unit-primary')).toBeVisible();const after=await f.locator('#unit-value').boundingBox();expect(Math.abs(source.y-after.y)).toBeLessThanOrEqual(1);
 }
 await f.locator('#unit-value').focus();await f.locator('#unit-copy').click();expect(await f.locator('body').evaluate(()=>window.lastCopied)).toBe('0.025');
});

test('calculator parentheses and delete work in the requested first-row order',async({page})=>{
 await open(page);await page.goto('/calculator.html');const f=tool(page),keys=f.locator('#keypad button');await expect(keys.first()).toBeVisible();
 expect(await keys.evaluateAll(nodes=>nodes.slice(0,4).map(n=>n.dataset.key))).toEqual(['clear','(',')','backspace']);
 for(const key of ['(','9',')','backspace'])await f.locator(`#keypad button[data-key="${key}"]`).click();await expect(f.locator('#expression')).toHaveValue('(9');
 await f.locator('#keypad button[data-key=")"]').click();await f.locator('#calculate').click();await expect(f.locator('#result')).toHaveText('9');
});

test('changed date input disables old copies and shows its notice in the result area',async({page})=>{
 await open(page);const f=tool(page);await f.locator('#difference-run').click();await expect(f.locator('#difference-copy')).toBeEnabled();
 await f.locator('#date-start').fill('');await expect(f.locator('#difference-copy')).toBeDisabled();
 expect(await f.locator('#tool-status').evaluate(node=>Boolean(node.closest('#difference-result')))).toBe(true);
 await expect(f.locator('#date-start')).toBeFocused();await f.locator('#difference-run').click();await expect(f.locator('#date-start')).toHaveAttribute('aria-invalid','true');
 await f.locator('#date-start').fill('2026-11-16');await f.locator('#date-end').fill('2026-11-17');await f.locator('#difference-run').click();await expect(f.locator('#difference-output .date-conclusion')).toContainText('1');
});
