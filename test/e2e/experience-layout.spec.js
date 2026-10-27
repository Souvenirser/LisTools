import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('listools-language','en'));});
test('text editor reading starts on the same line and its control area stays compact',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await page.goto('/text.html');const input=await page.locator('#text-input').boundingBox(),output=await page.locator('#text-result').boundingBox();expect(Math.abs(input.y-output.y)).toBeLessThanOrEqual(1);const control=await page.locator('.text-workspace-controls').boundingBox();expect(control.height).toBeLessThanOrEqual(70);await page.locator('#text-input').fill('one\ntwo\none');await page.locator('#text-run').click();await expect(page.locator('#text-result')).toHaveValue('one\ntwo');expect(Math.abs((await page.locator('#text-run').boundingBox()).y-control.y)).toBeLessThan(40);
});
test('date export controls are absent until that task has a valid result',async({page})=>{
 await page.goto('/dates.html');await expect(page.locator('#difference-copy')).toBeHidden();await page.locator('#difference-run').click();await expect(page.locator('#difference-copy')).toBeVisible();await expect(page.locator('#difference-copy')).toBeEnabled();
});
test('MD5 formats and exports appear with a valid digest and disappear on invalidation',async({page})=>{
 await page.goto('/convert.html#md5');await expect(page.locator('#md5-other-formats')).toBeHidden();await expect(page.locator('#md5-copy-all')).toBeHidden();await page.locator('#md5-auto').uncheck();await page.locator('#convert-source .cm-content').fill('abc');await page.locator('#md5-run').click();await expect(page.locator('#md5-value-hex32lower')).toHaveValue('900150983cd24fb0d6963f7d28e17f72');await expect(page.locator('#md5-other-formats')).toBeVisible();await expect(page.locator('#md5-copy-all')).toBeVisible();await page.locator('#convert-source .cm-content').fill('abcd');await expect(page.locator('#md5-copy-all')).toBeHidden();
});
test('mobile timer gives space to duration settings without shrinking touch targets',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/timer.html');expect((await page.locator('#timer-progress').boundingBox()).height).toBeLessThanOrEqual(222);await expect(page.locator('#timer-start')).toBeInViewport();expect((await page.locator('#timer-start').boundingBox()).height).toBeGreaterThanOrEqual(44);await page.locator('#timer-start').click();await expect(page.locator('#timer-pause')).toBeEnabled();
});
test('speed test empty state has no misleading progress bar and no network activity',async({page})=>{
 const requests=[];page.on('request',r=>{if(r.url().includes('speed.cloudflare.com'))requests.push(r.url());});await page.goto('/speedtest.html');await expect(page.locator('#speed-progress')).toBeHidden();await expect(page.locator('#speed-start')).toBeVisible();expect(requests).toEqual([]);
});
test('empty MD5 line and file modes expose exports only after a current batch completes',async({page})=>{
 await page.goto('/convert.html#md5');for(const mode of ['lines','files']){await page.locator('#md5-mode').selectOption(mode);for(const id of ['md5-copy-item','md5-csv','md5-json'])await expect(page.locator('#'+id)).toBeHidden();}await page.locator('#md5-files').setInputFiles({name:'queued.txt',mimeType:'text/plain',buffer:Buffer.from('abc')});await expect(page.locator('#md5-file-count')).toContainText('1');await expect(page.locator('#md5-csv')).toBeHidden();await page.locator('#md5-run').click();await expect(page.locator('[data-file-digest]')).toHaveValue('900150983cd24fb0d6963f7d28e17f72');await expect(page.locator('#md5-csv')).toBeVisible();await expect(page.locator('#md5-csv')).toBeEnabled();
});
