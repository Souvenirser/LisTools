import {test,expect} from '@playwright/test';

async function ready(page,path='/index.html'){
 await page.goto(path);await expect(page.locator('html')).toHaveAttribute('data-ui-state','ready');
 await page.waitForTimeout(220);
}
async function sampleToggle(locator){
 return locator.evaluate(node=>new Promise(resolve=>{
  const frames=[],start=performance.now();
  node.querySelector('summary').click();
  function frame(){frames.push(node.getBoundingClientRect().height);if(performance.now()-start<260)requestAnimationFrame(frame);else resolve(frames);}
  requestAnimationFrame(frame);
 }));
}

test('mobile tool menu is positioned correctly from its first visible frame',async({page})=>{
 await page.setViewportSize({width:1000,height:800});await page.emulateMedia({reducedMotion:'reduce'});await ready(page);
 await page.evaluate(()=>{window.menuFrames=[];document.querySelector('#tool-menu').addEventListener('beforetoggle',event=>{if(event.newState!=='open')return;let count=0;function frame(){const r=event.target.getBoundingClientRect();menuFrames.push({x:r.x,y:r.y});if(++count<6)requestAnimationFrame(frame);}requestAnimationFrame(frame);});});
 await page.locator('button.brand').click();await page.waitForTimeout(200);
 const frames=await page.evaluate(()=>menuFrames);expect(frames.length).toBeGreaterThan(2);
 for(const frame of frames){expect(frame.x).toBe(frames.at(-1).x);expect(frame.y).toBe(frames.at(-1).y);expect(frame.y).toBeGreaterThan(40);}
});

test('categories ease open and closed, keep final state and restore their preference',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await ready(page);
 const group=page.locator('#tool-menu details[data-group-id="daily"]');
 const closed=(await group.boundingBox()).height,opening=await sampleToggle(group),expanded=opening.at(-1);
 expect(expanded).toBeGreaterThan(closed+100);
 const supported=await page.evaluate(()=>CSS.supports('interpolate-size','allow-keywords')&&CSS.supports('interactivity','inert')&&CSS.supports('selector(::details-content)'));
 if(supported){expect(opening.some(height=>height>closed+2&&height<expanded-2)).toBe(true);const closing=await sampleToggle(group);expect(closing.some(height=>height>closed+2&&height<expanded-2)).toBe(true);}else await group.locator('summary').click();
 await expect(group).toHaveJSProperty('open',false);
 await group.locator('summary').evaluate(node=>{node.click();node.click();node.click();});await page.waitForTimeout(260);
 await expect(group).toHaveJSProperty('open',true);await page.reload();await expect(group).toHaveJSProperty('open',true);
 await group.locator('summary').click();await page.waitForTimeout(260);await expect(group.locator('a').first()).not.toBeVisible();
});

test('conversion categories animate without covering tools and preserve search and folding',async({page})=>{
 await page.setViewportSize({width:1920,height:1080});await ready(page,'/convert.html');
 const group=page.locator('#convert-tool-list details').first();await expect(group).toHaveJSProperty('open',true);
 await sampleToggle(group);await expect(group).toHaveJSProperty('open',false);
 await page.locator('#convert-search').fill('base64');await expect(group).toHaveJSProperty('open',true);
 await page.locator('#convert-search').clear();await expect(group).toHaveJSProperty('open',false);
 await group.locator('summary').click();await page.waitForTimeout(250);
 const summary=await group.locator('summary').boundingBox(),item=await group.locator('a').first().boundingBox();expect(item.y).toBeGreaterThanOrEqual(summary.y+summary.height);
});

test('task switch eases its content without recreating inputs or replaying on the current task',async({page})=>{
 await ready(page,'/password.html');await page.locator('#password-generate').click();
 await page.evaluate(()=>window.originalField=document.querySelector('#password-batch'));
 const active=await page.locator('#password-task-passphrase').evaluate(node=>{node.click();return document.querySelector('.password-workspace').getAnimations().length;});
 expect(active).toBe(1);await page.waitForTimeout(150);
 expect(await page.evaluate(()=>window.originalField===document.querySelector('#password-batch'))).toBe(true);
 await page.locator('#password-generate').click();const value=await page.locator('#password-results textarea').first().inputValue();
 await page.locator('#password-task-passphrase').click();expect(await page.locator('.password-workspace').evaluate(node=>node.getAnimations().length)).toBe(0);
 expect(await page.locator('#password-results textarea').first().inputValue()).toBe(value);
});

test('reduced motion preserves immediate task changes and removes category animation',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await ready(page,'/password.html');
 await page.locator('#password-task-passphrase').click();expect(await page.locator('.password-workspace').evaluate(node=>node.getAnimations().length)).toBe(0);
 const group=page.locator('#tool-menu details').first();await group.locator('summary').click();
 expect(await group.evaluate(node=>getComputedStyle(node,'::details-content').transitionDuration)).toBe('0s');
});

test('constrained popup keeps its footer within the viewport on every disclosure frame',async({page})=>{
 await page.setViewportSize({width:360,height:440});await ready(page,'/popup.html');
 const frames=await page.locator('details[data-group-id="developer"]').evaluate(node=>new Promise(resolve=>{
  const bottoms=[],start=performance.now();node.querySelector('summary').click();
  function frame(){bottoms.push(document.querySelector('.tool-menu-footer').getBoundingClientRect().bottom);if(performance.now()-start<350)requestAnimationFrame(frame);else resolve(bottoms);}
  requestAnimationFrame(frame);
 }));
 for(const bottom of frames)expect(bottom).toBeLessThanOrEqual(441);
});

test('closing a category never lets ArrowDown enter its fading links',async({page})=>{
 await ready(page);const group=page.locator('#tool-menu details[data-group-id="daily"]');
 await group.locator('summary').click();await page.waitForTimeout(220);
 await group.locator('summary').evaluate(node=>{node.focus();node.click();node.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));});
 await expect(page.locator('#tool-menu details[data-group-id="files"] > summary')).toBeFocused();
 await page.waitForTimeout(220);await expect(page.locator('#tool-menu details[data-group-id="files"] > summary')).toBeFocused();
});

test('tax task switching shares the same gentle arrival without changing input values',async({page})=>{
 await ready(page,'/tax.html');await page.locator('#tax-salary').fill('12345');
 const active=await page.locator('#tax-task-bonus').evaluate(node=>{node.click();return document.querySelector('.payroll-workspace').getAnimations().length;});
 expect(active).toBe(1);await page.waitForTimeout(150);await page.locator('#tax-task-wage').click();
 await expect(page.locator('#tax-salary')).toHaveValue('12345');
});

test('newly opened disclosure fields can receive focus synchronously',async({page})=>{
 await ready(page,'/qr.html');
 expect(await page.locator('#qr-level').evaluate(node=>{node.closest('details').open=true;node.focus();return document.activeElement===node;})).toBe(true);
 await page.waitForTimeout(220);await expect(page.locator('#qr-level')).toBeFocused();
});

test('native Tab skips closing category links while their visual transition finishes',async({page})=>{
 await ready(page);
 test.skip(!await page.evaluate(()=>CSS.supports('interactivity','inert')&&CSS.supports('interpolate-size','allow-keywords')),'Native folding fallback has no fading links; animation-specific Tab check is not applicable.');
 const summary=page.locator('#tool-menu details[data-group-id="daily"]>summary');
 await summary.click();await page.waitForTimeout(220);await summary.focus();await page.keyboard.press('Enter');
 await expect(summary.locator('..')).toHaveJSProperty('open',false);await page.keyboard.press('Tab');
 await expect(page.locator('#tool-menu details[data-group-id="files"]>summary')).toBeFocused();
 await page.waitForTimeout(220);await expect(page.locator('#tool-menu details[data-group-id="files"]>summary')).toBeFocused();
});
