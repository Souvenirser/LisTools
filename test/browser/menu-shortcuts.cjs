const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.LISTOOLS_CHROMIUM?{executablePath:process.env.LISTOOLS_CHROMIUM}:{})});
 try{
  const page=await browser.newPage();
  await page.addInitScript(()=>{const NativeWorker=window.Worker;window.startedWorkers=0;window.Worker=class extends NativeWorker{constructor(...args){super(...args);window.startedWorkers++;}};});
  const base=process.env.LISTOOLS_BASE_URL || 'http://127.0.0.1:5192';
  for(const file of ['convert.html#base64','index.html','diff.html']){
   await page.goto(`${base}/${file}`);await page.waitForSelector('#language');
   if(file.startsWith('convert')){await page.locator('#convert-auto').uncheck();await page.locator('#convert-source .cm-content').fill('abc');}
   else if(file==='index.html'){await page.locator('#auto-format').uncheck();await page.locator('#source').fill('{"sample":1}');}
   else{await page.locator('#left-source .cm-content').fill('{"sample":1}');await page.locator('#right-source .cm-content').fill('{"sample":2}');}
   const before=await page.evaluate(()=>window.startedWorkers);
   await page.locator('.brand').click();await page.locator('#tool-menu-search').fill('no-such-tool');
   for(const modifier of ['Control','Meta']){
    await page.keyboard.press(`${modifier}+Enter`);
    assert.equal(await page.evaluate(()=>window.startedWorkers),before,`${file}: menu shortcut must not start a real Worker`);
   }
   await page.keyboard.press('Escape');await page.keyboard.press('Control+Enter');
   assert.ok(await page.evaluate(()=>window.startedWorkers)>before,`${file}: workspace shortcut still runs`);
  }
  console.log('Menu shortcuts preserve task state on JSON, diff and conversion pages.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
