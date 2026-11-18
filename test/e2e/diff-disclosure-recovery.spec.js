import {test,expect} from '@playwright/test';

const tool=page=>page.frameLocator('iframe[data-workspace-active]');
async function open(page,{width=1440,theme='dark',motion='no-preference'}={}){
 await page.setViewportSize({width,height:900});
 await page.emulateMedia({reducedMotion:motion});
 await page.addInitScript(theme=>{localStorage.setItem('listools-language','zh-Hans');localStorage.setItem('listools-preferences-v1',JSON.stringify({theme}));},theme);
 await page.goto('/diff.html');await expect(tool(page).locator('#left-source .cm-content')).toBeVisible();
}

for(const width of [390,1440])for(const theme of ['light','dark'])test(`empty input can be collapsed and reopened repeatedly — ${width} ${theme}`,async({page})=>{
 await open(page,{width,theme});const f=tool(page),summary=f.locator('#inputs>summary');
 await f.locator('#left-source .cm-content').evaluate(node=>window.savedDiffInput=node);
 for(let i=0;i<3;i++){
  await summary.click();await expect(f.locator('#inputs')).not.toHaveAttribute('open');await expect(summary).toBeVisible({timeout:1500});await expect(f.locator('#left-source .cm-content')).toBeHidden();
  await summary.focus();await page.keyboard.press('Enter');await expect(f.locator('#inputs')).toHaveAttribute('open');
  await expect(f.locator('#left-source .cm-content')).toBeVisible();
 }
 expect(await f.locator('#left-source .cm-content').evaluate(node=>node===window.savedDiffInput)).toBe(true);
});

test('error recovery keeps disclosure, error location and a subsequent valid comparison reachable',async({page})=>{
 await open(page,{motion:'reduce'});const f=tool(page),summary=f.locator('#inputs>summary');
 await f.locator('#compare').click();await expect(f.locator('body')).toHaveAttribute('data-status','error');
 await summary.click();await expect(summary).toBeVisible({timeout:1500});
 await f.locator('#diff-error-panel button').first().click();await expect(f.locator('#inputs')).toHaveAttribute('open');await expect(f.locator('#left-source .cm-content')).toBeFocused();
 await f.locator('#left-source .cm-content').fill('{"keep":"世界","n":1}');await f.locator('#right-source .cm-content').fill('{"keep":"世界","n":2}');
 await f.locator('#compare').click();await expect(f.locator('body')).toHaveAttribute('data-status','ready');await expect(f.locator('#diff-view')).toBeVisible();
 for(let i=0;i<3;i++){
  await f.locator('#diff-edit-inputs').click();await expect(summary).toBeVisible();await expect(f.locator('#diff-view')).toBeHidden();
  await expect(f.locator('#left-source .cm-content')).toContainText('世界');await summary.click();
  await expect(f.locator('#diff-edit-inputs')).toBeVisible();await expect(f.locator('#diff-view')).toBeVisible();
 }
});

test('content created only in an initially empty comparison is protected on navigation',async({page,context})=>{
 await open(page);const f=tool(page);
 await f.locator('#diff-mode').selectOption('text');await f.locator('#compare').click();await expect(f.locator('body')).toHaveAttribute('data-status','ready');
 await f.locator('#diff-view .cm-content').first().fill('只有结果中写入的草稿 🌏');await expect(f.locator('body')).toHaveAttribute('data-status','dirty');
 expect(await f.locator('body').evaluate(()=>window.LisToolsTool.hasContent())).toBe(true);
 await page.locator('button.brand').click();await page.locator('#tool-menu-search').fill('单位换算');
 const opened=context.waitForEvent('page');await page.locator('#tool-menu nav a[data-tool-id=units]').click();const popup=await opened;await expect(popup).toHaveURL(/units\.html$/);
 await expect(f.locator('#diff-view .cm-content').first()).toContainText('只有结果中写入的草稿 🌏');await popup.close();
});
