import{test,expect}from'@playwright/test';
test.beforeEach(async({page})=>page.addInitScript(()=>localStorage.setItem('listools-language','zh-Hans')));
for(const width of[1440,1366,390])for(const id of['convert','regex'])test(`${id} exposes useful reading space at ${width}`,async({page})=>{
 const height=width===1366?768:width===390?844:900;await page.setViewportSize({width,height});await page.goto('/'+id+'.html');const selector=id==='convert'?'#convert-source .cm-scroller':'#regex-source .cm-scroller';await page.locator(selector).waitFor();const box=await page.locator(selector).boundingBox();expect(box.height).toBeGreaterThanOrEqual(width===390?240:320);expect(height-box.y).toBeGreaterThanOrEqual(width===390?120:320);
});
test('conversion offers cancellation only while running and exports only valid output',async({page})=>{
 await page.goto('/convert.html');await expect(page.locator('#convert-cancel')).toBeHidden();for(const id of['convert-copy','convert-download','result-to-input'])await expect(page.locator('#'+id)).toBeHidden();await page.locator('#convert-source .cm-content').fill('Hello');await expect(page.locator('#convert-copy')).toBeVisible();await expect(page.locator('#convert-copy')).toBeEnabled();await expect(page.locator('#convert-cancel')).toBeHidden();
});
test('standard calculator keeps the full keyboard visible and stable on mobile',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/calculator.html');const button=page.locator('#calculate');expect((await button.boundingBox()).y+(await button.boundingBox()).height).toBeLessThanOrEqual(844);const before=(await page.locator('#keypad').boundingBox()).y;await page.locator('#expression').fill('1+2');await button.click();await expect(page.locator('#result')).toHaveText('3');expect(Math.abs((await page.locator('#keypad').boundingBox()).y-before)).toBeLessThanOrEqual(1);await page.locator('#expression').fill('sqrt(-1)');await button.click();await expect(page.locator('#tool-status')).not.toBeEmpty();expect(Math.abs((await page.locator('#keypad').boundingBox()).y-before)).toBeLessThanOrEqual(1);
});
for(const[width,height]of[[1440,900],[1366,768],[390,844]])test(`timer displays its time and main action together at ${width}`,async({page})=>{
 await page.setViewportSize({width,height});await page.goto('/timer.html');for(const id of['timer-display','timer-start'])await expect(page.locator('#'+id)).toBeInViewport({ratio:1});
});
test('money shows the standard amount next to the main uppercase result',async({page})=>{
 await page.goto('/money.html');await page.locator('#money-input').fill('12345.678');await expect(page.locator('#money-rounded')).toBeVisible();await expect(page.locator('#money-rounded')).toHaveText('12345.68');const result=await page.locator('#money-simplified').boundingBox(),input=await page.locator('#money-input').boundingBox();expect(Math.abs(result.y-input.y)).toBeLessThan(200);
});
test('mobile unit conversion exposes its main equation without scrolling past settings',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/units.html');await expect(page.locator('#unit-primary')).not.toBeEmpty();await expect(page.locator('#unit-primary')).toBeInViewport({ratio:1});
});
for(const[id,selector]of[['regex','#regex-copy'],['text','#text-copy'],['draw','#draw-copy'],['timestamp','[data-copy-all=timestamp]']])test(`${id} hides export actions before a valid result exists`,async({page})=>{await page.goto('/'+id+'.html');await expect(page.locator(selector)).toBeHidden({timeout:1000});});
