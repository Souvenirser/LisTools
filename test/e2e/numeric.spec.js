import {selectLanguage} from './language-helpers.js';
import { test, expect } from '@playwright/test';

test('calculator evaluates percentages, reuses history, and preserves results across language changes',async({page})=>{
  await page.goto('/calculator.html');
  await page.locator('#expression').fill('200 + 10%');await page.locator('#expression').press('Enter');
  await expect(page.locator('#result')).toHaveText('220');await expect(page.locator('#history li')).toHaveCount(1);
  await selectLanguage(page,'ar');await expect(page.locator('html')).toHaveAttribute('dir','rtl');
  await expect(page.locator('#result')).toHaveText('220');await expect(page.locator('#expression')).toHaveValue('200 + 10%');
  await expect(page.locator('#expression')).toHaveAttribute('dir','ltr');
  await page.locator('#expression').fill('0.1 + 0.2');await page.locator('#calculate').click();await expect(page.locator('#result')).toHaveText('0.3');
  await page.locator('#history button').last().click();await expect(page.locator('#expression')).toHaveValue('200 + 10%');await expect(page.locator('#result')).toBeEmpty();
  await page.locator('#expression').fill('x=1');await page.locator('#calculate').click();await expect(page.locator('#tool-status')).toBeVisible();await expect(page.locator('#copy')).toBeDisabled();
  await page.locator('#business-details summary').click();await page.locator('#mode').selectOption('growth');await page.locator('#first').fill('100');await page.locator('#second').fill('120');await page.locator('#business-run').click();await expect(page.locator('#result')).toHaveText('20');
});

test('dates handles leap days, constrained month shifts and custom working dates',async({page})=>{
  await page.goto('/dates.html');await selectLanguage(page,'en');
  await page.locator('#date-start').fill('2024-02-28');await page.locator('#date-end').fill('2024-03-01');await page.locator('#difference-run').click();await expect(page.locator('#difference-output')).toContainText('Total days: 2');
  await page.locator('#date-inclusive').check();await page.locator('#difference-run').click();await expect(page.locator('#difference-output')).toContainText('Total days: 3');
  await page.locator('#date-base').fill('2024-01-31');await page.locator('#date-amount').fill('1');await page.locator('#date-unit').selectOption('months');await page.locator('#shift-run').click();await expect(page.locator('#shift-output')).toContainText('2024-02-29');
  await page.locator('#work-start').fill('2026-10-12');await page.locator('#work-end').fill('2026-10-18');await page.locator('#date-off').fill('2026-10-12, 2026-10-17');await page.locator('#date-work').fill('2026-10-17');await page.locator('#workdays-run').click();await expect(page.locator('#workdays-output')).toContainText('Working days: 5');
  await page.locator('#date-origin').fill('2000-02-29');await page.locator('#date-reference').fill('2025-03-01');await page.locator('#milestone-run').click();await expect(page.locator('#milestone-output')).toContainText('2026-02-28');
  await selectLanguage(page,'zh-Hans');await expect(page.locator('#date-base')).toHaveValue('2024-01-31');await expect(page.locator('#shift-output')).toContainText('2024-02-29');
});

test('units searches Chinese aliases, swaps primary targets and converts temperatures',async({page})=>{
  await page.goto('/units.html');await page.locator('#unit-all').uncheck();await page.locator('#unit-search').fill('千米');await page.locator('#unit-from').selectOption('km');await page.locator('#unit-to').selectOption('m');await page.locator('#unit-run').click();await expect(page.locator('#unit-primary')).toContainText('1000');
  await page.locator('#unit-swap').click();await expect(page.locator('#unit-from')).toHaveValue('m');await expect(page.locator('#unit-to')).toHaveValue('km');await expect(page.locator('#unit-primary')).toContainText('0.001');
  await page.locator('#unit-category').selectOption('temperature');await page.locator('#unit-from').selectOption('degF');await page.locator('#unit-to').selectOption('degC');await page.locator('#unit-value').fill('32');await page.locator('#unit-run').click();await expect(page.locator('#unit-primary')).toContainText('= 0');
  await page.locator('#unit-all').check();await page.locator('#unit-run').click();await expect(page.locator('#unit-results output')).toHaveCount(2);
  await selectLanguage(page,'ar');await expect(page.locator('#unit-value')).toHaveValue('32');await expect(page.locator('#unit-results output')).toHaveCount(2);
});

test('money rounds without precision loss and exposes both Chinese scripts',async({page})=>{
  await page.goto('/money.html');await selectLanguage(page,'en');await page.locator('#money-input').fill('-123456789012345.125');await page.locator('#money-input').press('Enter');
  await expect(page.locator('#money-rounded')).toHaveText('-123456789012345.13');await expect(page.locator('#money-grouped')).toHaveText('-123,456,789,012,345.13');await expect(page.locator('#money-simplified')).toContainText('负');await expect(page.locator('#money-traditional')).toContainText('負');await expect(page.locator('#money-rounding')).toContainText('rounded half up');
  await selectLanguage(page,'ar');await expect(page.locator('#money-rounded')).toHaveText('-123456789012345.13');await expect(page.locator('#money-input')).toHaveValue('-123456789012345.125');
  await page.locator('#money-input').fill('1,23');await page.locator('#money-run').click();await expect(page.locator('#tool-status')).toBeVisible();await expect(page.locator('#money-rounded')).toBeEmpty();
});

test.describe('today date shortcuts',()=>{
 test.use({timezoneId:'Asia/Shanghai'});
 test('today as end uses the current local date and clears the previous result',async({page})=>{
  test.setTimeout(10000);
  await page.clock.install({time:new Date('2026-10-19T16:30:00Z')});await page.goto('/dates.html');
  await page.locator('#date-start').fill('2026-10-01');await page.locator('#date-end').fill('2026-10-02');await page.locator('#difference-run').click();await expect(page.locator('#difference-copy')).toBeEnabled();
  await page.clock.setFixedTime(new Date('2026-10-20T16:30:00Z'));await page.locator('#date-today-end').click();
  await expect(page.locator('#date-end')).toHaveValue('2026-10-21');await expect(page.locator('#date-start')).toHaveValue('2026-10-01');await expect(page.locator('#difference-output')).toBeEmpty();await expect(page.locator('#difference-copy')).toBeDisabled();
  await selectLanguage(page,'zh-Hans');await expect(page.locator('#date-today-end')).toHaveText('以今天为结束日期');await expect(page.locator('#date-end')).toHaveValue('2026-10-21');
  await page.locator('#date-today-start').click();await expect(page.locator('#date-start')).toHaveValue('2026-10-21');
 });
});
