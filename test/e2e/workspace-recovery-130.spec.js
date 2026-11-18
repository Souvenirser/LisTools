import {test,expect} from '@playwright/test';
import {PNG} from 'pngjs';

const tool=page=>page.frameLocator('iframe[data-workspace-active]');
const retry=page=>page.locator('.workspace-navigation-status button');
const link=(page,id)=>page.locator(`#tool-menu nav a[data-tool-id="${id}"]`);
async function seed(page,theme='light'){
 await page.addInitScript(theme=>{
  localStorage.setItem('listools-language','zh-Hans');
  localStorage.setItem('listools-preferences-v1',JSON.stringify({theme}));
  localStorage.setItem('listools-menu-expanded-v1',JSON.stringify(['daily','files','developer','network']));
 },theme);
}
async function open(page,id='dates',hash=''){
 await page.goto('/'+id+'.html'+hash);
 await expect(tool(page).locator('main h1')).toBeVisible();
}
async function select(page,id){
 await page.locator('#global-search-open').click();await link(page,id).click();
}
async function choose(page,id,field){
 await select(page,id);
 await expect(tool(page).locator('#'+field)).toBeVisible();
}
const rejectNext=(page,id)=>page.route(`**/${id}.html`,r=>r.fulfill({status:503,contentType:'text/html',body:'<!doctype html><html data-ui-state="failed"><title>Unavailable</title>'}),{times:1});

test('retry of a dropdown choice commits once and Back returns to its source',async({page})=>{
 await seed(page);await open(page);await choose(page,'units','unit-value');
 const before=await page.evaluate(()=>history.length);
 await rejectNext(page,'money');await select(page,'money');
 await expect(retry(page)).toBeVisible();await expect(page).toHaveURL(/units.html$/);
 expect(await page.evaluate(()=>history.length)).toBe(before);
 await retry(page).click();await expect(tool(page).locator('#money-input')).toBeVisible();
 expect(await page.evaluate(()=>history.length)).toBe(before+1);
 await page.goBack();await expect(tool(page).locator('#unit-value')).toBeVisible();
 await page.goForward();await expect(tool(page).locator('#money-input')).toBeVisible();
 await page.goBack();await page.goBack();await expect(tool(page).locator('#date-start')).toBeVisible();
});

test('retry of browser Back preserves the existing Forward entry',async({page})=>{
 await seed(page);await open(page);await choose(page,'units','unit-value');await choose(page,'money','money-input');
 const before=await page.evaluate(()=>history.length);
 await rejectNext(page,'units');await page.goBack();await expect(retry(page)).toBeVisible();
 await expect(tool(page).locator('#money-input')).toBeVisible();
 await retry(page).click();await expect(tool(page).locator('#unit-value')).toBeVisible();
 expect(await page.evaluate(()=>history.length)).toBe(before);
 await page.goForward();await expect(tool(page).locator('#money-input')).toBeVisible();
});

test('a prepared iframe cannot replace visible content before its boot screen has actually cleared',async({page})=>{
 await seed(page);
 await page.addInitScript(()=>{
  if(location.pathname!=='/units.html'||window===parent)return;
  // Hold only the final bootstrap acknowledgement; load the real HTML, tool, styles and locale.
  let boot;Object.defineProperty(window,'LisToolsBoot',{configurable:true,get:()=>boot,set(api){boot=api;const ready=api.ready;api.ready=()=>{window.finishBoot=ready;};}});
 });
 await open(page);await select(page,'units');
 await page.waitForFunction(()=>typeof document.querySelector('iframe[src$="units.html"]')?.contentWindow?.finishBoot==='function');
 await expect(tool(page).locator('#date-start')).toBeVisible();await expect(page).toHaveURL(/dates.html$/);
 await page.evaluate(()=>document.querySelector('iframe[src$="units.html"]').contentWindow.finishBoot());
 await expect(tool(page).locator('#unit-value')).toBeVisible();await expect(page).toHaveURL(/units.html$/);
});

test('choosing the visible tool withdraws a failed Back without leaving a stale retry or address',async({page})=>{
 await seed(page);await open(page);await choose(page,'units','unit-value');
 await rejectNext(page,'dates');await page.goBack();await expect(retry(page)).toBeVisible();
 await select(page,'units');await expect(retry(page)).toBeHidden();
 await expect(page).toHaveURL(/units.html$/);await expect(tool(page).locator('#unit-value')).toBeVisible();
 await page.goBack();await expect(tool(page).locator('#date-start')).toBeVisible();
});

function changedPixels(before,after,rect){
 let changed=0;
 for(let y=rect.y;y<rect.y+rect.h;y++)for(let x=rect.x;x<rect.x+rect.w;x++){
  const j=(y*before.width+x)*4;
  if([0,1,2].some(k=>Math.abs(before.data[j+k]-after.data[j+k])>3))changed++;
 }
 return changed/(rect.w*rect.h);
}
for(const [entry,task,prefix,opener,theme] of [
 ['tax','wage','tax','tax-help','light'],['tax','annual','tax','tax-help','dark'],
 ['insurance','attached','insurance-deduction','insurance-tax-help','dark']
])test(`${task} deduction assistant owns keyboard, pointer and the painted workbench in ${theme}`,async({page},info)=>{
 await seed(page,theme);await open(page,entry,task==='annual'?'#annual':'');const f=tool(page);
 if(task==='annual')await expect(f.locator('#tax-annual-section')).toHaveJSProperty('open',true);
 if(entry==='insurance'){await f.locator('#insurance-tax-settings>summary').click();await f.locator('#insurance-tax-enabled').check();}
 const trigger=f.locator('#'+opener),dialog=f.locator('#'+prefix+'-assistant');
 await trigger.scrollIntoViewIfNeeded();await trigger.focus();
 const before=PNG.sync.read(await page.screenshot());
 await trigger.press('Enter');await expect(dialog).toBeVisible();
 const shot=await page.screenshot(),after=PNG.sync.read(shot);await info.attach('open-assistant',{body:shot,contentType:'image/png'});
 const painted={header:changedPixels(before,after,{x:0,y:0,w:1200,h:55}),workspaceLeft:changedPixels(before,after,{x:0,y:90,w:210,h:600}),workspace:changedPixels(before,after,{x:1290,y:200,w:55,h:400})};
 await info.attach('background-pixel-change',{body:JSON.stringify(painted),contentType:'application/json'});
 for(const [region,changed] of Object.entries(painted))expect(changed,`${region} needs a visible backdrop`).toBeGreaterThan(.75);
 const settings=await page.locator('#settings-open').boundingBox();await page.mouse.click(settings.x+8,settings.y+8);
 await expect(page.locator('#workbench-settings')).not.toHaveAttribute('open','');
 const close=dialog.locator('#'+prefix+'-assistant-close');await close.focus();await page.keyboard.press('Shift+Tab');
 expect(await dialog.evaluate(n=>n.contains(n.ownerDocument.activeElement)&&n.ownerDocument.hasFocus())).toBe(true);
 await page.keyboard.press('Tab');await expect(close).toBeFocused();
 await page.keyboard.press('ControlOrMeta+k');await expect(page.locator('#tool-menu-search')).not.toBeFocused();
 await page.keyboard.press('Escape');await expect(dialog).toBeHidden();await expect(trigger).toBeFocused();
 await page.locator('#settings-open').click();await expect(page.locator('#workbench-settings')).toBeVisible();
});

test('Back dismisses a draft assistant and Forward restores the tool without a modal lock',async({page})=>{
 await seed(page);await open(page);await choose(page,'tax','tax-help');
 const f=tool(page);await f.locator('#tax-help').click();await f.locator('#tax-children').fill('1');
 await page.goBack();await expect(f.locator('#date-start')).toBeVisible();
 await page.locator('#settings-open').click();await expect(page.locator('#workbench-settings')).toBeVisible();
 await page.keyboard.press('Escape');await page.goForward();await expect(f.locator('#tax-help')).toBeVisible();
 await expect(f.locator('dialog[open]')).toHaveCount(0);
 await f.locator('#tax-help').click();await expect(f.locator('#tax-children')).toHaveValue('1');
});

test('Cron UTC remains a nonmodal popover and does not block workbench settings',async({page})=>{
 await seed(page);await open(page,'cron');const f=tool(page);
 await f.locator('.cron-utc-trigger').first().click();
 await expect(f.locator('#cron-utc-panel')).toBeVisible();
 await page.locator('#settings-open').click();await expect(page.locator('#workbench-settings')).toBeVisible();
});

function pauseResponse(){
 let arrived,resume;
 const requested=new Promise(r=>arrived=r),hold=new Promise(r=>resume=r);
 return {requested,resume,async handle(route){arrived();await hold;await route.continue().catch(()=>{});}};
}
function ink(png,theme,x1,y1,x2,y2){
 let count=0;
 for(let y=Math.ceil(png.height*y1);y<png.height*y2;y++)for(let x=Math.ceil(png.width*x1);x<png.width*x2;x++){
  const j=(png.width*y+x)*4,r=png.data[j],g=png.data[j+1],b=png.data[j+2];
  if(theme==='dark'?Math.min(r,g,b)>100:Math.max(r,g,b)<180)count++;
 }
 return count;
}
for(const theme of ['light','dark'])test(`cold startup, slow dropdown switch and rapid Back/Forward keep real workspace pixels (${theme})`,async({page,browserName},info)=>{
 test.skip(browserName!=='chromium','Paint samples come from the Chromium compositor.');
 await seed(page,theme);const cold=pauseResponse(),slow=pauseResponse(),superseded=pauseResponse();
 let dates=0;await page.route('**/dates.html',route=>++dates===2?cold.handle(route):route.continue());
 await page.goto('/dates.html',{waitUntil:'commit'});await cold.requested;
 await expect(page.locator('#page-boot .boot-message')).toBeVisible();
 await info.attach('cold-loading',{body:await page.screenshot(),contentType:'image/png'});
 cold.resume();await expect(tool(page).locator('#date-start')).toBeVisible();
 const cdp=await page.context().newCDPSession(page),frames=[];
 cdp.on('Page.screencastFrame',ev=>{frames.push(Buffer.from(ev.data,'base64'));void cdp.send('Page.screencastFrameAck',{sessionId:ev.sessionId}).catch(()=>{});});
 await cdp.send('Page.startScreencast',{format:'png',maxWidth:800,maxHeight:600,everyNthFrame:1});
 try{
  await page.route('**/units.html',r=>slow.handle(r),{times:1});await select(page,'units');await slow.requested;
  await expect(page.locator('.workspace-navigation-status')).toBeVisible();await expect(tool(page).locator('#date-start')).toBeVisible();await expect(page).toHaveURL(/dates.html$/);
  await info.attach('slow-with-previous-tool',{body:await page.screenshot(),contentType:'image/png'});
  slow.resume();await expect(tool(page).locator('#unit-value')).toBeVisible();
  await page.route('**/money.html',r=>superseded.handle(r),{times:1});await select(page,'money');await superseded.requested;
  await page.goBack();await page.goForward();superseded.resume();
  await expect(page).toHaveURL(/units.html$/);await expect(tool(page).locator('#unit-value')).toBeVisible();
  await expect(page.locator('iframe[data-workspace-frame]')).toHaveCount(1);
  await expect(page.locator('.workspace-navigation-status')).toBeHidden();
  await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
 }finally{slow.resume();superseded.resume();await cdp.send('Page.stopScreencast');await cdp.detach();}
 const counts=frames.map(buffer=>{const p=PNG.sync.read(buffer);return {header:ink(p,theme,0,0,.99,.061),workspace:ink(p,theme,.08,.13,.92,.8)};});
 await info.attach('paint-counts',{body:JSON.stringify(counts),contentType:'application/json'});
 expect(counts.length).toBeGreaterThan(2);
 for(const [i,frame] of counts.entries())for(const [region,count] of Object.entries(frame)){
  if(count<40)await info.attach(`empty-${region}-${i}`,{body:frames[i],contentType:'image/png'});
  expect(count,`${region} lost visible content in frame ${i}`).toBeGreaterThanOrEqual(40);
 }
});
