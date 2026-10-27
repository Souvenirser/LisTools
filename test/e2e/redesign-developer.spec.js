import {chooseConversionTool} from './menu-helpers.js';
import {test,expect} from '@playwright/test';
import {selectLanguage} from './language-helpers.js';
import {chooseTask} from './task-helpers.js';

test('regex common rules remain available after flags and language changes',async({page})=>{
  await page.goto('/regex.html');await selectLanguage(page,'en');
  await page.locator('#regex-common-flags input[value="i"]').check();
  await expect(page.locator('#regex-rules-open')).toBeVisible();
  await selectLanguage(page,'zh-Hans');
  await page.locator('#regex-rules-open').click();
  await expect(page.locator('#regex-rules-panel')).toBeVisible();
  await expect(page.locator('#regex-rule-search')).toBeFocused();
  await page.keyboard.press('Escape');
  await page.locator('#regex-pattern').fill('ORDER-(?<number>\\d+)');
  await page.locator('#regex-source .cm-content').fill('ORDER-1024 ORDER-2048');
  await chooseTask(page,'regex','extract');await page.locator('#regex-run').click();
  await expect(page.locator('#regex-group option[value="name:number"]')).toHaveCount(1);
  await page.locator('#regex-group').selectOption('name:number');await page.locator('#regex-run').click();
  await expect(page.locator('#regex-output .cm-content')).toHaveText('10242048');
});

test('timestamp keeps the live local clock visible while extra clock formats are collapsed',async({page})=>{
  await page.clock.install({time:new Date('2023-12-31T23:59:00Z')});
  await page.clock.pauseAt(new Date('2024-01-01T00:00:00Z'));
  await page.goto('/timestamp.html');await page.clock.runFor(250);await selectLanguage(page,'en');
  const zones=page.locator('.timezone-controls .choices');await zones.click();
  await zones.locator('input[type="search"]').fill('UTC');await zones.locator('[data-choice][data-value="UTC"]').click();
  await expect(page.locator('#clock-details')).not.toHaveAttribute('open');await expect(page.locator('.clock-quick-actions [data-copy=clock-seconds]')).toBeVisible();
  await expect(page.locator('#clock-summary')).toBeVisible();
  await expect(page.locator('#clock-summary')).toHaveText('2024-01-01 00:00:00');
  await page.clock.runFor(1000);await expect(page.locator('#clock-summary')).toHaveText('2024-01-01 00:00:01');
  await page.locator('#timestamp-source').fill('0');await expect(page.locator('#timestamp-local')).toHaveValue('1970-01-01 00:00:00.000');
  await expect(page.locator('#clock-seconds')).toHaveValue('1704067201');
  await expect(page.locator('#timestamp-local')).toHaveValue('1970-01-01 00:00:00.000');
});


test('password task changes keep required settings visible and exports masked by default',async({page})=>{
  await page.goto('/password.html');await selectLanguage(page,'en');
  await page.locator('#password-batch').fill('2');await page.locator('#password-generate').click();
  await expect(page.locator('#password-results input[type="password"]')).toHaveCount(2);
  await page.locator('#password-show').click();await expect(page.locator('#password-results input[type="text"]')).toHaveCount(2);
  await chooseTask(page,'password','passphrase');
  await expect(page.locator('#password-results input')).toHaveCount(0);
  await expect(page.locator('#password-batch')).toHaveValue('2');await expect(page.locator('#password-words')).toBeVisible();
  await expect(page.locator('#password-length')).toBeHidden();await page.locator('#password-generate').click();
  await expect(page.locator('#password-results input[type="password"]')).toHaveCount(2);
  const values=await page.locator('#password-results input').evaluateAll(inputs=>inputs.map(input=>input.value));
  await expect(page.locator('#password-plaintext')).toBeVisible();
  const pending=page.waitForEvent('download');await page.locator('#password-download').click();
  const stream=await(await pending).createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);
  expect(Buffer.concat(chunks).toString()).toBe(values.join('\n'));
});

test('MD5 HMAC clears its key after a result and when leaving the task',async({page})=>{
  await page.goto('/convert.html#md5');await selectLanguage(page,'en');await page.locator('#md5-mode').selectOption('hmac');
  await page.locator('#convert-source .cm-content').fill('message');await page.locator('#md5-key').fill('local-secret');
  await page.locator('#md5-run').click();await expect(page.locator('#md5-value-hex32lower')).toHaveValue(/^[a-f0-9]{32}$/);
  await expect(page.locator('#md5-key')).toHaveValue('');await page.locator('#md5-key').fill('another-secret');
  await chooseConversionTool(page,'#convert-tool-list a[href="#base64"]');await expect(page.locator('#md5-key')).toHaveValue('');
  await chooseConversionTool(page,'#convert-tool-list a[href="#md5"]');await expect(page.locator('#md5-key')).toHaveValue('');
});
