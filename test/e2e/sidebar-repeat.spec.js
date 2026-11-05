import {test,expect} from '@playwright/test';

async function ready(page){
 await page.setViewportSize({width:1440,height:900});
 await page.addInitScript(()=>{localStorage.setItem('listools-language','zh-Hans');localStorage.setItem('listools-preferences-v1',JSON.stringify({theme:'dark',favorites:['json','diff','timestamp']}));localStorage.setItem('listools-menu-expanded-v1',JSON.stringify(['daily','files','developer','network']));});
 await page.goto('/cron.html');await expect(page.locator('html')).toHaveAttribute('data-ui-state','ready');await page.waitForTimeout(260);
}

test('repeated clicks on the current sidebar tool keep focus, scroll and the existing page',async({page})=>{
 await ready(page);const current=page.locator('#tool-menu nav [data-tool-id="cron"]');await current.scrollIntoViewIfNeeded();
 const before=await page.locator('.tool-menu-scroll').evaluate(node=>node.scrollTop);
 await page.evaluate(()=>window.originalCron=document.querySelector('#cron-expression'));
 for(let i=0;i<3;i++){
  await current.click();await expect(current).toBeFocused();
  expect(await page.locator('.tool-menu-scroll').evaluate(node=>node.scrollTop)).toBe(before);
  expect(await page.evaluate(()=>window.originalCron===document.querySelector('#cron-expression'))).toBe(true);
 }
});

test('the selected tool paints the entire row through its favorite button with a stable right edge',async({page})=>{
 await ready(page);const row=page.locator('#tool-menu nav [data-menu-tool-id="cron"]');await row.scrollIntoViewIfNeeded();
 const appearance=await row.evaluate(node=>({background:getComputedStyle(node).backgroundColor,linkBackground:getComputedStyle(node.querySelector('a')).backgroundColor,right:node.getBoundingClientRect().right,categoryRight:node.closest('details').querySelector('summary').getBoundingClientRect().right}));
 expect(appearance.background).not.toBe('rgba(0, 0, 0, 0)');
 expect(appearance.linkBackground).toBe('rgba(0, 0, 0, 0)');
 expect(Math.abs(appearance.right-appearance.categoryRight)).toBeLessThanOrEqual(1);
});

test('rapid category reversals animate height without flashing all the tool labels',async({page})=>{
 await ready(page);
 test.skip(!await page.evaluate(()=>CSS.supports('interpolate-size','allow-keywords')&&CSS.supports('interactivity','inert')),'Native disclosure animation is an enhancement.');
 const frames=await page.locator('#tool-menu details[data-group-id="developer"]').evaluate(node=>new Promise(resolve=>{
  const frames=[],start=performance.now(),summary=node.querySelector('summary');summary.click();
  setTimeout(()=>summary.click(),45);setTimeout(()=>summary.click(),95);setTimeout(()=>summary.click(),160);
  function sample(){frames.push({height:node.getBoundingClientRect().height,opacity:Number(getComputedStyle(node,'::details-content').opacity),width:summary.getBoundingClientRect().width});if(performance.now()-start<450)requestAnimationFrame(sample);else resolve(frames);}sample();
 }));
 expect(frames.every(frame=>frame.opacity===1)).toBe(true);
 expect(new Set(frames.map(frame=>Math.round(frame.height))).size).toBeGreaterThan(3);
 expect(Math.max(...frames.map(frame=>frame.width))-Math.min(...frames.map(frame=>frame.width))).toBeLessThanOrEqual(1);
 await expect(page.locator('#tool-menu details[data-group-id="developer"]')).toHaveJSProperty('open',true);
});

for(const {width,height,theme} of [{width:1440,height:900,theme:'dark'},{width:1920,height:772,theme:'light'}])test(`switching development tools preserves every sidebar category position (${width}x${height}, ${theme})`,async({page})=>{
 await page.setViewportSize({width,height});
 await page.addInitScript(theme=>{
  if(!localStorage.getItem('listools-preferences-v1')){
   localStorage.setItem('listools-language','zh-Hans');localStorage.setItem('listools-preferences-v1',JSON.stringify({theme,favorites:['json','diff','timestamp']}));
   localStorage.setItem('listools-menu-expanded-v1',JSON.stringify(['daily','files','developer','network']));
  }
 },theme);
 await page.goto('/cron.html');await expect(page.locator('html')).toHaveAttribute('data-ui-state','ready');await page.waitForTimeout(260);
 const scroll=page.locator('#tool-menu .tool-menu-scroll');await scroll.evaluate(node=>node.scrollTop=node.scrollHeight);
 const geometry=()=>page.locator('#tool-menu').evaluate(root=>({scroll:root.querySelector('.tool-menu-scroll').scrollTop,groups:[...root.querySelectorAll('nav>details>summary')].map(node=>({y:node.getBoundingClientRect().y,height:node.getBoundingClientRect().height}))}));
 const original=await geometry();
 for(const id of ['timestamp','cron','md5','convert','regex','json','diff','cron']){
  const link=page.locator(`#tool-menu nav a[data-tool-id="${id}"]`),href=await link.getAttribute('href');
  // The converter normalizes its default route to #base64 after clearing #md5.
  await expect(link).toBeInViewport({ratio:1});await link.click();await page.waitForURL('**/'+(id==='convert'?'convert.html#base64':href.slice(2)));
  await expect(page.locator('html')).toHaveAttribute('data-ui-state','ready');await page.waitForTimeout(280);
  const current=await geometry();expect(Math.abs(current.scroll-original.scroll),id+' sidebar scroll').toBeLessThanOrEqual(1);
  for(let i=0;i<original.groups.length;i++)expect(Math.abs(current.groups[i].y-original.groups[i].y),id+' category '+i).toBeLessThanOrEqual(1);
 }
});

for(const zoom of [1.25,1.5])test(`MD5 to timestamp restores scroll coordinates without a scaled anchor offset (${zoom} CSS zoom)`,async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.addInitScript(zoom=>{
  if(!localStorage.getItem('listools-preferences-v1')){
   localStorage.setItem('listools-language','zh-Hans');localStorage.setItem('listools-preferences-v1',JSON.stringify({theme:'dark',favorites:[]}));
   localStorage.setItem('listools-menu-expanded-v1',JSON.stringify(['daily','files','developer','network']));
  }
  addEventListener('DOMContentLoaded',()=>document.documentElement.style.zoom=zoom);
 },zoom);
 await page.goto('/convert.html#md5');await expect(page.locator('html')).toHaveAttribute('data-ui-state','ready');await page.waitForTimeout(280);
 const scroll=page.locator('#tool-menu .tool-menu-scroll');await scroll.evaluate(node=>node.scrollTop=node.scrollHeight);
 const geometry=()=>scroll.evaluate(node=>({top:node.scrollTop,y:node.querySelector('nav [data-tool-id="timestamp"]').getBoundingClientRect().y}));
 const before=await geometry(),link=page.locator('#tool-menu nav [data-tool-id="timestamp"]');await expect(link).toBeInViewport({ratio:1});
 const box=await link.boundingBox();await page.mouse.click(box.x+40,box.y+box.height/2);await page.waitForURL('**/timestamp.html');await expect(page.locator('html')).toHaveAttribute('data-ui-state','ready');await page.waitForTimeout(280);
 const after=await geometry();expect(Math.abs(after.top-before.top),'sidebar scroll offset').toBeLessThanOrEqual(1);expect(Math.abs(after.y-before.y),'timestamp row position').toBeLessThanOrEqual(1);
});

test('a second sidebar click during a page transition reaches the destination',async({page})=>{
 await ready(page);const timestamp=page.locator('#tool-menu nav [data-tool-id="timestamp"]');await timestamp.click();
 await expect(page.locator('html')).toHaveAttribute('data-ui-state','ready');
 const md5=page.locator('#tool-menu nav [data-tool-id="md5"]'),box=await md5.boundingBox();
 await page.mouse.click(box.x+40,box.y+box.height/2);
 await expect(page).toHaveURL(/convert\.html#md5$/,{timeout:1500});
});

function developmentRoute(){
 const ids=['json','diff','timestamp','md5','convert','cron','regex'],edges=Object.fromEntries(ids.map(id=>[id,ids.filter(other=>other!==id)])),route=[];
 function visit(id){while(edges[id].length)visit(edges[id].pop());route.push(id);}visit('md5');return route.reverse();
}
for(const setup of [
 {width:1440,height:900,theme:'dark',favorites:[],groups:['daily','files','developer','network']},
 {width:1920,height:772,theme:'light',favorites:['json','diff','timestamp'],groups:['daily','files','developer']},
 {width:2048,height:1054,theme:'dark',favorites:[],groups:['developer']}
])test(`all development tool pairs retain the sidebar (${setup.width}x${setup.height})`,async({page})=>{
 test.setTimeout(90000);await page.setViewportSize({width:setup.width,height:setup.height});
 await page.addInitScript(setup=>{
  if(!localStorage.getItem('listools-preferences-v1')){
   localStorage.setItem('listools-language','zh-Hans');localStorage.setItem('listools-preferences-v1',JSON.stringify({theme:setup.theme,favorites:setup.favorites}));localStorage.setItem('listools-menu-expanded-v1',JSON.stringify(setup.groups));
  }
 },setup);
 await page.goto('/convert.html#md5');await expect(page.locator('html')).toHaveAttribute('data-ui-state','ready');await page.waitForTimeout(260);
 const scroll=page.locator('#tool-menu .tool-menu-scroll');await scroll.evaluate(node=>node.scrollTop=node.scrollHeight);
 const geometry=()=>scroll.evaluate(node=>({top:node.scrollTop,groups:[...node.querySelectorAll('nav>details>summary')].map(n=>n.getBoundingClientRect().y)}));
 const route=developmentRoute();expect(route.length-1).toBe(42);const initial=await geometry();
 for(let i=1;i<route.length;i++){
  const id=route[i],link=page.locator(`#tool-menu nav [data-tool-id="${id}"]`);await expect(link).toBeInViewport({ratio:1});
  const before=await geometry(),href=await link.getAttribute('href'),box=await link.boundingBox();await page.mouse.click(box.x+40,box.y+box.height/2);
  await expect(page).toHaveURL(new RegExp((id==='convert'?'convert.html#base64':href.slice(2)).replaceAll('.','\\.')+'$'));
  await expect(page.locator('html')).toHaveAttribute('data-ui-state','ready');const after=await geometry();
  expect(Math.abs(after.top-before.top),`${route[i-1]} → ${id} scroll`).toBeLessThanOrEqual(1);
  for(let g=0;g<before.groups.length;g++)expect(Math.abs(after.groups[g]-before.groups[g]),`${route[i-1]} → ${id} group ${g}`).toBeLessThanOrEqual(1);
 }
 for(const action of [()=>page.reload(),()=>page.goBack(),()=>page.goForward()]){
  await action();await expect(page.locator('html')).toHaveAttribute('data-ui-state','ready');await page.waitForTimeout(260);
  const after=await geometry();expect(Math.abs(after.top-initial.top)).toBeLessThanOrEqual(1);for(let g=0;g<initial.groups.length;g++)expect(Math.abs(after.groups[g]-initial.groups[g])).toBeLessThanOrEqual(1);
 }
});
