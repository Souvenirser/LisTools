import {chooseTask} from './task-helpers.js';
import {test,expect} from '@playwright/test';
import {selectLanguage} from './language-helpers.js';
async function open(page,name){await page.goto(`/${name}.html`);await selectLanguage(page,'en');}
 test.skip(({browserName})=>browserName!=='chromium','BFCache flags are Chromium-specific');
 test.use({launchOptions:{executablePath:process.env.LISTOOLS_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',ignoreDefaultArgs:['--disable-back-forward-cache']}});
 test('two restorations preserve image URLs and allow editing crop',async({page,browserName})=>{
  test.skip(browserName!=='chromium','BFCache configuration is Chromium-specific');
  await page.addInitScript(()=>addEventListener('pageshow',event=>window.wasCached=event.persisted));await open(page,'images');await page.locator('#images-example').click();await expect(page.locator('#images-results')).toBeVisible();await chooseTask(page,'images','crop');
  for(let i=0;i<2;i++){
   await page.goto('/text.html');await page.goBack({waitUntil:'commit',timeout:5000}).catch(error=>{if(!page.url().includes('/images.html'))throw error;});await page.waitForFunction(()=>window.wasCached===true);await page.locator('#images-rotate').click();await page.locator('#images-apply').click();await expect(page.locator('#tool-status')).toContainText('Crop saved');expect(await page.locator('#images-crop-container>img').evaluate(img=>img.naturalWidth)).toBeGreaterThan(0);
  }
 });
test('review BFCache restores an unfinished Cropper initialization',async({page})=>{
 await page.addInitScript(()=>addEventListener('pageshow',event=>window.wasCached=event.persisted));await open(page,'images');await page.locator('#images-example').click();await expect(page.locator('#images-results')).toBeVisible();await page.evaluate(()=>{const proto=customElements.get('cropper-image').prototype,original=proto.$ready,releases=[];let blocked=true;window.releaseReady=()=>{blocked=false;for(const release of releases)release();};proto.$ready=function(...args){const pending=original.apply(this,args);return args.length||!blocked?pending:pending.then(value=>new Promise(resolve=>{releases.push(()=>resolve(value));window.readyWaiters=releases.length;}));};});await chooseTask(page,'images','crop');await page.waitForFunction(()=>window.readyWaiters>=2);await page.goto('/text.html');await page.goBack({waitUntil:'commit',timeout:5000}).catch(error=>{if(!page.url().includes('/images.html'))throw error;});await page.waitForFunction(()=>window.wasCached);await page.evaluate(()=>window.releaseReady());await page.locator('#images-run').click();await expect(page.locator('#images-results')).toBeVisible();await page.locator('cropper-selection').evaluate(node=>node.dispatchEvent(new Event('change')));await expect(page.locator('#images-results')).toBeHidden();
});
