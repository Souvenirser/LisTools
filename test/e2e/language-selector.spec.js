import {test,expect} from '@playwright/test';
import {selectLanguage} from './language-helpers.js';

test('Russian Cron translates the full interface like the calculator',async({page})=>{
  await page.goto('/cron.html');await selectLanguage(page,'ru');
  await expect(page.locator('h1')).toHaveText('Выражение Cron');
  await expect(page.locator('#cron-run')).toHaveText('Рассчитать даты');
  await expect(page.locator('#cron-status')).toContainText('10');
  await expect(page.locator('#cron-description')).not.toContainText('Every');
  await page.locator('#cron-auto').uncheck();await page.locator('#cron-expression').fill('61 * * * *');await page.locator('#cron-run').click();
  await expect(page.locator('#cron-error-message')).toContainText('61');await expect(page.locator('#cron-error-message')).not.toContainText('invalid');
});

test('calculator and Cron share identical language control geometry',async({page})=>{
  const metrics=[];
  for(const file of ['calculator','cron']) {
    await page.goto(`/${file}.html`);await selectLanguage(page,'zh-Hans');
    metrics.push(await page.locator('.language-control').evaluate(el=>{
      const s=getComputedStyle(el);return {display:s.display,gap:s.gap,top:s.marginBlockStart,bottom:s.marginBlockEnd};
    }));
  }
  expect(metrics[0]).toEqual(metrics[1]);expect(metrics[0].display).toBe('flex');expect(metrics[0].gap).toBe('8px');
});

test('Cron language changes preserve dates, generator edits and worker task',async({page})=>{
  await page.addInitScript(()=>{window.cronRequests=[];const Native=window.Worker;window.Worker=class extends Native{postMessage(data,...rest){if(data.input&&data.options?.dialect)window.cronRequests.push(data);return super.postMessage(data,...rest);}};});
  await page.goto('/cron.html');await expect(page.locator('#cron-dates tbody tr')).toHaveCount(10);
  await page.locator('.cron-builder summary').click();const value=page.locator('#cron-builder-fields input').first();await value.fill('17');
  const dates=await page.locator('#cron-dates tbody').textContent();const reference=await page.locator('#cron-result-context').textContent();
  const requests=await page.evaluate(()=>window.cronRequests.length);
  await selectLanguage(page,'ru');await page.waitForTimeout(550);
  expect(await page.evaluate(()=>window.cronRequests.length)).toBe(requests);
  expect(await page.locator('#cron-dates tbody').textContent()).toBe(dates.replaceAll('Copy','Копировать'));
  expect(await page.locator('#cron-result-context').textContent()).toContain(reference.split(': ').at(-1));
  await expect(value).toHaveValue('17');
});

test('fifty flag choices support search, keyboard selection and ordinary input focus',async({page})=>{
 await page.goto('/calculator.html');const control=page.locator('.language-control .choices');
 await control.click();await control.locator('input[type=search]').fill('en');await control.locator('[data-choice][data-value=en]').click();await expect(control).toHaveAttribute('aria-expanded','false');
 await control.click();await expect(control.locator('[data-choice][data-value]')).toHaveCount(50);
 const flags=await control.locator('[data-choice][data-value] img').evaluateAll(images=>images.map(img=>({url:img.src,alt:img.alt,hidden:img.getAttribute('aria-hidden'),width:img.width,height:img.height})));
 expect(new Set(flags.map(item=>item.url)).size).toBe(41);
 for(const flag of flags){expect(flag.url).toMatch(/\/assets\/[a-z]{2}-[^/]+\.svg$/);expect(flag.alt).toBe('');expect(flag.hidden).toBe('true');expect([flag.width,flag.height]).toEqual([20,15]);}
 for(const code of ['zh-Hans','zh-Hant'])expect(await control.locator(`[data-choice][data-value="${code}"] img`).getAttribute('src')).toContain('/cn-');
 const search=control.locator('input[type=search]');await search.fill('no-such-language-zzzz');await expect(control.locator('.has-no-results')).toContainText('No matching languages');
 await search.fill('Русский');await expect(control.locator('[data-choice][data-value]')).toHaveCount(1);await search.press('Enter');
 await expect(page.locator('html')).toHaveAttribute('lang','ru');await expect(control).toBeFocused();
 await expect(control.locator('.choices__list--single img')).toHaveAttribute('src',/\/ru-/);
 await control.press('Enter');await control.locator('input[type=search]').press('Escape');await expect(control).toBeFocused();
 await control.click();await page.locator('#expression').click();await page.waitForTimeout(100);await expect(page.locator('#expression')).toBeFocused();
});

test('language preference applies to this page and future loads only',async({page,context})=>{
 await page.goto('/calculator.html');const other=await context.newPage();await other.goto('/cron.html');
 await expect(other.locator('html')).toHaveAttribute('lang','en');await selectLanguage(page,'ru');
 await expect(other.locator('html')).toHaveAttribute('lang','en');await other.reload();await expect(other.locator('html')).toHaveAttribute('lang','ru');
 await page.reload();await expect(page.locator('.choices__list--single')).toHaveText('Русский');
 await other.close();
});

test('failed language loading restores the visible selection without clearing data',async({page})=>{
 await page.goto('/calculator.html');await page.locator('#expression').fill('123 + 456');
 await page.route('**/assets/ru-*.js',route=>route.abort());
 const control=page.locator('.language-control .choices');await control.click();await control.locator('input[type=search]').fill('ru');await control.locator('[data-choice][data-value=ru]').click();
 await expect(control.locator('.choices__list--single')).toHaveText('English');await expect(page.locator('html')).toHaveAttribute('lang','en');
 await expect(page.locator('#expression')).toHaveValue('123 + 456');await selectLanguage(page,'ar');
 await expect(page.locator('#expression')).toHaveValue('123 + 456');
});

test('an in-flight Cron result uses the active language without restarting the worker',async({page})=>{
 await page.addInitScript(()=>{
  window.cronRequests=0;const Native=window.Worker;
  window.Worker=class extends Native{
   postMessage(data,...rest){if(data.options?.dialect)window.cronRequests++;return super.postMessage(data,...rest);}
   set onmessage(handler){super.onmessage=event=>{if(event.data.dates)window.deliverCron=()=>handler(event);else handler(event);};}
  };
 });
 await page.goto('/cron.html');await expect.poll(()=>page.evaluate(()=>typeof window.deliverCron)).toBe('function');
 await selectLanguage(page,'ru');await expect(page.locator('#cron-cancel')).toBeEnabled();expect(await page.evaluate(()=>window.cronRequests)).toBe(1);
 await page.evaluate(()=>window.deliverCron());await expect(page.locator('#cron-status')).toHaveText('Найдено запусков: 10');await expect(page.locator('#cron-dates tbody tr')).toHaveCount(10);
});

test('all fifty Cron languages preserve calculated dates, exports and structured errors',async({page})=>{
 test.setTimeout(120000);
 const {languages}=await import('../../src/i18n-core.js');
 const {readFileSync}=await import('node:fs');
 await page.goto('/cron.html');await expect(page.locator('#cron-dates tbody tr')).toHaveCount(10);
 const dates=await page.locator('#cron-dates tbody tr').evaluateAll(rows=>rows.map(row=>[...row.cells].slice(0,4).map(cell=>cell.textContent)));
 async function exported(){const download=page.waitForEvent('download');await page.locator('#cron-download-json').click();return readFileSync(await (await download).path(),'utf8');}
 const before=await exported();
 for(const {code} of languages){
  const resource=JSON.parse(readFileSync(new URL(`../../src/locales/${code}.json`,import.meta.url)));
  await selectLanguage(page,code);await expect(page.locator('h1')).toHaveText(resource.cron.title);await expect(page.locator('#cron-run')).toHaveText(resource.cron.run);
  await expect(page.locator('#cron-fields tbody td').first()).toHaveText(resource.cron.fields.minute);
  await expect(page.locator('.choices__list--single bdi')).toHaveText(languages.find(item=>item.code===code).name);
  expect(await page.locator('#cron-dates tbody tr').evaluateAll(rows=>rows.map(row=>[...row.cells].slice(0,4).map(cell=>cell.textContent)))).toEqual(dates);
 }
 expect(await exported()).toBe(before);
 await page.locator('#cron-auto').uncheck();await page.locator('#cron-expression').fill('61 * * * *');await page.locator('#cron-run').click();await expect(page.locator('#cron-error')).toBeVisible();
 for(const {code} of languages){
  const resource=JSON.parse(readFileSync(new URL(`../../src/locales/${code}.json`,import.meta.url)));
  await selectLanguage(page,code);
  const expected=resource.cron.errors.field.replace('{{field}}',resource.cron.fields.minute).replace('{{value}}','61').replace('{{min}}','0').replace('{{max}}','59');
  await expect(page.locator('#cron-error-message')).toHaveText(expected);await expect(page.locator('#cron-copy-dates')).toBeDisabled();
 }
});

for(const width of [640,900,1440])test(`shared language controls stay aligned on all tool pages at ${width}px in LTR and RTL`,async({page})=>{
 test.setTimeout(120000);await page.setViewportSize({width,height:960});
 const {pages}=await import('../../src/tools/shared/navigation.js');const files=[...new Set(pages.filter(item=>!item.file.includes('#')).map(item=>item.file))];expect(files).toHaveLength(18);
 for(const code of ['zh-Hans','ar']){
  await page.goto('/calculator.html');await selectLanguage(page,code);
  for(const file of files){
   await page.goto(`/${file}`);await expect(page.locator('html')).toHaveAttribute('lang',code);
   const control=page.locator('.language-control .choices');await expect(control).toBeVisible();
   const metrics=await page.locator('.language-control').evaluate(element=>{
    const style=getComputedStyle(element),control=element.querySelector('.choices'),inner=element.querySelector('.choices__inner'),image=control.querySelector('img');
    const box=control.getBoundingClientRect();return {display:style.display,gap:style.gap,margin:style.marginBlock,top:box.top,bottom:box.bottom,left:box.left,right:box.right,height:box.height,font:getComputedStyle(inner).fontSize,imageLoaded:image.complete&&image.naturalWidth>0,overflow:document.documentElement.scrollWidth>innerWidth+2};
   });
   expect(metrics.display,file).toBe('flex');expect(metrics.gap,file).toBe('8px');expect(metrics.margin,file).toBe('0px');expect(metrics.height,file).toBe(38);expect(metrics.font,file).toBe('14px');expect(metrics.imageLoaded,file).toBe(true);expect(metrics.left,file).toBeGreaterThanOrEqual(0);expect(metrics.right,file).toBeLessThanOrEqual(width);expect(metrics.bottom,file).toBeLessThanOrEqual(72);expect(metrics.overflow,file).toBe(false);
  }
 }
});

test('late Cron description imports cannot replace the latest choice',async({page})=>{
 let release,held=false;const gate=new Promise(resolve=>{release=resolve;});
 await page.route('**/assets/ru-*.js',async route=>{
  const response=await route.fetch();
  if((await response.text()).includes('from"./cronstrue-')){held=true;await gate;}
  await route.fulfill({response});
 });
 try{
  await page.goto('/cron.html');await expect(page.locator('#cron-dates tbody tr')).toHaveCount(10);
  await selectLanguage(page,'ru');await expect.poll(()=>held).toBe(true);
  await selectLanguage(page,'hi');const description=await page.locator('#cron-description').textContent();release();
  await page.waitForLoadState('networkidle');await expect(page.locator('html')).toHaveAttribute('lang','hi');await expect(page.locator('#cron-description')).toHaveText(description);await expect(page.locator('.choices__list--single bdi')).toHaveText('हिन्दी');
 }finally{release();}
});

test('Cron weekday presets and month rules retain exact syntax and occurrence numbers',async({page})=>{
 test.setTimeout(60000);const {readFileSync}=await import('node:fs');
 await page.goto('/cron.html');await page.locator('.cron-builder summary').click();await page.locator('#cron-auto').uncheck();await page.locator('#cron-dialect').selectOption('quartz');await page.locator('#cron-zone').fill('UTC');await page.locator('#cron-reference').fill('2026-02-01T00:00:00Z');
 for(const code of ['zh-Hans','zh-Hant','en','ru','de','ar','hi','ja','ko','fr','fil']){
  await selectLanguage(page,code);const {cron}=JSON.parse(readFileSync(new URL(`../../src/locales/${code}.json`,import.meta.url)));
  const weekdays=await page.evaluate(locale=>{const f=new Intl.DateTimeFormat(locale,{weekday:'long',timeZone:'UTC'});return [1,5].map(day=>f.format(Date.UTC(2024,0,day))).join('–');},code);
  await expect(page.locator('[data-preset=weekdays]')).toHaveText(`${weekdays} 09:00`);
  for(const [expression,token,key] of [['0 0 9 LW * ?','LW','lastWeekday'],['0 0 9 1W * ?','1W','nearest'],['0 0 9 ? * MON#3','MON#3','nth'],['0 0 9 L-3 * ?','L-3','offset']]){
   await page.locator('#cron-expression').fill(expression);await page.locator('#cron-run').click();await expect(page.locator('#cron-dates tbody tr')).toHaveCount(10);
   const row=page.locator('#cron-fields tbody tr').filter({has:page.locator('td',{hasText:new RegExp('^'+token+'$')})});
   await expect(row.locator('td').last()).toHaveText(cron.meanings[key].replace('{{weekdays}}',weekdays).replace('{{n}}','3').replace('{{days}}','3'));
  }
  await page.locator('#cron-builder-load').click();const select=page.locator('#cron-builder-fields select').first();await select.selectOption('list');
  await expect(select.locator('option[value=every]')).toHaveText(cron.meanings.every);await expect(page.locator('#cron-builder-fields input').first()).toHaveAttribute('placeholder',/0,15,30/);
 }
});

test('a slow language package cannot revert a later successful selection',async({page})=>{
 let release,held=false;const gate=new Promise(resolve=>{release=resolve;});
 await page.route('**/assets/ru-*.js',async route=>{held=true;await gate;await route.continue();});
 try{
  await page.goto('/calculator.html');await page.locator('#expression').fill('9007199254740993123');
  const control=page.locator('.language-control .choices');await control.click();await control.locator('input[type=search]').fill('ru');await control.locator('[data-choice][data-value=ru]').click();await expect.poll(()=>held).toBe(true);
  await selectLanguage(page,'ar');release();await page.waitForLoadState('networkidle');await expect(page.locator('html')).toHaveAttribute('lang','ar');await expect(control.locator('.choices__list--single bdi')).toHaveText('العربية');await expect(page.locator('#expression')).toHaveValue('9007199254740993123');
 }finally{release();}
});
