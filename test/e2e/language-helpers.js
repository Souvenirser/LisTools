import {expect} from '@playwright/test';
export async function selectLanguage(page,code) {
  const control=page.locator('.language-control .choices');
  const settings=page.locator('#workbench-settings'),opened=!(await settings.evaluate(dialog=>dialog.open));
  if(opened)await page.locator('#settings-open').click();
  await control.click();
  await control.locator('input[type="search"]').fill(code);
  await control.locator(`[data-choice][data-value="${code}"]`).click();
  await expect(page.locator('html')).toHaveAttribute('lang',code);
  if(opened&&await settings.evaluate(dialog=>dialog.open))await page.locator('#settings-close').click();
}
