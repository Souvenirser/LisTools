// Native extension + Document PiP acceptance in a fresh, disposable Chrome profile.
// LISTOOLS_EXTENSION_DIR points to the directory extracted from the candidate ZIP.
const {chromium}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {createHash}=require('node:crypto');
(async()=>{
 const extension=fs.realpathSync(path.resolve(process.env.LISTOOLS_EXTENSION_DIR||'dist'));
 const executablePath=process.env.LISTOOLS_CHROMIUM;
 const output=path.resolve(process.env.LISTOOLS_SALARY_REPORT||'.superpowers/sdd/salary-native');fs.mkdirSync(output,{recursive:true});
 const id=createHash('sha256').update(extension).digest('hex').slice(0,32).replace(/[0-9a-f]/g,c=>String.fromCharCode(97+parseInt(c,16)));
 const context=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'listools-salary-native-')),{headless:false,...executablePath?{executablePath}:{},locale:'en-US',timezoneId:'Asia/Shanghai',viewport:null,ignoreDefaultArgs:['--disable-extensions'],args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
 const report={browser:context.browser().version(),protocol:'chrome-extension:',checks:[],errors:[],externalRequests:[]};
 context.on('request',r=>{if(/^https?:/.test(r.url()))report.externalRequests.push(r.url());});
 context.on('page',p=>p.on('pageerror',e=>report.errors.push(e.message)));
 try{
  const page=await context.newPage(),base=`chrome-extension://${id}`;
  const time=new Date('2026-11-02T10:00:00+08:00');
  await page.clock.setFixedTime(time);
  await page.goto(base+'/index.html');await page.waitForSelector('html[data-ui-state="ready"]');
  await page.locator('button.brand').click();await page.locator('#tool-menu-search').fill('牛马激励');
  await page.locator('#tool-menu a[data-target="salary.html"]').click();
  await page.waitForURL(base+'/salary.html');
  await page.waitForSelector('html[data-ui-state="ready"]');
  assert.equal(await page.locator('iframe[data-workspace-active]').count(),0);
  report.checks.push('Main workbench menu opens the top-level salary dashboard');
  assert.equal(await page.locator('#salary-earned').textContent(),'—');
  await page.locator('#salary-amount').fill('16800');await page.locator('#salary-save').click();
  await page.waitForFunction(()=>document.querySelector('#salary-earned').textContent==='¥100.0000');
  await page.locator('#salary-bar-toggle').click();
  assert.equal(await page.locator('#salary-bar [data-salary-earned]').textContent(),'¥100.0000');
  const manifest=await page.evaluate(()=>chrome.runtime.getManifest());
  assert.ok(!manifest.permissions?.length&&!manifest.host_permissions?.length);
  const expectedBackground=process.env.LISTOOLS_EXPECT_STORE==='1'?{service_worker:'updates/store-worker.js',type:'module'}:undefined;
  assert.deepEqual(manifest.background,expectedBackground);
  assert.equal(await page.evaluate(()=>document.querySelector('meta[http-equiv="Content-Security-Policy"]').content),"connect-src 'none'");
  report.checks.push('Actual extension page loads, explicit save backfills and native page/footer values agree; no permissions/background added');
  const cdp=await context.browser().newBrowserCDPSession(),before=(await cdp.send('Target.getTargets')).targetInfos.map(t=>t.targetId);
  await page.locator('#salary-pip').click();
  await page.waitForFunction(()=>documentPictureInPicture.window?.document.querySelector('[data-salary-earned]')?.textContent==='¥100.0000');
  const target=(await cdp.send('Target.getTargets')).targetInfos.find(t=>!before.includes(t.targetId));assert.ok(target,'native PiP created a separate browser target');
  assert.equal(await page.locator('#salary-pip').textContent(),'Close desktop window');assert.equal(await page.locator('#salary-pip').getAttribute('aria-pressed'),'true');
  report.pip=await page.evaluate(()=>{const w=documentPictureInPicture.window;return {closed:w.closed,width:w.innerWidth,height:w.innerHeight,earned:w.document.querySelector('[data-salary-earned]').textContent,today:w.document.querySelector('[data-salary-today]').textContent,overflow:w.document.documentElement.scrollWidth>w.innerWidth};});
  assert.equal(report.pip.closed,false);assert.equal(report.pip.today,'¥100.0000');assert.equal(report.pip.overflow,false);
  report.pip.layout=await page.evaluate(()=>{const w=documentPictureInPicture.window,d=w.document,box=selector=>{const r=d.querySelector(selector).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};};return {scrollWidth:d.documentElement.scrollWidth,scrollHeight:d.documentElement.scrollHeight,width:w.innerWidth,height:w.innerHeight,close:box('[data-salary-close]'),mask:box('[data-salary-mask]'),earned:box('[data-salary-earned]'),today:box('.salary-mini-today'),state:box('[data-salary-state]')};});
  assert.ok(report.pip.layout.scrollHeight<=report.pip.layout.height,'all PiP content fits vertically');assert.ok(report.pip.layout.close.y<report.pip.layout.earned.y,'PiP controls sit above the amount');for(const key of ['close','mask','earned','today','state']){const box=report.pip.layout[key];assert.ok(box.x>=0&&box.right<=report.pip.width&&box.bottom<=report.pip.height,key+' fits inside native PiP');}
  await page.locator('#salary-mask').click();await page.waitForFunction(()=>documentPictureInPicture.window.document.querySelector('[data-salary-earned]').textContent==='¥••••');
  await page.evaluate(()=>documentPictureInPicture.window.document.querySelector('[data-salary-mask]').click());
  await page.waitForFunction(()=>document.querySelector('#salary-earned').textContent==='¥100.0000');
  await page.locator('#settings-open').click();await page.locator('#theme-preference').selectOption('dark');await page.locator('#settings-close').click();
  await page.waitForFunction(()=>documentPictureInPicture.window.document.documentElement.className===document.documentElement.className);
  report.checks.push('Native Document PiP displays matching month/today earnings, masking synchronizes both directions, source theme synchronizes');
  // Capture PiP through its real browser target, without emulating a second page.
  let {sessionId}=await cdp.send('Target.attachToTarget',{targetId:target.targetId,flatten:false});let sequence=0;const pending=new Map();
  cdp.on('Target.receivedMessageFromTarget',event=>{if(event.sessionId!==sessionId)return;const response=JSON.parse(event.message),entry=pending.get(response.id);if(entry){pending.delete(response.id);response.error?entry.reject(response.error):entry.resolve(response.result);}});
  async function send(method,params={}){const request=++sequence,result=new Promise((resolve,reject)=>pending.set(request,{resolve,reject}));await cdp.send('Target.sendMessageToTarget',{sessionId,message:JSON.stringify({id:request,method,params})});return result;}
  const image=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,'salary-pip.png'),Buffer.from(image.data,'base64'));
  // Resize through a trusted mouse click inside the real PiP window. This is test-only UI.
  await page.evaluate(()=>{const w=documentPictureInPicture.window,button=w.document.createElement('button');button.id='native-pip-resize';button.textContent='Resize test window';button.onclick=()=>{const dx=w.outerWidth-w.innerWidth,dy=w.outerHeight-w.innerHeight;w.resizeTo(320+dx,180+dy);button.remove();};w.document.body.append(button);button.focus();});
  const resizePoint=await page.evaluate(()=>{const r=documentPictureInPicture.window.document.querySelector('#native-pip-resize').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
  await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...resizePoint});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...resizePoint});
  report.resizeObserved=await page.evaluate(()=>{const w=documentPictureInPicture.window;return {width:w.innerWidth,height:w.innerHeight,outerWidth:w.outerWidth,outerHeight:w.outerHeight,buttonPresent:!!w.document.querySelector('#native-pip-resize')};});
  await page.waitForFunction(()=>documentPictureInPicture.window.innerWidth===320&&documentPictureInPicture.window.innerHeight===180,null,{timeout:5000});
  report.pip.small=await page.evaluate(()=>{const w=documentPictureInPicture.window,d=w.document;return {width:w.innerWidth,height:w.innerHeight,scrollWidth:d.documentElement.scrollWidth,scrollHeight:d.documentElement.scrollHeight,boxes:['[data-salary-earned]','.salary-mini-today','[data-salary-state]','[data-salary-mask]','[data-salary-close]'].map(selector=>{const r=d.querySelector(selector).getBoundingClientRect();return {selector,x:r.x,right:r.right,bottom:r.bottom};})};});
  assert.ok(report.pip.small.scrollWidth<=320&&report.pip.small.scrollHeight<=180,'resized PiP has no scrollbars');for(const box of report.pip.small.boxes)assert.ok(box.x>=0&&box.right<=320&&box.bottom<=180,box.selector+' remains fully visible');
  const smallImage=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,'salary-pip-small.png'),Buffer.from(smallImage.data,'base64'));report.checks.push('Native 360x230 and resized 320x180 PiP show all amounts, status and top-right controls without scrolling');
  await page.locator('main').evaluate(node=>node.scrollTop=0);await page.screenshot({path:path.join(output,'salary-dashboard.png')});
  await context.setOffline(true);const other=await context.newPage();
  await other.clock.setFixedTime(time);await other.goto(base+'/index.html');await other.waitForSelector('#salary-bar');
  const input=other.frameLocator('iframe[data-workspace-active]').locator('#source .cm-content');
  await input.fill('{"synthetic":"keep"}');
  await page.locator('#salary-amount').fill('33600');await page.locator('#salary-save').click();await page.locator('#salary-confirm-apply').click();
  await other.waitForFunction(()=>document.querySelector('#salary-bar [data-salary-earned]').textContent==='¥200.0000');
  assert.equal(await input.textContent(),'{"synthetic":"keep"}');
  assert.equal(await page.evaluate(()=>documentPictureInPicture.window.document.querySelector('[data-salary-earned]').textContent),'¥200.0000');
  const feedback=await page.locator('.page-feedback-link,.feedback-link').first().getAttribute('href');assert.ok(!feedback.includes('33600')&&!feedback.includes('16800'));
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('listools-salary-v1')));assert.equal(saved.earned,undefined);assert.equal(saved.history,undefined);
  report.checks.push('Offline extension use, cross-page saved configuration sync, original JSON input preservation, config-only storage and feedback metadata boundary');
  await page.bringToFront();
  await page.locator('button.brand').click();await page.locator('#tool-menu-search').fill('Text');
  const opened=context.waitForEvent('page');
  await page.locator('#tool-menu a[data-target="text.html"]').click();
  const extra=await opened;await extra.waitForURL(base+'/text.html');
  assert.equal(page.url(),base+'/salary.html');
  assert.equal(await page.evaluate(()=>!!documentPictureInPicture.window),true);
  await extra.close();await page.bringToFront();
  report.checks.push('Opening a tool keeps the salary dashboard and active desktop window');
  for(let cycle=0;cycle<3;cycle++){
   await page.locator('#salary-pip').click();await page.waitForFunction(()=>!documentPictureInPicture.window);assert.equal(await page.locator('#salary-pip').textContent(),'Open desktop window');assert.equal(await page.locator('#salary-pip').getAttribute('aria-pressed'),'false');
   await page.locator('#salary-pip').click();await page.waitForFunction(()=>!!documentPictureInPicture.window);assert.equal(await page.locator('#salary-pip').textContent(),'Close desktop window');
  }
  await page.evaluate(()=>documentPictureInPicture.window.document.querySelector('[data-salary-close]').click());
  await page.waitForFunction(()=>!documentPictureInPicture.window);
  await page.waitForFunction(()=>document.querySelector('#salary-pip').textContent==='Open desktop window');
  report.checks.push('Main button repeatedly opens/closes native PiP; closing within PiP restores the main button');
  await page.evaluate(()=>localStorage.setItem('listools-language','zh-Hans'));await page.reload();await page.waitForSelector('html[data-ui-state=ready][lang=zh-Hans]');
  await page.locator('#salary-pip').click();await page.waitForFunction(()=>!!documentPictureInPicture.window);assert.equal(await page.locator('#salary-pip').textContent(),'关闭桌面小窗');
  report.pip.chinese=await page.evaluate(()=>{const w=documentPictureInPicture.window,d=w.document;return {width:w.innerWidth,height:w.innerHeight,scrollWidth:d.documentElement.scrollWidth,scrollHeight:d.documentElement.scrollHeight,boxes:['[data-salary-earned]','.salary-mini-today','[data-salary-state]','[data-salary-mask]','[data-salary-close]'].map(selector=>{const r=d.querySelector(selector).getBoundingClientRect();return {selector,x:r.x,right:r.right,bottom:r.bottom};})};});
  assert.ok(report.pip.chinese.scrollWidth<=report.pip.chinese.width&&report.pip.chinese.scrollHeight<=report.pip.chinese.height);for(const box of report.pip.chinese.boxes)assert.ok(box.x>=0&&box.right<=report.pip.chinese.width&&box.bottom<=report.pip.chinese.height,box.selector+' fits in Chinese PiP');
  const chineseTarget=(await cdp.send('Target.getTargets')).targetInfos.find(t=>!before.includes(t.targetId)&&t.url!==base+'/index.html');assert.ok(chineseTarget);({sessionId}=await cdp.send('Target.attachToTarget',{targetId:chineseTarget.targetId,flatten:false}));const chineseImage=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,'salary-pip-chinese.png'),Buffer.from(chineseImage.data,'base64'));
  await page.locator('#salary-pip').click();await page.waitForFunction(()=>!documentPictureInPicture.window);assert.equal(await page.locator('#salary-pip').textContent(),'打开桌面小窗');report.checks.push('Chinese open/close labels and complete compact PiP layout pass');
  await page.locator('#salary-pip').click();await page.waitForFunction(()=>!!documentPictureInPicture.window);
  const next=(await cdp.send('Target.getTargets')).targetInfos.find(t=>!before.includes(t.targetId)&&t.targetId!==target.targetId&&t.url!==base+'/index.html');assert.ok(next);
  await page.close();
  for(let i=0;i<100;i++){if(!(await cdp.send('Target.getTargets')).targetInfos.some(t=>t.targetId===next.targetId))break;await new Promise(r=>setTimeout(r,20));}
  assert.ok(!(await cdp.send('Target.getTargets')).targetInfos.some(t=>t.targetId===next.targetId),'closing the source tab closes native PiP');
  report.checks.push('Native close/reopen succeeds; closing the source extension page destroys its PiP target');
  await other.goto(base+'/tax.html');
  const tax=other.frameLocator('iframe[data-workspace-active]');
  const months=tax.locator('#tax-bonus-months'),amount=tax.locator('#tax-bonus');
  assert.equal(await months.inputValue(),'0');
  await tax.locator('#tax-salary').fill('20000');
  await tax.locator('#tax-bonus-months-toggle').click();
  const options=tax.locator('#tax-bonus-month-options button');
  await options.last().waitFor({state:'visible'});
  assert.deepEqual(await options.allTextContents(),['0','1','2','3','4','5','6']);
  await options.last().click();assert.equal(await amount.inputValue(),'120000.00');
  await months.fill('1.3');assert.equal(await amount.inputValue(),'26000.00');
  report.checks.push('Tax bonus offers all 0–6 month presets and accepts fractional months in the same extension');
  assert.deepEqual(report.externalRequests,[]);assert.deepEqual(report.errors,[]);report.pass=true;
 }catch(error){report.failure=error.stack;throw error;}finally{fs.writeFileSync(path.join(output,'salary-native.json'),JSON.stringify(report,null,2)+'\n');await context.close();console.log(JSON.stringify(report));}
})().catch(error=>{console.error(error);process.exitCode=1;});
