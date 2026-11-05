import {test,expect} from '@playwright/test';

async function ready(page,path='/index.html'){
 await page.goto(path);await expect(page.locator('html')).toHaveAttribute('data-ui-state','ready');await page.waitForTimeout(250);
}
for(const [button,panel,close] of [['settings-open','workbench-settings','close'],['recent-open','recent-tools','hidePopover']]){
 test(`${button} has a real exit transition and closing content cannot take focus`,async({page,browserName})=>{
  test.skip(browserName!=='chromium','Native top-layer exit animation is a Chromium enhancement.');await ready(page);
  await page.locator('#'+button).click();await page.waitForTimeout(220);
  const frames=await page.locator('#'+panel).evaluate((node,close)=>new Promise(resolve=>{
   const frames=[],start=performance.now();node[close]();
   function frame(){const style=getComputedStyle(node);frames.push({display:style.display,opacity:Number(style.opacity),inert:style.interactivity});if(performance.now()-start<260)requestAnimationFrame(frame);else resolve(frames);}requestAnimationFrame(frame);
  }),close);
  expect(frames.some(frame=>frame.display!=='none'&&frame.opacity>0&&frame.opacity<1)).toBe(true);
  expect(frames.at(-1).display).toBe('none');for(const frame of frames)if(frame.display!=='none')expect(frame.inert).toBe('inert');
  await page.locator('#'+button).click();await expect(page.locator('#'+panel)).toBeVisible();
 });
 test(`${button} entrance contains visible intermediate frames`,async({page})=>{
  await ready(page);
  const frames=await page.locator('#'+button).evaluate((button,panel)=>new Promise(resolve=>{
   const values=[],start=performance.now();button.click();
   function frame(){values.push(Number(getComputedStyle(document.getElementById(panel)).opacity));if(performance.now()-start<240)requestAnimationFrame(frame);else resolve(values);}requestAnimationFrame(frame);
  }),panel);
  expect(frames.some(value=>value>0&&value<.98)).toBe(true);expect(frames.at(-1)).toBe(1);
 });
}

test('tool navigation keeps the old screen until the initialized destination can arrive',async({page,browserName})=>{
 test.skip(browserName!=='chromium','Cross-document transition readiness is checked in Chromium.');
 await page.addInitScript(()=>{window.navigationFrames=[];addEventListener('pagereveal',event=>{navigationFrames.push({state:document.documentElement.dataset.uiState,native:!!event.viewTransition});event.viewTransition?.ready.then(()=>navigationFrames.push('ready'),error=>navigationFrames.push(error.name));event.viewTransition?.finished.then(()=>navigationFrames.push('finished'));});});
 await ready(page);await page.locator('details[data-group-id="daily"]>summary').click();await page.locator('[data-tool-id="money"]').click();
 await expect(page.locator('html')).toHaveAttribute('data-ui-state','ready');await page.waitForTimeout(300);
 const frames=await page.evaluate(()=>navigationFrames);expect(frames.some(frame=>frame?.native)).toBe(true);expect(frames).toContain('finished');await expect(page.locator('html')).toHaveAttribute('data-ui-state','ready');expect(await page.locator('html').getAttribute('data-native-phase')).toBeNull();
});

test('new tab entrance keeps the shell visible and respects reduced motion',async({page})=>{
 await page.addInitScript(()=>{window.arrivals=[];const until=performance.now()+2000;function frame(){const main=document.querySelector('main');if(main&&document.documentElement.dataset.uiState==='ready')for(const animation of main.getAnimations())arrivals.push({duration:animation.effect.getTiming().duration,body:Number(getComputedStyle(document.body).opacity),main:Number(getComputedStyle(main).opacity)});if(performance.now()<until)requestAnimationFrame(frame);}requestAnimationFrame(frame);});
 await page.goto('/index.html');await expect(page.locator('html')).toHaveAttribute('data-ui-state','ready');
 await expect.poll(()=>page.evaluate(()=>arrivals.some(frame=>frame.duration===150))).toBe(true);
 for(const frame of await page.evaluate(()=>arrivals)){expect(frame.body).toBe(1);expect(frame.main).toBeGreaterThanOrEqual(.95);}
 await page.emulateMedia({reducedMotion:'reduce'});await ready(page);expect(await page.locator('main').evaluate(n=>getComputedStyle(n).animationName)).toBe('none');
 await page.locator('#settings-open').click();await page.locator('#settings-close').click();await expect(page.locator('#workbench-settings')).not.toBeVisible();
});

test('an unusually slow destination releases its old-screen hold and remains recoverable',async({page,browserName})=>{
 test.skip(browserName!=='chromium','Native holding path is checked in Chromium.');await ready(page);
 let release;const held=new Promise(resolve=>release=resolve);await page.route('**/assets/money-*.js',async route=>{await held;await route.continue();});
 await page.locator('details[data-group-id="daily"]>summary').click();await page.locator('[data-tool-id="money"]').click();
 await expect(page.locator('#page-boot')).toBeVisible();await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.nativePhase)).toBeUndefined();
 release();await expect(page.locator('html')).toHaveAttribute('data-ui-state','ready');await expect(page.locator('#page-boot')).toHaveCount(0);
});
