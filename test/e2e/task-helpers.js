export async function chooseTask(page,tool,task){
 const select=page.locator(`#${tool}-task-select`);
 if(await select.isVisible())await select.selectOption(task);else {const button=page.locator(`#${tool}-task-${task}`);if(tool==='pdf'&&!await button.isVisible())await page.locator('#pdf-task-adjustments').click();await button.click();}
}
export async function countdownDuration(page,seconds){
 await page.locator('#timer-hours').fill(String(Math.floor(seconds/3600)));
 await page.locator('#timer-seconds').fill(String(seconds%60));
 await page.locator('#timer-minutes').fill(String(Math.floor(seconds/60)%60));
}

export async function tryExample(page,tool){const button=page.locator(`#${tool}-example`);if(!await button.isVisible())await page.locator('details').filter({has:button}).locator('summary').first().click();await button.click();}
