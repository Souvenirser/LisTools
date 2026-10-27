import {test,expect} from '@playwright/test';

for(const theme of ['light','dark'])for(const [width,height]of [[1366,768],[390,844]])test(`long password row actions stay above values and preserve private row controls — ${theme} ${width}`,async({page,context,browserName})=>{
  if(browserName!=='firefox')await context.grantPermissions(browserName==='webkit'?['clipboard-read']:['clipboard-read','clipboard-write']);
  await page.setViewportSize({width,height});await page.addInitScript(theme=>{localStorage.setItem('listools-language','en');localStorage.setItem('listools-preferences-v1',JSON.stringify({theme}));},theme);
  await page.goto('/password.html');await page.locator('#password-batch').fill('3');
  for(const length of [92,256]){
    await page.locator('#password-length').fill(String(length));await page.locator('#password-generate').click();const rows=page.locator('.password-result'),inputs=rows.locator('input'),eyes=rows.locator('[data-password-visible]');await expect(rows).toHaveCount(3);
    expect(await inputs.evaluateAll(nodes=>nodes.map(node=>node.type))).toEqual(['password','password','password']);const values=await inputs.evaluateAll(nodes=>nodes.map(node=>node.value));expect(values.map(value=>value.length)).toEqual([length,length,length]);
    for(const row of await rows.all()){
      const controls=await row.evaluate(row=>{const input=row.querySelector('input').getBoundingClientRect();return [...row.querySelectorAll('button')].map(button=>{const rect=button.getBoundingClientRect();return {bottom:rect.bottom,inputTop:input.top,left:rect.left,right:rect.right,inputLeft:input.left,inputRight:input.right};});});
      for(const control of controls){expect(control.bottom,`toolbar must be above ${length}-character input`).toBeLessThanOrEqual(control.inputTop+1);expect(control.left).toBeGreaterThanOrEqual(control.inputLeft-1);expect(control.right).toBeLessThanOrEqual(control.inputRight+1);}
    }
    await expect(eyes.nth(0)).toHaveText('Show results');if(browserName==='webkit')await eyes.nth(0).press('Enter');else await eyes.nth(0).click();await expect(eyes.nth(0)).toBeFocused();await expect(eyes.nth(0)).toHaveText('Hide results');expect(await inputs.evaluateAll(nodes=>nodes.map(node=>node.type))).toEqual(['text','password','password']);expect(await inputs.nth(0).evaluate(input=>input.scrollWidth>input.clientWidth)).toBe(true);
    await page.keyboard.press('Enter');await expect(eyes.nth(0)).toBeFocused();expect(await inputs.evaluateAll(nodes=>nodes.map(node=>node.type))).toEqual(['password','password','password']);
    await page.locator('#password-show').click();expect(await inputs.evaluateAll(nodes=>nodes.map(node=>node.type))).toEqual(['text','text','text']);if(browserName==='webkit')await eyes.nth(1).press('Enter');else await eyes.nth(1).click();await expect(eyes.nth(1)).toBeFocused();expect(await inputs.evaluateAll(nodes=>nodes.map(node=>node.type))).toEqual(['text','password','text']);await page.keyboard.press('Enter');await expect(eyes.nth(1)).toBeFocused();expect(await inputs.evaluateAll(nodes=>nodes.map(node=>node.type))).toEqual(['text','text','text']);
    await page.locator('#password-show').click();await page.locator('#password-show').click();expect(await inputs.evaluateAll(nodes=>nodes.map(node=>node.type))).toEqual(['password','password','password']);
    if(browserName!=='firefox'){await rows.nth(2).locator('[data-password-copy]').click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(values[2]);await page.locator('#password-copy-all').click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(values.join('\n'));}
  }
  await page.goto('/timer.html');await page.goBack();await expect(page.locator('.password-result')).toHaveCount(0);
});
