import {test,expect,chromium} from '@playwright/test';
import {mkdtemp,rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';

const extension=resolve(process.env.LISTOOLS_EXTENSION||'dist');
const executablePath=process.env.LISTOOLS_EXTENSION_CHROME||chromium.executablePath();
const extensionId=[...createHash('sha256').update(extension).digest('hex').slice(0,32)].map(n=>'abcdefghijklmnop'[parseInt(n,16)]).join('');

for(const {target,delay,recovery} of [{target:'cron',delay:700},{target:'timestamp',delay:700},{target:'cron',delay:3400,recovery:true}])test(recovery?'extension releases a stalled startup into visible recovery controls':`extension keeps the previous screen until ${target} is ready`,async({browserName},testInfo)=>{
 test.skip(browserName!=='chromium'||!existsSync(executablePath),'Requires an extension-capable Chromium binary.');
 const profile=await mkdtemp(join(tmpdir(),'listools-navigation-paint-'));
 const context=await chromium.launchPersistentContext(profile,{executablePath,headless:true,ignoreDefaultArgs:['--disable-extensions'],args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`],viewport:{width:1440,height:900}});
 try{
  await context.addInitScript(({target,delay})=>{
   localStorage.setItem('listools-language','zh-Hans');localStorage.setItem('listools-preferences-v1',JSON.stringify({theme:'dark',favorites:[]}));localStorage.setItem('listools-menu-expanded-v1',JSON.stringify(['daily','files','developer','network']));
   if(location.pathname!==`/${target}.html`)return;
   // A slower module/locale load must not expose the hidden startup document.
   let api;Object.defineProperty(window,'LisToolsBoot',{configurable:true,get:()=>api,set(value){api=value;const ready=value.ready;value.ready=()=>setTimeout(ready,delay);}});
   window.startupPaint=[];addEventListener('pagereveal',event=>{if(!event.viewTransition)return;const sample=()=>{startupPaint.push({time:performance.now(),state:document.documentElement.dataset.uiState,phase:document.documentElement.dataset.nativePhase});if(document.documentElement.dataset.uiState!=='ready')requestAnimationFrame(sample);};requestAnimationFrame(sample);});
  },{target,delay});
  const page=context.pages()[0];await page.goto(`chrome-extension://${extensionId}/convert.html`);await expect(page.locator('html')).toHaveAttribute('data-ui-state','ready');
  await page.locator('#tool-menu .tool-menu-scroll').evaluate(node=>node.scrollTop=node.scrollHeight);
  const before=await page.locator('#tool-menu .tool-menu-scroll').evaluate(node=>node.scrollTop);
  await page.locator(`#tool-menu nav [data-tool-id="${target}"]`).click();
  await page.waitForURL(`**/${target}.html`);
  await page.waitForFunction(()=>window.startupPaint?.some(frame=>frame.time>450&&frame.state==='booting'));
  if(recovery){await expect(page.locator('#page-boot button')).toBeVisible();await expect(page.locator('html')).not.toHaveAttribute('data-native-phase','waiting');}
  await testInfo.attach('during-startup',{body:await page.screenshot(),contentType:'image/png'});
  await expect(page.locator('html')).toHaveAttribute('data-ui-state','ready');
  const interrupted=await page.evaluate(()=>startupPaint.filter(frame=>frame.time<2900&&frame.state==='booting'&&frame.phase!=='waiting'));
  expect(interrupted,'The old screen was released while the new document was still hidden').toEqual([]);
  expect(await page.locator('#tool-menu .tool-menu-scroll').evaluate(node=>node.scrollTop)).toBe(before);
  await expect(page.locator(`#tool-menu nav [data-tool-id="${target}"]`)).toHaveAttribute('aria-current','page');
 }finally{await context.close();await rm(profile,{recursive:true,force:true});}
});
