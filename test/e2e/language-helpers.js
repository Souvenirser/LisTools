import {expect} from '@playwright/test';
export async function selectLanguage(page,code) {
  const control=page.locator('.language-control .choices');
  await control.click();
  await control.locator('input[type="search"]').fill(code);
  await control.locator(`[data-choice][data-value="${code}"]`).click();
  await expect(page.locator('html')).toHaveAttribute('lang',code);
}
