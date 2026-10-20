// Uses a temporary Chrome profile. Requires Playwright and a Chrome build supporting --load-extension.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {createHash}=require('node:crypto');
(async()=>{
 const extension=fs.realpathSync(path.resolve(process.env.LISTOOLS_EXTENSION_DIR || 'dist'));
 const id=process.env.LISTOOLS_EXTENSION_ID || createHash('sha256').update(extension).digest('hex').slice(0,32).replace(/[0-9a-f]/g,c=>String.fromCharCode(97+parseInt(c,16)));
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'listools-menu-extension-'));
 const context=await chromium.launchPersistentContext(profile,{headless:true,locale:'zh-CN',viewport:{width:1440,height:1000},...(process.env.LISTOOLS_CHROMIUM?{executablePath:process.env.LISTOOLS_CHROMIUM}:{}),args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`],ignoreDefaultArgs:['--disable-extensions']});
 const report={browser:context.browser().version(),checks:[],errors:[]};
 try{
  const base=`chrome-extension://${id}`,page=await context.newPage();
  page.on('pageerror',error=>report.errors.push(error.message));
  await page.goto(`${base}/index.html`);await page.waitForSelector('#language');
  report.manifest=await page.evaluate(()=>chrome.runtime.getManifest());assert.equal(report.manifest.action.default_popup,'popup.html');assert.equal(report.manifest.background,undefined);
  await page.locator('#source').fill('{"sample":"菜单保留工作区"}');
  const browserCDP=await context.browser().newBrowserCDPSession();
  async function openPopup(){
   await page.evaluate(()=>chrome.action.openPopup());
   const contexts=await page.evaluate(()=>chrome.runtime.getContexts({contextTypes:['POPUP']}));
   assert.equal(contexts.length,1);assert.equal(contexts[0].tabId,-1,'real Action Popup, not a browser tab');
   const target=(await browserCDP.send('Target.getTargets')).targetInfos.find(target=>target.url===`${base}/popup.html`);
   assert.ok(target);
   const {sessionId}=await browserCDP.send('Target.attachToTarget',{targetId:target.targetId,flatten:false});
   let sequence=0;const pending=new Map();
   const listener=event=>{if(event.sessionId!==sessionId)return;const response=JSON.parse(event.message);const callback=pending.get(response.id);if(callback){pending.delete(response.id);response.error?callback.reject(response.error):callback.resolve(response.result);}};
   browserCDP.on('Target.receivedMessageFromTarget',listener);
   async function send(method,params={}){
    const requestId=++sequence;
    const result=new Promise((resolve,reject)=>pending.set(requestId,{resolve,reject}));
    await browserCDP.send('Target.sendMessageToTarget',{sessionId,message:JSON.stringify({id:requestId,method,params})});return result;
   }
   async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text);return result.result.value;}
   for(let attempt=0;attempt<100;attempt++){if(await evaluate("!!document.querySelector('.tool-menu-list a')"))break;await new Promise(resolve=>setTimeout(resolve,20));}
   return {evaluate,send,dispose:()=>browserCDP.off('Target.receivedMessageFromTarget',listener)};
  }
  let popup=await openPopup();
  report.popup=await popup.evaluate(`({width:innerWidth,height:innerHeight,bodyWidth:document.body.getBoundingClientRect().width,menuHeight:document.querySelector('#popup-menu').getBoundingClientRect().height,footerBottom:document.querySelector('.tool-menu-footer').getBoundingClientRect().bottom,rows:document.querySelector('.tool-menu-list').children.length,scrollable:document.querySelector('.tool-menu-list').scrollHeight>document.querySelector('.tool-menu-list').clientHeight,resources:[]})`);
  assert.equal(report.popup.bodyWidth,360);assert.ok(report.popup.width>=360 && report.popup.width<=380);assert.ok(report.popup.height<=560);assert.ok(report.popup.scrollable);
  assert.ok(report.popup.menuHeight>=250 && report.popup.footerBottom<=report.popup.height,'popup menu and footer fit the actual Chrome popup viewport');
  const resourceTree=await popup.send('Page.getResourceTree');
  report.popup.resources=resourceTree.frameTree.resources.map(resource=>resource.url.split('/').pop());
  assert.ok(report.popup.resources.some(name=>name.startsWith('popup-')));
  for(const resource of report.popup.resources.filter(name=>name.endsWith('.js')))assert.ok(/^(popup|menu|en|zh-Hans)-/.test(resource),`unexpected eager module ${resource}`);
  const popupScreenshot=await popup.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('docs/navigation-popup.png',Buffer.from(popupScreenshot.data,'base64'));
  assert.equal(await popup.evaluate(`(async()=>{try{await fetch('https://speed.cloudflare.com/__down?bytes=0');return 'allowed';}catch{return 'blocked';}})()`),'blocked');
  await popup.evaluate(`document.querySelector('#tool-menu-search').value='crontab';document.querySelector('#tool-menu-search').dispatchEvent(new Event('input',{bubbles:true}));`);
  assert.equal(await popup.evaluate(`document.querySelector('.tool-menu-list a').getAttribute('href')`),'./cron.html');
  const openedPromise=context.waitForEvent('page');await popup.evaluate(`document.querySelector('.tool-menu-list a').click();true`);
  const opened=await openedPromise;await opened.waitForURL(`${base}/cron.html`);await opened.waitForSelector('#language');
  await page.waitForFunction(async()=>!(await chrome.runtime.getContexts({contextTypes:['POPUP']})).length);
  assert.equal(await page.locator('#source').inputValue(),'{"sample":"菜单保留工作区"}');popup.dispose();await opened.close();
  report.checks.push('Real Action Popup 360px ≤560px, offline/lightweight resources, launch new tab, close and preserve existing workspace');
  popup=await openPopup();assert.equal(await popup.evaluate(`document.querySelector('#tool-menu-search').value`),'');
  await popup.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await page.waitForFunction(async()=>!(await chrome.runtime.getContexts({contextTypes:['POPUP']})).length);popup.dispose();
  report.checks.push('Actual popup reopen resets search; native Escape closes');
  const {pages}=await import('../../src/tools/shared/navigation.js');
  for(const entry of pages.filter(item=>!item.file.includes('#'))){
   await page.goto(`${base}/${entry.file}`);await page.waitForSelector('#language');
   assert.equal(await page.locator('.sidebar').count(),0);
   if(entry.id!=='speedtest')assert.equal(await page.evaluate(async()=>{try{await fetch('https://speed.cloudflare.com/__down?bytes=0');return 'allowed';}catch{return 'blocked';}}),'blocked');
   await page.locator('.brand').click();assert.ok(await page.locator('#tool-menu').isVisible());await page.keyboard.press('Escape');
  }
  report.checks.push(`${pages.filter(item=>!item.file.includes('#')).length} real extension pages, shared menu and offline CSP`);
  await page.goto(`${base}/convert.html#base64`);await page.waitForSelector('#language');
  await page.locator('#convert-source .cm-content').fill('离线 🌍');await page.waitForFunction(()=>!document.querySelector('#convert-copy').disabled);
  assert.equal(await page.locator('#convert-result .cm-content').innerText(),Buffer.from('离线 🌍').toString('base64'));
  await page.locator('.brand').click();
  await page.waitForFunction(()=>document.querySelector('.brand').getAttribute('aria-expanded')==='true');
  await page.screenshot({path:'docs/navigation-menu.png'});
  report.checks.push('Real extension module Worker, Unicode Base64 and full-width screenshot');
  assert.deepEqual(report.errors,[]);
  if(process.env.LISTOOLS_REPORT)fs.writeFileSync(process.env.LISTOOLS_REPORT,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
 }finally{await context.close();fs.rmSync(profile,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
