// Run against a dev/preview server with NODE_PATH pointing to an installed Playwright.
const { chromium }=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.LISTOOLS_CHROMIUM?{executablePath:process.env.LISTOOLS_CHROMIUM}:{})});
  const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'zh-CN'});
  const page=await context.newPage();
  const base=process.env.LISTOOLS_BASE_URL || 'http://127.0.0.1:5192';
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  try {
    await page.goto(`${base}/index.html`);await page.waitForSelector('#language');
    assert.equal(await page.locator('button.brand').count(),1,'brand opens a menu');
    assert.equal(await page.locator('.sidebar').count(),0,'workspace has no fixed sidebar');
    await page.locator('#source').fill('{"sample":"菜单不改变输入"}');
    await page.locator('.brand').click();
    await page.locator('#tool-menu-search').fill('base64url');
    assert.equal(await page.locator('.tool-menu-list a').first().getAttribute('href'),'./convert.html#base64url');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#source').inputValue(),'{"sample":"菜单不改变输入"}');
    assert.ok(await page.locator('.brand').evaluate(element=>document.activeElement===element));
    await page.locator('.brand').click();
    assert.equal(await page.locator('#tool-menu-search').inputValue(),'');
    await page.locator('#tool-menu-search').fill('temporary-query');
    await page.evaluate(()=>{const menu=document.querySelector('#tool-menu');menu.hidePopover();menu.showPopover();});
    assert.equal(await page.locator('#tool-menu-search').inputValue(),'','closing resets search before a rapid reopen');
    await page.locator('#tool-menu-search').fill('crontab');
    await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
    await page.waitForURL('**/cron.html');
    await page.locator('.brand').click();
    await page.locator('#tool-menu-search').fill('base64');
    await page.locator('.tool-menu-list a').first().click();
    await page.waitForURL('**/convert.html#base64');
    await page.waitForSelector('#convert-source .cm-content');
    assert.equal(await page.locator('.convert-catalog').count(),0);
    await page.locator('#convert-source .cm-content').fill('菜单与 Emoji 🌍');
    await page.waitForFunction(()=>!document.querySelector('#convert-copy').disabled);
    const result=await page.locator('#convert-result .cm-content').innerText();
    await page.locator('.brand').click();await page.locator('#tool-menu-search').fill('base64');
    await page.locator('.tool-menu-list a[href="./convert.html#base64"]').click();
    assert.equal(await page.locator('#convert-result .cm-content').innerText(),result,'current tool preserves result');
    assert.ok(await page.locator('#convert-copy').isEnabled());
    await page.locator('.brand').click();await page.locator('#tool-menu-search').fill('hex');
    await page.locator('.tool-menu-list a[href="./convert.html#hex"]').click();
    await page.waitForURL('**/convert.html#hex');
    assert.equal(await page.locator('#convert-source .cm-content').innerText(),'菜单与 Emoji 🌍');
    await page.waitForFunction(()=>!document.querySelector('#convert-copy').disabled);
    assert.notEqual(await page.locator('#convert-result .cm-content').innerText(),result);
    await page.locator('.brand').click();await page.locator('#tool-menu-search').fill('crontab');
    const newTabPromise=context.waitForEvent('page');
    await page.locator('.tool-menu-list a').click({modifiers:[process.platform==='darwin'?'Meta':'Control']});
    const newTab=await newTabPromise;await newTab.waitForURL('**/cron.html');await newTab.close();
    assert.ok(page.url().endsWith('convert.html#hex'),'modifier click preserves the current workspace');
    await page.keyboard.press('Escape');
    await page.locator('.brand').click();
    await page.locator('#tool-menu-search').dispatchEvent('compositionstart');
    await page.locator('#tool-menu-search').fill('base64');await page.keyboard.press('ArrowDown');
    assert.ok(await page.locator('#tool-menu-search').evaluate(element=>document.activeElement===element),'IME composition keeps focus');
    await page.locator('#tool-menu-search').dispatchEvent('compositionend');await page.keyboard.press('Escape');
    const {pages}=await import('../../src/tools/shared/navigation.js');
    const entries=pages.filter(item=>!item.file.includes('#'));
    for(const entry of process.env.LISTOOLS_ORIGINAL_PAGES?entries.slice(0,8):entries){
      await page.goto(`${base}/${entry.file}`);await page.waitForSelector('#language');
      assert.equal(await page.locator('.sidebar').count(),0,entry.file);
      await page.locator('.brand').click();
      for(const target of pages.filter(item=>item.id!=='convert'))assert.ok(await page.locator(`.tool-menu-list a[href="./${target.file}"]`).count()>0);
      await page.keyboard.press('Escape');
    }
    await page.goto(`${base}/convert.html#md5`);await page.waitForSelector('#language');
    await page.locator('#convert-source .cm-content').fill('abc');
    await page.waitForFunction(()=>document.querySelector('#md5-values input')?.value==='900150983cd24fb0d6963f7d28e17f72');
    await page.locator('.brand').click();await page.locator('#tool-menu-search').fill('md5');
    assert.equal(await page.locator('.tool-menu-list a[href="./convert.html#md5"]').count(),1);
    await page.locator('.tool-menu-list a[href="./convert.html#md5"]').click();
    assert.equal(await page.locator('#md5-values input').first().inputValue(),'900150983cd24fb0d6963f7d28e17f72');
    for(const width of [320,640,1440]){
      await page.setViewportSize({width,height:640});
      await page.locator('#language').selectOption('ar');
      await page.waitForFunction(()=>document.documentElement.dir==='rtl');
      await page.locator('.brand').click();
      const box=await page.locator('#tool-menu').boundingBox();
      assert.ok(box.x>=0 && box.x+box.width<=width+1 && box.y+box.height<=640,`RTL menu fits ${width}px viewport`);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no document horizontal overflow');
      await page.keyboard.press('Escape');
    }
    assert.deepEqual(errors,[]);
    console.log('Navigation browser checks passed: shared menu, keyboard, state preservation, conversion deep links and every page.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
