import {test,expect} from '@playwright/test';
import {activeTool,chooseTask} from './task-helpers.js';

test.beforeEach(async({page,context,browserName})=>{
  if(browserName!=='firefox')await context.grantPermissions(browserName==='webkit'?['clipboard-read']:['clipboard-read','clipboard-write']);
  await page.addInitScript(()=>localStorage.setItem('listools-language','en'));
});

test('business result stays beside its action and shares one calculation with Ans and history',async({page})=>{
  await page.goto('/calculator.html');
  await activeTool(page).locator('#expression').fill('2+3');await activeTool(page).locator('#calculate').click();await expect(activeTool(page).locator('#result')).toHaveText('5');
  await activeTool(page).locator('#business-details summary').click();await activeTool(page).locator('#mode').selectOption('discount');await activeTool(page).locator('#first').fill('100');await activeTool(page).locator('#second').fill('20');await activeTool(page).locator('#business-run').click();
  await expect(activeTool(page).locator('#business-result')).toHaveText('80');await expect(activeTool(page).locator('#business-result-source')).toContainText('Price after discount');
  await expect(activeTool(page).locator('#business-copy')).toBeEnabled();await activeTool(page).locator('#business-copy').click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe('80');
  await expect(activeTool(page).locator('#result')).toHaveText('80');await expect(activeTool(page).locator('#expression')).toHaveValue('2+3');await expect(activeTool(page).locator('#history li')).toHaveCount(2);
  await activeTool(page).locator('#second').fill('30');await expect(activeTool(page).locator('#business-result')).toHaveText('');await expect(activeTool(page).locator('#business-copy')).toBeDisabled();
  await activeTool(page).locator('#calc-mode-scientific').click();await activeTool(page).locator('#expression').fill('Ans*2');await activeTool(page).locator('#expression').press('Enter');await expect(activeTool(page).locator('#result')).toHaveText('160');await expect(activeTool(page).locator('#history li')).toHaveCount(3);
});

test('same-value Today keeps the date result and age alone explains February 29',async({page})=>{
  await page.goto('/dates.html');await activeTool(page).locator('#date-today-end').click();await activeTool(page).locator('#difference-run').click();const value=await activeTool(page).locator('#difference-output').textContent();
  await activeTool(page).locator('#date-today-start').click();await activeTool(page).locator('#date-today-end').click();await expect(activeTool(page).locator('#difference-output')).toHaveText(value);await expect(activeTool(page).locator('#difference-copy')).toBeEnabled();
  await expect(activeTool(page).locator('[data-i18n="direct.daily.countdownHelp"]')).not.toContainText('February 29');await expect(activeTool(page).locator('[data-i18n="direct.daily.anniversaryHelp"]')).toBeHidden();await chooseTask(page,'dates','milestone');
  await expect(activeTool(page).locator('[data-i18n="direct.daily.anniversaryHelp"]')).toBeVisible();await activeTool(page).locator('#milestone-run').click();await expect(activeTool(page).locator('#date-origin')).toHaveAttribute('aria-invalid','true');
  await chooseTask(page,'dates','difference');await expect(activeTool(page).locator('#difference-output')).toHaveText(value);await expect(activeTool(page).locator('#date-start')).not.toHaveAttribute('aria-invalid','true');
  await chooseTask(page,'dates','workdays');await activeTool(page).locator('details').filter({has:activeTool(page).locator('#date-off')}).locator('summary').click();await activeTool(page).locator('#work-end').fill(await activeTool(page).locator('#work-start').inputValue());await activeTool(page).locator('#date-off').fill('20261001');await activeTool(page).locator('#workdays-run').click();await expect(activeTool(page).locator('#date-off')).toHaveAttribute('aria-invalid','true');await expect(activeTool(page).locator('#date-off')).toBeFocused();
  await chooseTask(page,'dates','difference');await chooseTask(page,'dates','workdays');await expect(activeTool(page).locator('#date-off')).toHaveAttribute('aria-invalid','true');await expect(activeTool(page).locator('#date-off')).not.toBeFocused();
});

test('unit result and copy precede concise precision help and secondary conversions are disclosed',async({page})=>{
  await page.goto('/units.html');await expect(activeTool(page).locator('#unit-primary')).toContainText('0.001');
  expect(await activeTool(page).locator('#unit-primary').evaluate(el=>Boolean(el.compareDocumentPosition(document.querySelector('[data-i18n="direct.daily.unitPrecision"]'))&Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  await activeTool(page).locator('#unit-all').check();await activeTool(page).locator('#unit-run').click();await expect(activeTool(page).locator('#unit-more-results')).not.toHaveAttribute('open','');
  await expect(activeTool(page).locator('#unit-results .numeric-result-row')).not.toHaveCount(0);await activeTool(page).locator('#unit-more-results summary').click();await expect(activeTool(page).locator('#unit-results')).toBeVisible();
  await activeTool(page).locator('#unit-copy').click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe('0.001');
  await activeTool(page).locator('#unit-copy-equation').click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe('1 meters (m) = 0.001 kilometers (km)');
});

test('money has one compact empty guide and reveals independent formats after conversion',async({page})=>{
  await page.goto('/money.html');await expect(activeTool(page).locator('#money-empty')).toBeVisible();await expect(activeTool(page).locator('.numeric-result-row:visible')).toHaveCount(0);
  await activeTool(page).locator('#money-input').fill('1000');await activeTool(page).locator('#money-run').click();await expect(activeTool(page).locator('#money-empty')).toBeHidden();await expect(activeTool(page).locator('#money-simplified')).toHaveText('壹仟元整');
  await expect(activeTool(page).locator('#money-other-formats')).not.toHaveAttribute('open','');await activeTool(page).locator('#money-other-formats summary').click();
  for(const [key,value]of Object.entries({rounded:'1000.00',grouped:'1,000.00',traditional:'壹仟圓整'})){await activeTool(page).locator('#copy-'+key).click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(value);}
  await activeTool(page).locator('#money-input').fill('100');await expect(activeTool(page).locator('#money-empty')).toBeVisible();await expect(activeTool(page).locator('.numeric-result-row:visible')).toHaveCount(0);
});

test('draw action names include the count and duplicate cleanup refers to entries',async({page})=>{
  await page.goto('/draw.html');await activeTool(page).locator('#draw-input').fill('Alice\nAlice\nBob');await expect(activeTool(page).locator('#draw-dedupe')).toHaveAccessibleName('Remove duplicate entries');
  await activeTool(page).locator('#draw-dedupe').click();await expect(activeTool(page).locator('#draw-total')).toContainText('2');await activeTool(page).locator('#draw-count').fill('2');await expect(activeTool(page).locator('#draw-run')).toHaveAccessibleName('Draw entries · 2');await activeTool(page).locator('#draw-run').click();
  await chooseTask(page,'draw','numbers');await activeTool(page).locator('#draw-number-count').fill('3');await expect(activeTool(page).locator('#draw-number-run')).toHaveAccessibleName('Draw numbers · 3');
  await chooseTask(page,'draw','list');await expect(activeTool(page).locator('#draw-result')).toContainText('Alice');await expect(activeTool(page).locator('#draw-result')).toContainText('Bob');
});

test('timer shows one duration heading while retaining the other-mode indicator',async({page})=>{
  await page.goto('/timer.html');await expect(activeTool(page).locator('[data-i18n="ux.setDuration"]:visible')).toHaveCount(1);await expect(activeTool(page).locator('[data-i18n="uiText.durationReset"]')).toHaveCount(0);
  await activeTool(page).locator('#timer-start').click();await chooseTask(page,'timer','stopwatch');await expect(activeTool(page).locator('#timer-other-running')).toContainText('Countdown');await activeTool(page).locator('#timer-start').click();await activeTool(page).locator('#timer-pause').click();await chooseTask(page,'timer','countdown');await activeTool(page).locator('#timer-pause').click();
});

for(const width of [1366,390])test(`calculator keeps keypad in place across calculation states at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});await page.goto('/calculator.html');await activeTool(page).locator('#expression').fill('2+3');
  const keyboard=activeTool(page).locator('#calculator-keyboards'),keypadTop=()=>keyboard.evaluate(el=>el.getBoundingClientRect().top-document.querySelector('.tool-heading').getBoundingClientRect().top),top=await keypadTop();
  await page.evaluate(()=>{window.calculatorLayoutStates=[];const status=document.querySelector('#tool-status');new MutationObserver(()=>window.calculatorLayoutStates.push({state:status.dataset.taskState,top:document.querySelector('#calculator-keyboards').getBoundingClientRect().top-document.querySelector('.tool-heading').getBoundingClientRect().top})).observe(status,{attributes:true,childList:true,subtree:true});});
  await activeTool(page).locator('#expression').press('Enter');await expect(activeTool(page).locator('#result')).toHaveText('5');expect(Math.abs((await keypadTop())-top)).toBeLessThanOrEqual(1);
  await activeTool(page).locator('#expression').fill('7+8');await expect(activeTool(page).locator('#tool-status')).toContainText('Content changed');expect(Math.abs((await keypadTop())-top)).toBeLessThanOrEqual(1);
  expect(await activeTool(page).locator('#tool-status').evaluate(el=>Boolean(el.closest('.calculator-display')))).toBe(true);
  await activeTool(page).locator('#expression').press('Enter');await expect(activeTool(page).locator('#result')).toHaveText('15');expect(Math.abs((await keypadTop())-top)).toBeLessThanOrEqual(1);
  await activeTool(page).locator('#expression').fill('1/3');await activeTool(page).locator('#expression').press('Enter');await expect(activeTool(page).locator('#approximate')).toBeVisible();const approximateTop=await keypadTop();
  await activeTool(page).locator('#copy').click();const exact=await page.evaluate(()=>navigator.clipboard.readText());expect(exact).toMatch(/^0\.333333333333333333333333/);expect(exact.length).toBeGreaterThan((await activeTool(page).locator('#result').textContent()).length);
  await activeTool(page).locator('#expression').fill('9+1');expect(Math.abs((await keypadTop())-approximateTop)).toBeLessThanOrEqual(1);expect(Math.abs((await keypadTop())-top)).toBeLessThanOrEqual(1);
  expect(await activeTool(page).locator('#approximate').evaluate(el=>Boolean(el.closest('.calculator-display')))).toBe(true);
  await activeTool(page).locator('#expression').fill('2+');await activeTool(page).locator('#expression').press('Enter');await expect(activeTool(page).locator('#tool-status')).toHaveClass(/is-error/);expect(Math.abs((await keypadTop())-top)).toBeLessThanOrEqual(1);
  const states=await page.evaluate(()=>window.calculatorLayoutStates);expect(states.some(item=>item.state==='pending')).toBe(true);expect(states.every(item=>Math.abs(item.top-top)<=1)).toBe(true);
});
