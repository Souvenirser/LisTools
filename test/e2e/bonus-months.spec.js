import {test,expect} from '@playwright/test';
async function open(page){await page.addInitScript(()=>localStorage.setItem('listools-language','zh-Hans'));await page.goto('/tax.html');const f=page.frameLocator('iframe[data-workspace-active]');await f.locator('#tax-salary').waitFor();await f.locator('#tax-source').selectOption('manual');await f.locator('#tax-contributions').fill('0');return f;}
test('bonus presets are visible and selectable when months already has a value',async({page})=>{
 const f=await open(page),months=f.locator('#tax-bonus-months'),amount=f.locator('#tax-bonus');
 const toggle=f.getByRole('button',{name:'年终奖（个月）',exact:true});
 const options=f.getByRole('group',{name:'年终奖（个月）',exact:true});
 await expect(months).toBeVisible();
 await expect(months).toHaveValue('0');
 await expect(amount).toHaveValue('0.00');
 const rect=await months.boundingBox(),action=await f.locator('#tax-run').boundingBox();
 expect(rect.y).toBeLessThan(action.y);
 await f.locator('#tax-salary').fill('20000');
 await expect(toggle).toBeVisible();

 for(const [n,expected] of [['1','20000.00'],['2','40000.00'],['3','60000.00'],['4','80000.00'],['5','100000.00'],['6','120000.00'],['0','0.00']]){
  await toggle.click();
  await expect(options.getByRole('button')).toHaveText(['0','1','2','3','4','5','6']);
  const option=options.getByRole('button',{name:n,exact:true});
  await expect(option).toBeInViewport();
  await option.click();
  await expect(options).toBeHidden();
  await expect(months).toHaveValue(n);
  await expect(amount).toHaveValue(expected);
 }

 await months.fill('6.5');
 await expect(amount).toHaveValue('130000.00');
 await toggle.click();
 await expect(options.getByRole('button')).toHaveText(['0','1','2','3','4','5','6']);
 await options.getByRole('button',{name:'5',exact:true}).click();
 await expect(months).toHaveValue('5');
 await expect(amount).toHaveValue('100000.00');
});
test('fractional bonus follows salary, manual amount remains independent, and exports use full amount',async({page})=>{
 const f=await open(page);await f.locator('#tax-period').fill('2026-11');await f.locator('#tax-salary').fill('20000');await f.locator('#tax-bonus-months').fill('1.3');await f.locator('#tax-run').click();await expect(f.locator('[data-value=bonusNet]')).toHaveText('25,220.00');await f.locator('#tax-salary').fill('30000');await expect(f.locator('#tax-bonus')).toHaveValue('39000.00');
 await f.locator('#tax-bonus').fill('36000');await expect(f.locator('#tax-bonus-months')).toHaveValue('1.2');await f.locator('#tax-salary').fill('20000');await expect(f.locator('#tax-bonus')).toHaveValue('36000');await expect(f.locator('#tax-bonus-months')).toHaveValue('1.8');await f.locator('#tax-run').click();await expect(f.locator('[data-value=bonusNet]')).toHaveText('34,920.00');
});
test('zero months produces no bonus result and invalid months have a visible field error',async({page})=>{
 const f=await open(page);await f.locator('#tax-salary').fill('20000');await f.locator('#tax-run').click();await expect(f.locator('[data-value=net]')).toBeVisible();await expect(f.locator('[data-value=bonusNet]')).toHaveCount(0);await f.locator('#tax-bonus-months').fill('-1');await f.locator('#tax-run').click();await expect(f.locator('#tax-bonus-months')).toHaveAttribute('aria-invalid','true');await expect(f.locator('#tax-bonus-months')).toBeFocused();await f.locator('#tax-bonus-months').fill('1.3');await f.locator('#tax-run').click();await expect(f.locator('[data-value=bonusNet]')).toBeVisible();
});
