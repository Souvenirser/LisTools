import {expect,test} from '@playwright/test';

async function openTax(page, now){
 await page.clock.setFixedTime(new Date(now));
 await page.addInitScript(()=>localStorage.setItem('listools-language','zh-Hans'));
 await page.goto('/tax.html#annual');
 return page.frameLocator('iframe[data-workspace-active]');
}

test('tax requires an explicit city for auto contributions',async({page})=>{
 const f=await openTax(page,'2026-11-20T00:00:00Z');
 await expect(f.locator('#tax-city')).toHaveValue('');
 await f.locator('#tax-salary').fill('20000');
 await f.locator('#tax-run').click();
 await expect(f.locator('#tax-result')).toHaveAttribute('data-status','idle');
 await expect(f.locator('#tax-exports')).toBeHidden();
});

test('estimated results export without a refund before Shanghai year end',async({page})=>{
 const f=await openTax(page,'2026-12-31T15:59:59Z');
 await f.locator('#tax-source').selectOption('manual');
 await f.locator('#tax-salary').fill('10000');
 await f.locator('#tax-contributions').fill('0');
 await f.locator('#tax-annual-options summary').click();
 await f.locator('#tax-actualWithheld').fill('3480');
 await f.locator('#tax-run').click();
 await expect(f.locator('[data-value=annualNet]')).toBeVisible();
 await expect(f.locator('[data-value=refund]')).toHaveCount(0);
 await expect(f.locator('#tax-forecast-note')).toBeVisible();
 const [download]=await Promise.all([page.waitForEvent('download'),f.locator('#tax-downloadCsv').click()]);
 const chunks=[];
 for await(const chunk of await download.createReadStream())chunks.push(chunk);
 const data=Buffer.concat(chunks).toString();
 expect(data).toContain('refundEligible');
 expect(data).not.toMatch(/^"?预计退税[",]/m);
});

test('insurance identifies automatic ratios and records the selected conditions',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('listools-language','zh-Hans'));
 await page.goto('/insurance.html');
 const f=page.frameLocator('iframe[data-workspace-active]');
 await f.locator('#insurance-month').fill('2026-11');
 const picker=f.locator('#insurance-city-control');
 await picker.click();
 await picker.locator('input[type=search]').fill('Shanghai');
 await picker.locator('[data-choice-selectable][data-value=shanghai]').click();
 await expect(f.locator('#insurance-estimate-context')).toContainText('自动比例估算');
 await f.locator('#insurance-salary').fill('20000');
 await f.locator('#insurance-run').click();
 const context=f.locator('#insurance-condition');
 await expect(context).toContainText('上海');
 await expect(context).toContainText('2026-11');
 await expect(context).toContainText('7%');
});

test('closed year needs all actual months and bonus withholding in the annual export',async({page})=>{
 const f=await openTax(page,'2026-12-31T16:00:00Z');
 await f.locator('#tax-period').fill('2026-12');
 await f.locator('#tax-source').selectOption('manual');
 await f.locator('#tax-salary').fill('10000');
 await f.locator('#tax-contributions').fill('0');
 await f.locator('#tax-annual-mode').selectOption('monthly');
 for(let month=1;month<=12;month++){
  await f.locator(`#tax-month-${month} summary`).click();
  await f.locator(`#tax-a-${month}-history`).selectOption(month===12?'none':'actual');
 }
 await f.locator('#tax-annual-options summary').click();
 await f.locator('#tax-actualWithheld').fill('3480');
 await f.locator('#tax-run').click();
 await expect(f.locator('[data-value=refund]')).toHaveText('1,000.00');
 await f.locator('#tax-bonus-section summary').click();
 await expect(f.locator('#tax-bonusWithheld')).toBeDisabled();
 await f.locator('#tax-bonus').fill('36000');
 await f.locator('#tax-bonus-method').selectOption('combined');
 await f.locator('#tax-bonusMonth').fill('12');
 await expect(f.locator('#tax-exports')).toBeHidden();
 await f.locator('#tax-run').click();
 await expect(f.locator('[data-value=refund]')).toHaveCount(0);
 await f.locator('#tax-bonusWithheld').fill('0');
 await f.locator('#tax-run').click();
 await expect(f.locator('[data-value=refund]')).toHaveText('2,600.00');
 const [download]=await Promise.all([page.waitForEvent('download'),f.locator('#tax-downloadTxt').click()]);
 const chunks=[];
 for await(const chunk of await download.createReadStream())chunks.push(chunk);
 expect(Buffer.concat(chunks).toString()).toContain('预计补税: 2600.00');
});
