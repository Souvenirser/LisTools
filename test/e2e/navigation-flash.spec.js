import {test,expect} from '@playwright/test';

for(const mode of ['native','without-wait','without-native'])test(`repeated converter and Cron navigation never fades out the shell (${mode})`,async({page})=>{
 test.setTimeout(60000);await page.setViewportSize({width:1440,height:900});
 if(mode==='without-native')await page.route('**/boot.css',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('navigation:auto','navigation:none')});});
 await page.addInitScript(mode=>{
  if(mode==='without-wait'&&globalThis.ViewTransition)Object.defineProperty(ViewTransition.prototype,'waitUntil',{configurable:true,value:undefined});
  if(!localStorage.getItem('listools-preferences-v1')){localStorage.setItem('listools-language','zh-Hans');localStorage.setItem('listools-preferences-v1',JSON.stringify({theme:'dark',favorites:[]}));localStorage.setItem('listools-menu-expanded-v1',JSON.stringify(['daily','files','developer','network']));}
  window.visibleFrames=[];
  function sample(){const body=document.body,main=document.querySelector('main'),header=document.querySelector('.app-header'),active=document.querySelector('iframe[data-workspace-active]');if(main&&header&&active&&document.documentElement.dataset.uiState==='ready')visibleFrames.push({body:Number(getComputedStyle(body).opacity),main:Number(getComputedStyle(main).opacity),header:Number(getComputedStyle(header).opacity),active:Number(getComputedStyle(active).opacity)});requestAnimationFrame(sample);}requestAnimationFrame(sample);
 },mode);
 await page.goto('/convert.html#base64');await expect(page.locator('html')).toHaveAttribute('data-ui-state','ready');await page.locator('button.brand').click();await page.locator('#tool-menu .tool-menu-scroll').evaluate(n=>n.scrollTop=n.scrollHeight);
 for(let i=0;i<20;i++){
  if(i)await page.locator('button.brand').click();
  const id=i%2===0?'cron':'convert',link=page.locator(`#tool-menu nav [data-tool-id="${id}"]`);await link.scrollIntoViewIfNeeded();await expect(link).toBeInViewport({ratio:1});const rect=await link.boundingBox();await page.mouse.click(rect.x+45,rect.y+rect.height/2);
  await page.waitForURL('**/'+(id==='cron'?'cron.html':'convert.html#base64'));await expect(page.locator('html')).toHaveAttribute('data-ui-state','ready');await page.evaluate(()=>new Promise(requestAnimationFrame));
  const frames=await page.evaluate(()=>visibleFrames);expect(frames.length).toBeGreaterThan(0);
  for(const frame of frames){expect(frame.body,`${mode} click ${i} body`).toBe(1);expect(frame.header).toBe(1);expect(frame.active).toBe(1);expect(frame.main,`${mode} click ${i} workspace flash`).toBeGreaterThanOrEqual(.95);}
 }
});
