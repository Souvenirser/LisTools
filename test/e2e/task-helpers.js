export const activeTool=page=>page.frameLocator('iframe[data-workspace-active]');

async function toolFrame(page){
 const frame=await page.locator('iframe[data-workspace-active]').elementHandle();
 return frame.contentFrame();
}
export async function evaluateTool(page,run,arg){return (await toolFrame(page)).evaluate(run,arg);}
export async function waitForTool(page,run,arg){return (await toolFrame(page)).waitForFunction(run,arg);}

export async function chooseTask(page,tool,task,controls=activeTool(page)){
 await page.waitForFunction(()=>document.documentElement.dataset.uiState!=='booting');
 const select=controls.locator(`#${tool}-task-select`);
 if(await select.isVisible())await select.selectOption(task);else {const button=controls.locator(`#${tool}-task-${task}`);if(tool==='pdf'&&!await button.isVisible())await controls.locator('#pdf-task-adjustments').click();await button.click();}
}
export async function countdownDuration(page,seconds){
 await page.locator('#timer-hours').fill(String(Math.floor(seconds/3600)));
 await page.locator('#timer-seconds').fill(String(seconds%60));
 await page.locator('#timer-minutes').fill(String(Math.floor(seconds/60)%60));
}

export async function tryExample(page,tool){const surface=activeTool(page),button=surface.locator(`#${tool}-example`);if(!await button.isVisible())await surface.locator('details').filter({has:button}).locator('summary').first().click();await button.click();}
