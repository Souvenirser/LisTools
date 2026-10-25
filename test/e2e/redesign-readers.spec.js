import{test,expect}from'@playwright/test';
import{selectLanguage}from'./language-helpers.js';

for(const width of[320,768])test(`text readers remain inside their root and ahead of the footer at${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto('/text.html');
 const input=Array.from({length:120},(_,index)=>`line-${index}`).concat('FINAL-SENTINEL').join('\n');
 await page.locator('#text-input').fill(input);await page.locator('#text-run').click();await expect(page.locator('#text-result')).toHaveValue(input);await page.locator('#text-result').scrollIntoViewIfNeeded();
 await expect.poll(()=>page.evaluate(()=>{const root=document.querySelector('#tool-root').getBoundingClientRect(),workspace=document.querySelector('.editor-workspace').getBoundingClientRect(),footer=document.querySelector('.workbench-footer').getBoundingClientRect();return{rootContainsWorkspace:root.bottom>=workspace.bottom-1,footerAfterWorkspace:footer.top>=workspace.bottom-1};})).toEqual({rootContainsWorkspace:true,footerAfterWorkspace:true});
 for(const id of['text-input','text-result']){
  await page.locator('#'+id).scrollIntoViewIfNeeded();const scrolled=await page.locator('#'+id).evaluate(node=>{node.scrollTop=node.scrollHeight;return{scrollTop:node.scrollTop,bottomGap:node.scrollHeight-node.clientHeight-node.scrollTop,ending:node.value.split('\n').at(-1)};});
  expect(scrolled.scrollTop).toBeGreaterThan(0);expect(scrolled.bottomGap).toBeLessThanOrEqual(1);expect(scrolled.ending).toBe('FINAL-SENTINEL');
 }
});

test('German regex input can expose at least120px above the fixed action area at320px',async({page})=>{
 await page.setViewportSize({width:320,height:844});await page.goto('/regex.html');await selectLanguage(page,'de');
 const input=page.locator('#regex-source');await input.scrollIntoViewIfNeeded();await expect.poll(()=>input.evaluate(node=>{const box=node.getBoundingClientRect(),bar=document.querySelector('.workspace-action-fixed').getBoundingClientRect(),header=document.querySelector('.app-header').getBoundingClientRect();return Math.min(box.bottom,bar.top)-Math.max(box.top,header.bottom);})).toBeGreaterThanOrEqual(120);
 await page.locator('#regex-source .cm-content').fill('ORDER-1024');await expect(page.locator('#regex-source .cm-content')).toContainText('ORDER-1024');
});

for(const [route,width]of[['convert',320],['convert',768],['md5',320],['md5',768],['diff',320],['diff',768]])test(`${route} result scrolling keeps the footer clear of both readers at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto(route==='diff'?'/diff.html':`/convert.html#${route==='md5'?'md5':'base64'}`);
 if(route==='diff'){
  await page.locator('#left-source .cm-content').fill('{"count":1}');await page.locator('#right-source .cm-content').fill('{"count":2}');await page.locator('#compare').click();await expect(page.locator('#diff-view')).toBeVisible();await page.locator('#diff-view').scrollIntoViewIfNeeded();
 }else{
  await page.locator('#convert-source .cm-content').fill('LisTools');await page.locator(route==='md5'?'#md5-run':'#convert-run').click();
  if(route==='md5'){await expect(page.locator('#md5-value-hex32lower')).toHaveValue(/^[a-f0-9]{32}$/);await page.locator('#md5-values').scrollIntoViewIfNeeded();}else{await expect(page.locator('#convert-copy')).toBeEnabled();await page.locator('#convert-result').scrollIntoViewIfNeeded();}
 }
 await expect.poll(()=>page.evaluate(()=>{const root=document.querySelector('.convert-layout,.diff-result').getBoundingClientRect(),readers=[...document.querySelectorAll('main textarea,main .cm-editor')].filter(node=>node.checkVisibility());return readers.every(node=>node.getBoundingClientRect().bottom<=root.bottom+1);})).toBe(true);
 await expect.poll(()=>page.evaluate(()=>{const footer=document.querySelector('.workbench-footer').getBoundingClientRect();return[...document.querySelectorAll('main textarea,main .cm-editor')].filter(node=>node.checkVisibility()).filter(node=>{const box=node.getBoundingClientRect();return box.left<footer.right-1&&box.right>footer.left+1&&box.top<footer.bottom-1&&box.bottom>footer.top+1;}).map(node=>node.id||node.className);})).toEqual([]);
});
