import{test,expect}from'@playwright/test';
test('empty conversion input does not trigger content protection',async({page})=>{
 await page.goto('/convert.html#base64');await expect(page.locator('#convert-copy')).toBeHidden();await expect(page.locator('#convert-source .cm-content')).toBeEmpty();await page.locator('button.brand').click();await page.locator('#tool-menu-search').fill('calculator');await expect(page.locator('#tool-menu a[data-target="calculator.html"]')).not.toHaveAttribute('target','_blank');
});
test('selected task and conversion labels reach normal-text AA contrast',async({page})=>{
 for(const [url,selector]of [['/qr.html','#qr-task-generate'],['/convert.html#base64','#convert-tool-list [aria-current=page]']]){await page.goto(url);const ratio=await page.locator(selector).evaluate(el=>{const rgb=text=>{const context=document.createElement('canvas').getContext('2d');context.fillStyle=text;context.fillRect(0,0,1,1);return Array.from(context.getImageData(0,0,1,1).data).slice(0,3);},l=rgb=>rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0),s=getComputedStyle(el),a=l(rgb(s.color)),b=l(rgb(s.backgroundColor));return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);});expect(ratio).toBeGreaterThanOrEqual(4.5);}
});
