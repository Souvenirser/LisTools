import {activeTool} from './task-helpers.js';

export async function startMenuSorting(page){
 if(!await page.locator('#workbench-settings').evaluate(dialog=>dialog.open))await page.locator('#settings-open').click();
 await page.locator('#settings-sort').click();
}

export async function chooseConversionTool(page,selector){
 const tool=activeTool(page);
 const catalog=tool.locator('#convert-catalog');
 if(await catalog.evaluate(node=>node.hasAttribute('popover')&&!node.matches(':popover-open')))await tool.locator('#convert-catalog-toggle').click();
 await tool.locator(selector).click();
}
