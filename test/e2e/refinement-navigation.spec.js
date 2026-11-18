import{test,expect}from'@playwright/test';
async function seed(page){await page.setViewportSize({width:1440,height:900});await page.addInitScript(()=>{localStorage.setItem('listools-language','zh-Hans');localStorage.setItem('listools-menu-expanded-v1',JSON.stringify(['daily','files','developer','network']));if(!localStorage.getItem('listools-preferences-v1'))localStorage.setItem('listools-preferences-v1',JSON.stringify({favorites:['json','diff','qr','text'],recent:['timer','draw','money','units','dates']}));});await page.goto('/timer.html');}

test('expanded dropdown shows complete Chinese tool names on a single line',async({page})=>{
 await seed(page);await page.locator('button.brand').click();for(const id of['qr','json','draw','timer']){const label=page.locator(`#tool-menu nav a[data-tool-id="${id}"] .tool-menu-name`);expect(await label.evaluate(n=>({height:n.getBoundingClientRect().height,line:parseFloat(getComputedStyle(n).lineHeight),fits:n.scrollWidth<=n.clientWidth+1}))).toMatchObject({fits:true});const size=await label.evaluate(n=>({height:n.getBoundingClientRect().height,line:parseFloat(getComputedStyle(n).lineHeight)}));expect(size.height).toBeLessThanOrEqual(size.line+1);}
});

test('pinning a lower tool keeps its original row and focus at the same place',async({page})=>{
 await seed(page);await page.locator('button.brand').click();const pin=page.locator('#tool-menu nav [data-favorite="pdf"]');await pin.evaluate(n=>n.scrollIntoView({block:'center',behavior:'instant'}));const before=(await pin.boundingBox()).y;await pin.click();await expect(pin).toBeFocused();expect(Math.abs((await pin.boundingBox()).y-before)).toBeLessThanOrEqual(1);await expect(page.locator('.tool-menu-saved a[data-tool-id="pdf"]')).toHaveCount(1);
});

test('switching tools restores the dropdown browsing position when reopened',async({page})=>{
 await seed(page);await page.locator('button.brand').click();const link=page.locator('#tool-menu nav a[data-tool-id="pdf"]');await link.evaluate(n=>n.scrollIntoView({block:'center',behavior:'instant'}));const before=(await link.boundingBox()).y;await link.click();await page.waitForURL('**/pdf.html');await page.locator('button.brand').click();await expect.poll(()=>page.locator('#tool-menu .tool-menu-scroll').evaluate(n=>n.scrollTop)).toBeGreaterThan(100);expect(Math.abs((await page.locator('#tool-menu nav a[data-tool-id="pdf"]').boundingBox()).y-before)).toBeLessThanOrEqual(2);
});

test('dropdown search and sorting use the existing visible settings and search entries',async({page})=>{
 await seed(page);await expect(page.locator('#tool-menu-search')).toBeHidden();await expect(page.locator('#menu-edit')).toBeHidden();await page.locator('#global-search-open').click();await expect(page.locator('#tool-menu-search')).toBeFocused();await page.keyboard.press('Escape');await page.locator('#settings-open').click();await page.locator('#settings-sort').click();await expect(page.locator('#menu-save')).toBeVisible();await page.locator('#menu-cancel').click();await expect(page.locator('#settings-open')).toBeFocused();
});

test('conversion catalog uses the available workspace width and opens its narrow selector',async({page})=>{
 await page.setViewportSize({width:1024,height:900});await page.goto('/convert.html');const tool=page.frameLocator('iframe[data-workspace-active]');await expect(tool.locator('#convert-catalog-toggle')).toBeVisible();await tool.locator('#convert-catalog-toggle').click();await expect(tool.locator('#convert-catalog')).toHaveAttribute('popover','auto');await expect(tool.locator('#convert-search')).toBeFocused();await page.keyboard.press('Escape');await page.setViewportSize({width:1920,height:1080});await expect(tool.locator('#convert-catalog-toggle')).toBeHidden();await expect(tool.locator('#convert-catalog')).not.toHaveAttribute('popover');
});
