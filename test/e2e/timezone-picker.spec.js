import {test,expect} from '@playwright/test';
import {selectLanguage} from './language-helpers.js';

const control=page=>page.locator('.timezone-controls .choices');
async function chooseZone(page,zone){
 await control(page).click();await control(page).locator('input[type=search]').fill(zone);
 await control(page).locator(`[data-choice][data-value="${zone}"]`).click();
 await expect(page.locator('#time-zone')).toHaveValue(zone);
}

test('time zones have country flags and searchable country city and IANA names',async({page})=>{
 await page.goto('/timestamp.html');await selectLanguage(page,'zh-Hans');
 await page.locator('#timestamp-source').fill('0');
 await control(page).click();const search=control(page).locator('input[type=search]');
 await search.fill('中国');const shanghai=control(page).locator('[data-choice][data-value="Asia/Shanghai"]');
 await expect(shanghai).toBeVisible();await expect(shanghai).toContainText('中国');
 await expect(shanghai.locator('img')).toHaveAttribute('src',/\/cn-/);await shanghai.click();
 await expect(page.locator('#timestamp-local')).toHaveValue('1970-01-01 08:00:00.000');
 await expect(control(page).locator('.choices__list--single')).toContainText('Asia/Shanghai');
 await control(page).click();await search.fill('New York');
 await expect(control(page).locator('[data-choice][data-value="America/New_York"]')).toBeVisible();
 await search.fill('India');await expect(control(page).locator('[data-choice][data-value="Asia/Calcutta"],[data-choice][data-value="Asia/Kolkata"]')).toHaveCount(1);
 await search.press('Escape');await expect(page.locator('#timestamp-source')).toHaveValue('0');
});

test('time zone selection and device restore preserve inputs and exact DST behavior',async({page})=>{
 await page.goto('/timestamp.html');await expect(page.locator('html')).toHaveAttribute('data-ui-state','ready');const device=await page.locator('#time-zone').inputValue();
 await page.locator('#timestamp-source').fill('0');await page.locator('#datetime-source').fill('2024-03-10 02:30:00');
 await chooseZone(page,'America/New_York');await expect(page.locator('#datetime-panel')).toHaveAttribute('data-status','error');
 await page.locator('#datetime-source').fill('2024-01-01 00:00:00');await expect(page.locator('#datetime-seconds')).toHaveValue('1704085200');
 const result=await page.locator('#datetime-seconds').inputValue();await selectLanguage(page,'ar');
 await expect(page.locator('#time-zone')).toHaveValue('America/New_York');await expect(page.locator('#datetime-seconds')).toHaveValue(result);
 await expect(page.locator('#datetime-source')).toHaveValue('2024-01-01 00:00:00');
 await page.locator('#restore-time-zone').click();await expect(page.locator('#time-zone')).toHaveValue(device);
 await expect(page.locator('#timestamp-source')).toHaveValue('0');await expect(page.locator('#datetime-source')).toHaveValue('2024-01-01 00:00:00');
});

test('time zone search is bounded accessible offline and usable at 320px RTL',async({page})=>{
 const errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:'))external.push(r.url());});
 await page.goto('/timestamp.html');await selectLanguage(page,'ar');await page.setViewportSize({width:320,height:760});
 await control(page).click();const search=control(page).locator('input[type=search]');
 await search.fill('no-such-zone-zzzz');await expect(control(page).locator('.has-no-results')).toBeVisible();
 await search.fill('UTC');await control(page).locator('[data-choice][data-value="UTC"]').click();
 await expect(control(page).locator('.choices__list--single img')).toHaveCount(0);
 await control(page).click();await expect(search).toHaveValue('');
 const zones=await page.locator('#time-zone option').evaluateAll(options=>options.map(option=>option.value));
 expect(zones).toEqual(expect.arrayContaining(await page.evaluate(()=>['UTC',...Intl.supportedValuesOf('timeZone')])));
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const popup=await control(page).locator('.choices__list--dropdown').boundingBox();expect(popup.x).toBeGreaterThanOrEqual(0);expect(popup.x+popup.width).toBeLessThanOrEqual(320);
 await search.press('Escape');expect(errors).toEqual([]);expect(external).toEqual([]);
});

test('MD5 navigation and page use a plain checksum name while keeping original results',async({page})=>{
 await page.goto('/convert.html#md5');await selectLanguage(page,'zh-Hans');
 await expect(page.locator('h1')).toContainText('MD5 校验');
 await page.locator('#convert-source .cm-content').fill('abc');await expect(page.locator('#md5-values textarea').first()).toHaveValue('900150983cd24fb0d6963f7d28e17f72');
 await page.locator('button.brand').click();await page.locator('#tool-menu-search').fill('MD5');
 await expect(page.locator('#tool-menu a[data-target="convert.html#md5"] .tool-menu-name')).toContainText('MD5 校验');
});
