import {test,expect} from '@playwright/test';
import {selectLanguage} from './language-helpers.js';
test.use({timezoneId:'Asia/Shanghai'});
async function open(page,time='2026-11-02T10:00:00+08:00'){
 await page.clock.setFixedTime(new Date(time));await page.goto('/salary.html');await expect(page.locator('html')).toHaveAttribute('data-ui-state','ready');
}
async function zone(page,value){
 const control=page.locator('.salary-timezone .choices');await control.click();await control.locator('input[type=search]').fill(value);await control.locator(`[data-choice][data-value="${value}"]`).click();await expect(page.locator('#salary-zone')).toHaveValue(value);
}
test('salary reuses the searchable timezone picker and applies the selected zone only after Save',async({page})=>{
 await open(page);await page.locator('#salary-amount').fill('16800');await page.locator('#salary-save').click();await expect(page.locator('#salary-earned')).toHaveText('¥100.0000');
 await zone(page,'UTC');await expect(page.locator('#salary-earned')).toHaveText('¥100.0000');expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('listools-salary-v1')).timeZone)).toBe('Asia/Shanghai');
 await page.locator('#salary-save').click();await page.locator('#salary-confirm-apply').click();await expect(page.locator('#salary-earned')).toHaveText('¥0.0000');await page.reload();await expect(page.locator('#salary-zone')).toHaveValue('UTC');await expect(page.locator('#salary-amount')).toHaveValue('16800');
 await page.locator('#salary-amount').fill('20000');await selectLanguage(page,'zh-Hans');const control=page.locator('.salary-timezone .choices');await control.click();await control.locator('input[type=search]').fill('中国');const shanghai=control.locator('[data-choice][data-value="Asia/Shanghai"]');await expect(shanghai.locator('img')).toHaveAttribute('src',/\/cn[.-]/);await shanghai.click();await expect(page.locator('#salary-amount')).toHaveValue('20000');
});
test('changing timezone across a month boundary clears incompatible draft dates without saving',async({page})=>{
 await open(page,'2026-11-01T00:30:00+08:00');await page.locator('#salary-mode').selectOption('monthly');await page.locator('#salary-monthly-rest').fill('1');await page.locator('[data-salary-date="2026-11-01"]').click();
 await zone(page,'UTC');await expect(page.locator('#salary-calendar-title')).toContainText('2026-10');await expect(page.locator('#salary-calendar [aria-pressed=true]')).toHaveCount(0);expect(await page.evaluate(()=>localStorage.getItem('listools-salary-v1'))).toBeNull();
 await page.locator('#salary-amount').fill('16800');await page.locator('#salary-save').click();await expect(page.locator('#salary-calendar-error')).toBeVisible();
});
test('footer is an explicit overview action and preserves unsaved salary edits',async({page,context})=>{
 await open(page);await expect(page.locator('#salary-bar-toggle')).toBeDisabled();await expect(page.locator('#salary-show-bar')).toHaveCount(0);await page.locator('#salary-amount').fill('16800');await page.locator('#salary-save').click();await expect(page.locator('#salary-bar')).toHaveCount(0);
 await page.locator('#salary-bar-toggle').click();await expect(page.locator('#salary-bar')).toBeVisible();await expect(page.locator('#salary-bar-toggle')).toHaveAttribute('aria-pressed','true');
 const other=await context.newPage();await other.goto('/index.html');await expect(other.locator('#salary-bar')).toBeVisible();await page.locator('#salary-amount').fill('20000');await other.locator('#salary-bar-hide').click();await expect(page.locator('#salary-bar')).toBeHidden();await expect(page.locator('#salary-bar-toggle')).toHaveAttribute('aria-pressed','false');await expect(page.locator('#salary-amount')).toHaveValue('20000');expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('listools-salary-v1')).salary)).toBe('16800');
});
test('timezone search does not dirty the draft and the shared control supports RTL at 320px',async({page})=>{
 await open(page);await page.setViewportSize({width:320,height:760});await selectLanguage(page,'ar');const control=page.locator('.salary-timezone .choices');await control.click();await control.locator('input[type=search]').fill('no-such-zone-zzzz');await expect(control.locator('.has-no-results')).toBeVisible();await expect(page.locator('#salary-draft-notice')).toBeHidden();await control.locator('input[type=search]').press('Escape');await zone(page,'UTC');await page.locator('#salary-zone-device').click();await expect(page.locator('#salary-zone')).toHaveValue('Asia/Shanghai');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(await page.evaluate(()=>localStorage.getItem('listools-salary-v1'))).toBeNull();
});
for(const width of [320,768,1366])test(`timezone controls stay inside the salary card at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1200});await open(page);const field=page.locator('.salary-timezone');await field.scrollIntoViewIfNeeded();const bounds=await field.boundingBox();for(const child of await field.locator(':scope > label,:scope > .choices,:scope > button,:scope > p').all()){const box=await child.boundingBox();expect(box.x).toBeGreaterThanOrEqual(bounds.x-1);expect(box.x+box.width).toBeLessThanOrEqual(bounds.x+bounds.width+1);}
});

test('confirming a salary draft preserves the latest display choices from another tab',async({page,context})=>{
 await open(page);await page.locator('#salary-amount').fill('16800');await page.locator('#salary-save').click();await page.locator('#salary-bar-toggle').click();
 const other=await context.newPage();await open(other);await expect(other.locator('#salary-bar')).toBeVisible();
 await page.locator('#salary-amount').fill('20000');await page.locator('#salary-save').click();await expect(page.locator('#salary-confirm')).toBeVisible();
 await other.locator('#salary-mask').click();await other.locator('#salary-bar-hide').click();
 await page.locator('#salary-confirm-apply').click();
 const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('listools-salary-v1')));
 await expect.poll(stored).toMatchObject({salary:'20000',masked:true,showBar:false});
 await expect(page.locator('#salary-earned')).toHaveText('¥••••');await expect(other.locator('#salary-earned')).toHaveText('¥••••');await expect(page.locator('#salary-bar')).toBeHidden();
});
test('switching calendar modes restores each mode draft until the month changes',async({page})=>{
 await open(page,'2026-11-01T00:30:00+08:00');const mode=page.locator('#salary-mode'),day=page.locator('[data-salary-date="2026-11-02"]');
 await day.click();await expect(day).toHaveAttribute('data-overridden','true');
 await mode.selectOption('monthly');await page.locator('#salary-monthly-rest').fill('1');await day.click();await expect(day).toHaveAttribute('aria-pressed','true');
 await mode.selectOption('cycle');await expect(day).toHaveAttribute('data-overridden','true');
 await mode.selectOption('monthly');await expect(day).toHaveAttribute('aria-pressed','true');
 await zone(page,'UTC');await expect(page.locator('#salary-calendar-title')).toContainText('2026-10');
 await zone(page,'Asia/Shanghai');await expect(day).toHaveAttribute('aria-pressed','false');
 await mode.selectOption('cycle');await expect(day).toHaveAttribute('data-overridden','false');
});
test('opening another tool keeps the unsaved salary tab and its input',async({page})=>{
 await open(page);await page.locator('#salary-amount').fill('16800');
 const search=page.locator('#tool-menu-search');if(!await search.isVisible())await page.locator('button.brand').click();
 await search.fill('calculator');
 const [popup]=await Promise.all([page.context().waitForEvent('page'),page.locator('#tool-menu nav a[data-tool-id="calculator"]').click()]);
 await expect(popup).toHaveURL(/calculator\.html$/);await expect(page.locator('#salary-amount')).toHaveValue('16800');
});
test('first-run mobile shows setup and calendar action before the dashboard',async({page})=>{
 await page.setViewportSize({width:390,height:740});await open(page);
 await expect(page.locator('#salary-amount')).toBeInViewport();await expect(page.locator('#salary-start')).toBeInViewport();
 await expect(page.locator('#salary-work-days')).toBeInViewport();await expect(page.locator('#salary-work-days')).toHaveValue('5');await expect(page.locator('#salary-rest-days')).toBeInViewport();await expect(page.locator('#salary-rest-days')).toHaveValue('2');
 const review=page.locator('#salary-review');await expect(review).toBeInViewport();
 const calendarTitle=page.locator('#salary-calendar-title'),save=page.locator('#salary-save');
 expect(await calendarTitle.evaluate((node)=>Boolean(node.compareDocumentPosition(document.querySelector('#salary-save')) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
 await page.locator('#salary-amount').fill('16800');await review.click();await expect(calendarTitle).toBeFocused();await save.click();await expect(page.locator('#salary-earned')).toHaveText('¥100.0000');
 await expect(page.locator('#salary-earned')).toBeInViewport();await expect(page.locator('#salary-active-month')).toHaveText('2026-11');await expect(page.locator('#salary-today')).toBeInViewport();
});
test('a dirty masked salary stays hidden when another tab clears the saved schedule',async({page,context})=>{
 await open(page);const amount=page.locator('#salary-amount');await amount.fill('16800');await page.locator('#salary-save').click();await page.locator('#salary-mask').click();
 await expect(amount).toHaveAttribute('type','password');await amount.fill('20000');
 const other=await context.newPage();await open(other);await other.locator('#salary-clear').click();await other.locator('#salary-confirm-apply').click();
 await expect(page.locator('#salary-draft-notice')).toContainText('another page');
 await expect(amount).toHaveValue('20000');await expect(amount).toHaveAttribute('type','password');
});

test('salary writes wait for the same cross-tab lock and a queued display change cannot restore cleared settings',async({page,context})=>{
 await open(page);await page.locator('#salary-amount').fill('16800');await page.locator('#salary-save').click();
 await expect(page.locator('#salary-earned')).toHaveText('¥100.0000');
 const other=await context.newPage();await open(other);
 const hold=()=>page.evaluate(()=>new Promise(resolve=>{
  void navigator.locks.request('listools-salary-v1',()=>new Promise(release=>{window.releaseSalaryLock=release;resolve();}));
 }));
 const release=()=>page.evaluate(()=>window.releaseSalaryLock());
 const locks=()=>page.evaluate(async()=> (await navigator.locks.query()).pending.filter(lock=>lock.name==='listools-salary-v1').length);
 const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('listools-salary-v1')));
 await hold();
 try{
  await page.locator('#salary-amount').fill('20000');await page.locator('#salary-save').click();await page.locator('#salary-confirm-apply').click();
  await expect.poll(locks,{timeout:2000}).toBe(1);
  await other.locator('#salary-mask').click();await expect.poll(locks,{timeout:2000}).toBe(2);
  expect(await saved()).toMatchObject({salary:'16800',masked:false});
 }finally{await release();}
 await expect.poll(saved).toMatchObject({salary:'20000',masked:true});
 await hold();
 try{
  await page.locator('#salary-clear').click();await page.locator('#salary-confirm-apply').click();await expect.poll(locks,{timeout:2000}).toBe(1);
  await other.locator('#salary-mask').click();await expect.poll(locks,{timeout:2000}).toBe(2);
  expect(await saved()).toMatchObject({salary:'20000',masked:true});
 }finally{await release();}
 await expect.poll(locks).toBe(0);
 await expect.poll(()=>other.evaluate(()=>localStorage.getItem('listools-salary-v1'))).toBeNull();
});
