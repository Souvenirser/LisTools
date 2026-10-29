import {test,expect} from '@playwright/test';
import {chooseTask} from './task-helpers.js';
test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('listools-language','en'));});

test('hidden field errors surface globally and explicit submission opens their disclosure',async({page})=>{
 await page.goto('/dates.html');await chooseTask(page,'dates','workdays');
 const details=page.locator('details').filter({has:page.locator('#date-off')});
 await details.evaluate(el=>el.open=true);await page.locator('#date-off').fill('bad');await details.evaluate(el=>el.open=false);
 await expect(page.locator('#tool-status')).toHaveClass(/is-error/);await expect(page.locator('#tool-status')).not.toHaveClass(/sr-only/);await expect(details).not.toHaveAttribute('open','');
 await details.locator('summary').click();await expect(page.locator('#date-off-error')).toBeVisible();await expect(page.locator('#tool-status')).toHaveClass(/sr-only/);
 await details.locator('summary').click();await expect(page.locator('#tool-status')).not.toHaveClass(/sr-only/);
 await page.locator('#workdays-run').click();await expect(details).toHaveAttribute('open','');await expect(page.locator('#date-off')).toBeFocused();await expect(page.locator('#tool-status')).toHaveClass(/sr-only/);
});

test('date difference states interval and endpoint policy',async({page,context,browserName})=>{
 await context.grantPermissions(browserName==='webkit'?['clipboard-read']:['clipboard-read','clipboard-write']);
 await page.goto('/dates.html');await page.locator('#date-start').fill('2026-01-01');await page.locator('#date-end').fill('2026-01-31');await page.locator('#difference-run').click();
 await expect(page.locator('#difference-output')).toContainText('2026-01-01 → 2026-01-31');await expect(page.locator('#difference-output')).toContainText('End date excluded');
 await page.locator('#date-inclusive').check();await expect(page.locator('#difference-output')).toContainText('Include');await page.locator('#difference-copy').click();const copied=await page.evaluate(()=>navigator.clipboard.readText());expect(copied).toContain('2026-01-01 → 2026-01-31');expect(copied).toContain('Include');expect(copied).toContain('Timestamp');
});
for(const [name,input,copy]of [['money','money-input','copy-rounded'],['units','unit-value','unit-copy']])test(`${name} defers incomplete number errors until blur without retaining exports`,async({page})=>{
 await page.goto('/'+name+'.html');await page.locator('#'+input).fill('100');await expect(page.locator('#'+copy)).toBeEnabled();
 for(const prefix of ['1e','1e-','1,','1,23','1.','-']){
  await page.locator('#'+input).fill(prefix);await expect(page.locator('#'+copy)).toBeDisabled();await page.waitForTimeout(450);await expect(page.locator('#tool-status')).not.toHaveClass(/is-error/);
 }
 await page.locator('#'+input).fill('1e-');await page.locator('h1').click();await expect(page.locator('#'+input)).toHaveAttribute('aria-invalid','true');await expect(page.locator('#'+input)).not.toBeFocused();
 await page.locator('#'+input).fill('1e-');await page.locator('#'+(name==='money'?'money-run':'unit-run')).click();await expect(page.locator('#'+input)).toHaveAttribute('aria-invalid','true');await expect(page.locator('#'+input)).toBeFocused();
});

test('unit disclosure counts other targets and precision is independent',async({page})=>{
 await page.goto('/units.html');await expect(page.locator('#unit-more-results')).toBeHidden();await page.locator('#unit-precision-details summary').click();await expect(page.locator('[data-i18n="direct.daily.unitPrecision"]')).toBeVisible();
 await page.locator('#unit-all').check();await expect(page.locator('#unit-more-results summary')).toContainText('(9)');await expect(page.locator('#unit-more-results')).not.toHaveAttribute('open','');
});
for(const width of [1360,390])for(const failure of ['constructor','resume'])test(`timer ${failure} audio failure preserves running state and warning at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:960});
 await page.addInitScript(kind=>{window.AudioContext=class{constructor(){if(kind==='constructor')throw Error('audio denied');this.state='suspended';}resume(){return Promise.reject(Error('audio denied'));}close(){return Promise.resolve();}};},failure);
 await page.goto('/timer.html');const controls=async()=>page.locator('#timer-progress,#timer-start').evaluateAll(es=>es.map(el=>el.getBoundingClientRect().top-(el.closest('.workspace-action-fixed')?0:document.querySelector('.tool-heading').getBoundingClientRect().top)));const top=await controls();await page.locator('#timer-sound').check();await page.locator('#timer-start').click();
 await expect(page.locator('#timer-pause')).toBeEnabled();await expect(page.locator('#timer-sound-warning')).toBeVisible();await expect(page.locator('#timer-sound-warning')).toContainText('Sound is unavailable');const after=await controls();for(let i=0;i<top.length;i++)expect(Math.abs(after[i]-top[i])).toBeLessThanOrEqual(1);await expect(page.locator('[data-i18n="timer.backgroundHelp"]')).toBeVisible();
 await page.locator('#timer-reset').click();await expect(page.locator('#timer-sound-warning')).toHaveText('');
 await page.locator('#timer-sound').uncheck();await expect(page.locator('#timer-sound-warning')).toHaveText('');
});

test('number draw targets the incorrect endpoint and summarizes its range without export headers',async({page,context,browserName})=>{
 await context.grantPermissions(browserName==='webkit'?['clipboard-read']:['clipboard-read','clipboard-write']);await page.goto('/draw.html');await chooseTask(page,'draw','numbers');await page.locator('#draw-min').fill('1.5');await page.locator('#draw-number-run').click();await expect(page.locator('#draw-min')).toHaveAttribute('aria-invalid','true');await page.locator('#draw-min').fill('1');await page.locator('#draw-max').fill('1.5');await page.locator('#draw-number-run').click();await expect(page.locator('#draw-max')).toHaveAttribute('aria-invalid','true');await expect(page.locator('#draw-min')).not.toHaveAttribute('aria-invalid','true');
 await page.locator('#draw-max').fill('0');await page.locator('#draw-number-run').click();await expect(page.locator('#draw-range-error')).toBeVisible();
 await page.locator('#draw-max').fill('4');await page.locator('#draw-number-count').fill('2');await page.locator('#draw-number-run').click();await expect(page.locator('#draw-summary')).toContainText('1–4');await expect(page.locator('#draw-summary')).toContainText('No repeated numbers');await page.locator('#draw-copy').click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toMatch(/^\d\n\d$/);
});

test('calculator retains only exact-request results while recalculating and labels them near the value',async({page})=>{
 await page.addInitScript(()=>{const NativeWorker=window.Worker;window.Worker=class extends NativeWorker{postMessage(data){setTimeout(()=>super.postMessage(data),200);}};});
 await page.goto('/calculator.html');await page.locator('#expression').fill('2+3');await page.locator('#calculate').click();await expect(page.locator('#result')).toHaveText('5');await page.locator('#calculate').click();await expect(page.locator('#copy')).toBeDisabled();await expect(page.locator('#result')).toHaveText('5');
 expect(await page.locator('#result-source').evaluate(el=>Boolean(el.closest('.calculator-display')))).toBe(true);await expect(page.locator('#copy')).toBeEnabled();await expect(page.locator('#history li')).toHaveCount(2);
 await page.locator('#business-details summary').click();await page.locator('#business-run').click();await expect(page.locator('#business-copy')).toBeEnabled();const value=await page.locator('#business-result').textContent();await page.locator('#business-run').click();await expect(page.locator('#business-copy')).toBeDisabled();await expect(page.locator('#business-result')).toHaveText(value);await expect(page.locator('#business-copy')).toBeEnabled();await expect(page.locator('#history li')).toHaveCount(4);
 await page.locator('#calc-mode-scientific').click();await page.locator('#expression').fill('Ans+1');await page.locator('#expression').press('Enter');await expect(page.locator('#copy')).toBeEnabled();await page.locator('#expression').press('Enter');await expect(page.locator('#copy')).toBeDisabled();await expect(page.locator('#result')).toHaveText('');
});


test('timer starts without awaiting audio permission and clears a recovered sound warning',async({page})=>{
 await page.addInitScript(()=>{window.AudioContext=class{state='suspended';resume(){return new Promise((resolve,reject)=>{window.finishAudio=ok=>{if(ok){this.state='running';resolve();}else reject(Error('denied'));};});}close(){return Promise.resolve();}};});
 await page.goto('/timer.html');await page.locator('#timer-sound').check();await page.evaluate(()=>window.finishAudio(false));await expect(page.locator('#timer-sound-warning')).toContainText('Sound is unavailable');
 await page.locator('#timer-start').click();await expect(page.locator('#timer-pause')).toBeEnabled();await page.evaluate(()=>window.finishAudio(true));await expect(page.locator('#timer-sound-warning')).toHaveText('');
 await page.locator('#timer-reset').click();await page.locator('#timer-start').click();await page.locator('#timer-reset').click();await page.evaluate(()=>window.finishAudio(false));await expect(page.locator('#timer-sound-warning')).toHaveText('');
});
