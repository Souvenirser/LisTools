import {activeTool,chooseTask} from './task-helpers.js';
import {selectLanguage} from './language-helpers.js';
import { test, expect } from '@playwright/test';

test('calculator evaluates percentages, reuses history, and preserves results across language changes',async({page})=>{
  await page.goto('/calculator.html');
  await activeTool(page).locator('#expression').fill('200 + 10%');await activeTool(page).locator('#expression').press('Enter');
  await expect(activeTool(page).locator('#result')).toHaveText('220');await expect(activeTool(page).locator('#history li')).toHaveCount(1);
  await selectLanguage(page,'ar');await expect(page.locator('html')).toHaveAttribute('dir','rtl');
  await expect(activeTool(page).locator('#result')).toHaveText('220');await expect(activeTool(page).locator('#expression')).toHaveValue('200 + 10%');
  await expect(activeTool(page).locator('#expression')).toHaveAttribute('dir','ltr');
  await activeTool(page).locator('#expression').fill('0.1 + 0.2');await activeTool(page).locator('#calculate').click();await expect(activeTool(page).locator('#result')).toHaveText('0.3');
  if(await activeTool(page).locator('#calculator-history-toggle').getAttribute('aria-expanded')!=='true')await activeTool(page).locator('#calculator-history-toggle').click();await activeTool(page).locator('#history button').last().click();await expect(activeTool(page).locator('#expression')).toHaveValue('200 + 10%');await expect(activeTool(page).locator('#result')).toBeEmpty();
  await activeTool(page).locator('#expression').fill('x=1');await activeTool(page).locator('#calculate').click();await expect(activeTool(page).locator('#tool-status')).toBeVisible();await expect(activeTool(page).locator('#copy')).toBeDisabled();
  await activeTool(page).locator('#business-details summary').click();await activeTool(page).locator('#mode').selectOption('growth');await activeTool(page).locator('#first').fill('100');await activeTool(page).locator('#second').fill('120');await activeTool(page).locator('#business-run').click();await expect(activeTool(page).locator('#result')).toHaveText('20');
});

test('dates handles leap days, constrained month shifts and custom working dates',async({page})=>{
  await page.goto('/dates.html');await selectLanguage(page,'en');
  await activeTool(page).locator('#date-start').fill('2024-02-28');await activeTool(page).locator('#date-end').fill('2024-03-01');await activeTool(page).locator('#difference-run').click();await expect(activeTool(page).locator('#difference-output')).toContainText('Total days: 2');
  await activeTool(page).locator('#date-inclusive').check();await activeTool(page).locator('#difference-run').click();await expect(activeTool(page).locator('#difference-output')).toContainText('Total days: 3');
  await chooseTask(page,'dates','shift',activeTool(page));await activeTool(page).locator('#date-base').fill('2024-01-31');await activeTool(page).locator('#date-amount').fill('1');await activeTool(page).locator('#date-unit').selectOption('months');await activeTool(page).locator('#shift-run').click();await expect(activeTool(page).locator('#shift-output')).toContainText('2024-02-29');
  await chooseTask(page,'dates','workdays',activeTool(page));await activeTool(page).locator('details').filter({has:activeTool(page).locator('#date-off')}).locator('summary').click();await activeTool(page).locator('#work-start').fill('2026-10-12');await activeTool(page).locator('#work-end').fill('2026-10-18');await activeTool(page).locator('#date-off').fill('2026-10-12, 2026-10-17');await activeTool(page).locator('#date-work').fill('2026-10-17');await activeTool(page).locator('#workdays-run').click();await expect(activeTool(page).locator('#workdays-output')).toContainText('Working days: 5');
  await chooseTask(page,'dates','milestone',activeTool(page));await activeTool(page).locator('#date-origin').fill('2000-02-29');await activeTool(page).locator('#date-reference').fill('2025-03-01');await activeTool(page).locator('#milestone-run').click();await expect(activeTool(page).locator('#milestone-output')).toContainText('2026-02-28');
  await selectLanguage(page,'zh-Hans');await chooseTask(page,'dates','shift',activeTool(page));await expect(activeTool(page).locator('#date-base')).toHaveValue('2024-01-31');await expect(activeTool(page).locator('#shift-output')).toContainText('2024-02-29');
});

test('units searches Chinese aliases, swaps primary targets and converts temperatures',async({page})=>{
  await page.goto('/units.html');await activeTool(page).locator('#unit-all').uncheck();await unit(page,'from','km','千米');await unit(page,'to','m');await activeTool(page).locator('#unit-run').click();await expect(activeTool(page).locator('#unit-primary')).toContainText('1000');
  await activeTool(page).locator('#unit-swap').click();await expect(activeTool(page).locator('#unit-from')).toHaveValue('m');await expect(activeTool(page).locator('#unit-to')).toHaveValue('km');await expect(activeTool(page).locator('#unit-primary')).toContainText('0.001');
  await activeTool(page).locator('#unit-category').selectOption('temperature');await unit(page,'from','degF');await unit(page,'to','degC');await activeTool(page).locator('#unit-value').fill('32');await activeTool(page).locator('#unit-run').click();await expect(activeTool(page).locator('#unit-primary')).toContainText('= 0');
  await activeTool(page).locator('#unit-all').check();await activeTool(page).locator('#unit-run').click();await expect(activeTool(page).locator('#unit-results output')).toHaveCount(2);
  await selectLanguage(page,'ar');await expect(activeTool(page).locator('#unit-value')).toHaveValue('32');await expect(activeTool(page).locator('#unit-results output')).toHaveCount(2);
});

test('money rounds without precision loss and exposes both Chinese scripts',async({page})=>{
  await page.goto('/money.html');await selectLanguage(page,'en');await activeTool(page).locator('#money-input').fill('-123456789012345.125');await activeTool(page).locator('#money-input').press('Enter');
  await expect(activeTool(page).locator('#money-rounded')).toHaveText('-123456789012345.13');await expect(activeTool(page).locator('#money-grouped')).toHaveText('-123,456,789,012,345.13');await expect(activeTool(page).locator('#money-simplified')).toContainText('负');await expect(activeTool(page).locator('#money-traditional')).toContainText('負');await expect(activeTool(page).locator('#money-rounding')).toContainText('rounded half up');
  await selectLanguage(page,'ar');await expect(activeTool(page).locator('#money-rounded')).toHaveText('-123456789012345.13');await expect(activeTool(page).locator('#money-input')).toHaveValue('-123456789012345.125');
  await activeTool(page).locator('#money-input').fill('1,23');await activeTool(page).locator('#money-run').click();await expect(activeTool(page).locator('#tool-status')).toBeVisible();await expect(activeTool(page).locator('#money-rounded')).toBeEmpty();
});

test.describe('today date shortcuts',()=>{
 test.use({timezoneId:'Asia/Shanghai'});
 test('today as end uses the current local date and clears the previous result',async({page})=>{
  test.setTimeout(10000);
  await page.clock.install({time:new Date('2026-10-19T16:30:00Z')});await page.goto('/dates.html');
  await activeTool(page).locator('#date-start').fill('2026-10-01');await activeTool(page).locator('#date-end').fill('2026-10-02');await activeTool(page).locator('#difference-run').click();await expect(activeTool(page).locator('#difference-copy')).toBeEnabled();
  await page.clock.setFixedTime(new Date('2026-10-20T16:30:00Z'));await activeTool(page).locator('#date-today-end').click();
  await expect(activeTool(page).locator('#date-end')).toHaveValue('2026-10-21');await expect(activeTool(page).locator('#date-start')).toHaveValue('2026-10-01');await expect(activeTool(page).locator('#difference-output')).toBeEmpty();await expect(activeTool(page).locator('#difference-copy')).toBeDisabled();
  await selectLanguage(page,'zh-Hans');await expect(activeTool(page).locator('#date-today-end')).toHaveText('以今天为结束日期');await expect(activeTool(page).locator('#date-end')).toHaveValue('2026-10-21');
  await activeTool(page).locator('#date-today-start').click();await expect(activeTool(page).locator('#date-start')).toHaveValue('2026-10-21');
 });
});

async function unit(page,direction,value,query){const choices=activeTool(page).locator('.unit-picker').filter({has:activeTool(page).locator('#unit-'+direction)}).locator('.choices');await choices.click();if(query)await choices.locator('input[type=search]').fill(query);await choices.locator('[data-choice][data-value="'+value+'"]').click();}
