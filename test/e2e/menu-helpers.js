export async function startMenuSorting(page){
 if(!await page.locator('#workbench-settings').evaluate(dialog=>dialog.open))await page.locator('#settings-open').click();
 await page.locator('#settings-sort').click();
}

export async function chooseConversionTool(page,selector){
 const link=page.locator(selector),catalog=page.locator('#convert-catalog');if(await catalog.evaluate(node=>node.hasAttribute('popover')&&!node.matches(':popover-open')))await page.locator('#convert-catalog-toggle').click();await link.click();
}
