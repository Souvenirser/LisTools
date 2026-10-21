import {test,expect} from '@playwright/test';
import {selectLanguage} from './language-helpers.js';

test('RTL Cron keeps numeric ranges, expressions and reference instants in LTR order',async({page})=>{
 await page.goto('/cron.html');await expect(page.locator('#cron-fields tbody tr')).toHaveCount(5);
 for(const code of ['ar','fa','he','ur']){
  await selectLanguage(page,code);
  const ranges=page.locator('#cron-fields tbody td:nth-child(3)');
  expect(await ranges.evaluateAll(cells=>cells.map(cell=>getComputedStyle(cell).direction))).toEqual(Array(5).fill('ltr'));
  await expect(ranges.first()).toHaveText('0–59');await expect(page.locator('#cron-expression')).toHaveAttribute('dir','ltr');await expect(page.locator('#cron-result-context bdi')).toHaveCount(2);
  expect(await page.locator('#cron-result-context bdi').evaluateAll(nodes=>nodes.every(node=>getComputedStyle(node).direction==='ltr'))).toBe(true);
 }
});
