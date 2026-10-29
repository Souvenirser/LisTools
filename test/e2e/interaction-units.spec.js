import {test,expect} from '@playwright/test';

async function open(page,name,theme='dark'){
 await page.addInitScript(theme=>{localStorage.setItem('listools-language','en');localStorage.setItem('listools-preferences-v1',JSON.stringify({theme}));},theme);
 await page.goto('/'+name+'.html');
 await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
}

// Resolve the actual painted background, including transparent nested timezone labels.
async function contrast(locator){
 return locator.evaluate(element=>{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const context=canvas.getContext('2d');
  const rgba=value=>{context.clearRect(0,0,1,1);context.fillStyle=value;context.fillRect(0,0,1,1);const pixel=context.getImageData(0,0,1,1).data;return [pixel[0],pixel[1],pixel[2],pixel[3]/255];};
  const blend=(front,back)=>front.slice(0,3).map((value,i)=>value*(front[3]??1)+back[i]*(1-(front[3]??1)));
  const luminance=rgb=>rgb.slice(0,3).map(value=>{const s=value/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;}).reduce((sum,value,i)=>sum+value*[.2126,.7152,.0722][i],0);
  const ancestors=[];for(let node=element;node;node=node.parentElement)ancestors.unshift(node);
  let background=[255,255,255];for(const node of ancestors)background=blend(rgba(getComputedStyle(node).backgroundColor),background);
  const color=blend(rgba(getComputedStyle(element).color),background),a=luminance(color),b=luminance(background);
  return {ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),color,background,text:element.textContent};
 });
}
async function readable(locator){
 const colors=await contrast(locator);
 expect(colors.ratio,JSON.stringify(colors)).toBeGreaterThanOrEqual(4.5);
}

for(const theme of ['dark','light'])for(const kind of ['unit','language','timezone']){
 test(`${theme} ${kind} Choices selected, hover and keyboard options remain readable`,async({page})=>{
  await open(page,kind==='timezone'?'timestamp':'units',theme);
  if(kind==='language')await page.locator('#settings-open').click();
  const control=page.locator(kind==='unit'?'.unit-picker .choices':kind==='language'?'.language-control .choices':'.timezone-controls .choices').first();
  await control.click();
  const choices=control.locator('.choices__list--dropdown [data-choice][data-value]');
  await readable(control.locator('input[type=search]'));
  const selected=control.locator('.choices__list--dropdown [data-choice].is-selected').first();
  await expect(selected).toBeVisible();await readable(selected);
  if(kind==='timezone')await readable(selected.locator('bdi'));
  const hover=choices.nth(1);
  await hover.hover();await expect(hover).toHaveClass(/is-highlighted/);await readable(hover);
  if(kind==='timezone')await readable(hover.locator('bdi'));
  await control.locator('input[type=search]').press('ArrowDown');
  const keyboard=control.locator('.choices__list--dropdown [data-choice].is-highlighted');
  await expect(keyboard).toHaveCount(1);await readable(keyboard);
  const value=await keyboard.getAttribute('data-value');
  await control.locator('input[type=search]').press('Enter');
  await expect(control.locator('select')).toHaveValue(value);
  await expect(control).toHaveAttribute('aria-expanded','false');
 });
}

async function toggleWithoutJump(page,checked,testInfo){
 const checkbox=page.locator('#unit-all');await checkbox.scrollIntoViewIfNeeded();
 await page.evaluate(()=>{
  window.unitFrames=[];window.unitFrameStart=performance.now();
  const sample=()=>{
   const checkbox=document.querySelector('#unit-all').getBoundingClientRect(),primary=document.querySelector('#unit-primary'),rect=primary.getBoundingClientRect();
   window.unitFrames.push({time:performance.now()-window.unitFrameStart,checkboxX:checkbox.x,checkboxY:checkbox.y,primaryX:rect.x,primaryY:rect.y,text:primary.querySelector('.unit-equation-status').textContent,copyDisabled:document.querySelector('#unit-copy').disabled});
   if(performance.now()-window.unitFrameStart<650)requestAnimationFrame(sample);
  };sample();
 });
 await checkbox.setChecked(checked);await page.waitForTimeout(700);
 const frames=await page.evaluate(()=>window.unitFrames);
 await testInfo.attach(`unit-${checked?'check':'uncheck'}-frames`,{body:JSON.stringify(frames),contentType:'application/json'});
 expect(frames.length).toBeGreaterThan(10);
 expect(frames.every(frame=>frame.text==='1 meters (m) = 0.001 kilometers (km)'&&!frame.copyDisabled),'primary/copy must stay available on every animation frame').toBe(true);
 for(const coordinate of ['checkboxX','checkboxY','primaryX','primaryY'])expect(Math.max(...frames.map(frame=>frame[coordinate]))-Math.min(...frames.map(frame=>frame[coordinate])),coordinate).toBeLessThanOrEqual(1);
}
for(const viewport of [{width:1360,height:960},{width:390,height:844}]){
 test(`all-unit checkbox preserves primary result and control positions throughout expansion at ${viewport.width}px`,async({page,context,browserName},testInfo)=>{
  await context.grantPermissions(browserName==='webkit'?['clipboard-read']:['clipboard-read','clipboard-write']);await page.setViewportSize(viewport);await open(page,'units');
  await expect(page.locator('#unit-primary .unit-equation-status')).toHaveText('1 meters (m) = 0.001 kilometers (km)');
  await toggleWithoutJump(page,true,testInfo);
  await expect(page.locator('#unit-results .numeric-result-row')).toHaveCount(9);
  await page.locator('#unit-more-results summary').click();
  await expect(page.locator('#unit-results')).toBeVisible();
  await page.locator('#unit-copy-all').click();
  const copied=await page.evaluate(()=>navigator.clipboard.readText());
  expect(copied.split('\n')).toHaveLength(10);expect(copied).toContain('0.001 km');expect(copied).toContain('100 cm');
  await toggleWithoutJump(page,false,testInfo);
  await expect(page.locator('#unit-results .numeric-result-row')).toHaveCount(0);
  await expect(page.locator('#unit-copy-all')).toBeHidden();
  await page.locator('#unit-value').fill('2');await expect(page.locator('#unit-primary .unit-equation-status')).toHaveText('2 meters (m) = 0.002 kilometers (km)');
  await page.locator('#unit-swap').click();await expect(page.locator('#unit-primary .unit-equation-status')).toHaveText('2 kilometers (km) = 2000 meters (m)');
  await page.locator('#unit-category').selectOption('temperature');await page.locator('#unit-value').fill('0');
  await expect(page.locator('#unit-primary .unit-equation-status')).toHaveText('0 degrees Celsius (°C) = 32 degrees Fahrenheit (°F)');
  await page.locator('#unit-copy').click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe('32');
 });
}

test('all-unit expansion preserves the focused row action past the input debounce',async({page})=>{
 await open(page,'units');await page.locator('#unit-all').check();
 await page.locator('#unit-more-results summary').click();
 const action=page.locator('#unit-results .numeric-result-row button').first();await action.focus();
 await page.waitForTimeout(500);await expect(action).toBeFocused();
});
