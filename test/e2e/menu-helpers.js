export async function startMenuSorting(page){
 if(!await page.locator('#workbench-settings').isVisible())await page.locator('#settings-open').click();
 await page.locator('#settings-sort').click();
}

export async function chooseConversionTool(page,selector){
 const link=page.locator(selector);if(!await link.isVisible())await page.locator('#convert-catalog-toggle').click();await link.click();
}
