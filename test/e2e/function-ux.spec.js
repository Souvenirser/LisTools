import {test,expect} from '@playwright/test';
import {selectLanguage} from './language-helpers.js';
const workspace=page=>page.frameLocator('iframe[data-workspace-active]');

test('only Developer starts expanded and task search still finds the primary tool',async({page})=>{
 await page.goto('/qr.html');await page.locator('button.brand').click();await expect(page.locator('#tool-menu nav>details')).toHaveCount(4);
 await expect(page.locator('#tool-menu nav>details[open]')).toHaveCount(1);
 await page.goto('/popup.html');await expect(page.locator('nav>details[open]')).toHaveCount(1);
 await page.locator('#tool-menu-search').fill('deduplicate');await expect(page.locator('nav a').first()).toHaveAttribute('href','./text.html#dedupe');await expect(page.locator('nav a small').first()).not.toBeEmpty();
});

test('task addresses select all seven workspaces and retain input on subsequent task changes',async({page})=>{
 for(const [file,task,visible]of [['qr','recognize','#qr-drop'],['images','resize','#images-width'],['pdf','rotate','#pdf-rotation'],['dates','shift','#date-base'],['text','extract','#text-kind'],['draw','numbers','#draw-min'],['timer','stopwatch','#timer-lap']]){
  await page.goto(`/${file}.html#${task}`);if(['images','pdf'].includes(file))await expect(workspace(page).locator(file==='images'?'#images-task-select':'#pdf-mode')).toHaveValue(task);else await expect(workspace(page).locator(visible),file).toBeVisible();
 }
 await page.goto('/qr.html#generate');await workspace(page).locator('#qr-input').fill('keep');await workspace(page).locator('#qr-task-recognize').click();await expect(page).toHaveURL(/#recognize$/);await page.goBack();await expect(workspace(page).locator('#qr-input')).toHaveValue('keep');
 await selectLanguage(page,'de');await expect(workspace(page).locator('#qr-input')).toHaveValue('keep');
});

test('file workspaces start without empty queues and expose translated file actions',async({page})=>{
 for(const tool of ['images','pdf']){
  await page.goto(`/${tool}.html`);await expect(workspace(page).locator(`#${tool}-queue`).locator('..')).toBeHidden();await expect(workspace(page).locator(`#${tool}-choose`)).toBeVisible();await expect(workspace(page).locator(`#${tool}-files`)).toBeHidden();await expect(workspace(page).locator(`#${tool}-run`)).toBeHidden();
 }
 await workspace(page).locator('#pdf-files').setInputFiles({name:'one.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7')});await expect(workspace(page).locator('#pdf-queue')).toBeVisible();await expect(workspace(page).locator('#pdf-run')).toContainText('1');
});

test('text operations show full output counts and task-specific summaries',async({page})=>{
 await page.goto('/text.html#dedupe');await workspace(page).locator('#text-input').fill('Alice\nBob\nAlice');await workspace(page).locator('#text-run').click();await expect(workspace(page).locator('#text-operation-summary')).toContainText('3');await expect(workspace(page).locator('#text-operation-summary')).toContainText('2');
 await workspace(page).locator('#text-task-extract').click();await workspace(page).locator('#text-input').fill('a@example.com a@example.com');await workspace(page).locator('#text-run').click();await expect(workspace(page).locator('#text-operation-summary')).toContainText('1');await expect(workspace(page).locator('#text-result')).toHaveValue('a@example.com');
});

test('calculator starts at display zero without assigning Ans or history',async({page})=>{
 await page.goto('/calculator.html');await expect(workspace(page).locator('#expression')).toHaveValue('');await expect(workspace(page).locator('#result')).toHaveText('0');await expect(workspace(page).locator('#history')).toBeEmpty();await expect(workspace(page).locator('#copy')).toBeDisabled();await workspace(page).locator('#calculator-example').click();await expect(workspace(page).locator('#expression')).toHaveValue('200 + 10%');
});

test('date forms submit once with Enter and copy their calculation context',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.copiedText=text;}}});});
 await page.goto('/dates.html');await expect(workspace(page).locator('#date-origin')).toHaveValue('');await workspace(page).locator('#date-start').fill('2024-02-28');await workspace(page).locator('#date-end').fill('2024-03-01');await workspace(page).locator('#date-end').press('Enter');await expect(workspace(page).locator('#difference-output')).toContainText('Total days: 2');await workspace(page).locator('#difference-copy').click();expect(await workspace(page).locator('body').evaluate(()=>window.copiedText)).toContain('2024-02-28');expect(await workspace(page).locator('body').evaluate(()=>window.copiedText)).toContain('2024-03-01');
});

test('both unit directions offer searchable choices and retain precision on language changes',async({page})=>{
 await page.goto('/units.html');const pickers=workspace(page).locator('.unit-direction .choices');await expect(pickers).toHaveCount(2);await pickers.nth(1).click();await pickers.nth(1).locator('input[type=search]').fill('厘米');await pickers.nth(1).locator('[data-choice][data-value="cm"]').click();await workspace(page).locator('#unit-value').fill('0.1');await workspace(page).locator('#unit-value').press('Enter');await expect(workspace(page).locator('#unit-primary')).toContainText('10');await selectLanguage(page,'de');await expect(workspace(page).locator('#unit-to')).toHaveValue('cm');await expect(workspace(page).locator('#unit-primary')).toContainText('10');
});

test('money prioritizes Chinese uppercase while secondary representations stay available',async({page})=>{
 await page.goto('/money.html');await workspace(page).locator('#money-input').fill('123.456');await workspace(page).locator('#money-input').press('Enter');await expect(workspace(page).locator('.money-results .numeric-result-row').first().locator('output')).toHaveAttribute('id','money-simplified');await expect(workspace(page).locator('#money-other-formats')).not.toHaveAttribute('open');await expect(workspace(page).locator('#money-rounded')).toHaveText('123.46');await workspace(page).locator('#money-other-formats summary').click();await expect(workspace(page).locator('#copy-traditional')).toBeVisible();
});

test('draw groups have readable headings and timer has an hours/minutes/seconds duration label',async({page})=>{
 await page.goto('/draw.html');await workspace(page).locator('#draw-input').fill('A\nB\nC');await workspace(page).locator('#draw-mode').selectOption('groups');await workspace(page).locator('#draw-count').fill('2');await workspace(page).locator('#draw-run').click();await expect(workspace(page).locator('#draw-result .draw-group')).toHaveCount(2);await expect(workspace(page).locator('#draw-result h3').first()).toContainText('2');await page.goto('/timer.html');await expect(workspace(page).locator('#timer-settings > summary')).toHaveText('Set duration');
});

test('comparison exposes only its input pair until a real comparison succeeds',async({page})=>{
 await page.goto('/diff.html');await expect(workspace(page).locator('.diff-result')).toBeHidden();await expect(workspace(page).locator('.diff-navigation')).toBeHidden();await workspace(page).locator('#left-source .cm-content').fill('{"x":1}');await workspace(page).locator('#right-source .cm-content').fill('{"x":2}');await workspace(page).locator('#compare').click();await expect(workspace(page).locator('.diff-result')).toBeVisible();await expect(workspace(page).locator('.diff-navigation')).toBeVisible();
});

test('Cron switches parsing and visual building without discarding the expression',async({page})=>{
 await page.goto('/cron.html');await expect(workspace(page).locator('.cron-builder')).toBeHidden();await expect(workspace(page).locator('#cron-preview-settings')).not.toHaveAttribute('open');await workspace(page).locator('#cron-task-build').click();await expect(workspace(page).locator('#cron-builder-fields')).toBeVisible();await workspace(page).locator('#cron-task-parse').click();await expect(workspace(page).locator('#cron-expression')).toHaveValue('*/5 * * * *');await expect(workspace(page).locator('#cron-next')).not.toBeEmpty();
});

test('timestamp prioritizes output while preserving secondary formats and current clock',async({page})=>{
 await page.goto('/timestamp.html');await expect(workspace(page).locator('#clock-details')).not.toHaveAttribute('open');await expect(workspace(page).locator('.clock-quick-actions [data-copy=clock-seconds]')).toBeVisible();await workspace(page).locator('#timestamp-source').fill('0');await expect(workspace(page).locator('#timestamp-local')).not.toHaveValue('');await expect(workspace(page).locator('#timestamp-more-formats')).not.toHaveAttribute('open');await workspace(page).locator('#timestamp-more-formats summary').click();await expect(workspace(page).locator('#timestamp-utc')).toBeVisible();
});

test('regular expression rules open from the pattern and advanced tools remain clear',async({page})=>{
 await page.goto('/regex.html');await workspace(page).locator('#regex-rules-open').click();await expect(workspace(page).locator('#regex-rule-search')).toBeVisible();await workspace(page).locator('#regex-rule-search').fill('email');await expect(workspace(page).locator('#regex-rule-list button').first()).toBeVisible();
 await page.goto('/convert.html#base64');await expect(workspace(page).locator('#tool-hint')).not.toContainText('Base58');await page.goto('/password.html');await expect(workspace(page).locator('#password-plaintext')).toBeVisible();await page.goto('/speedtest.html');await expect(workspace(page).locator('#speed-chart-axis')).toHaveText('Sample number');
});

test('edited text keeps its stale notice after automatic statistics and unit swapping updates both visible choices',async({page})=>{
 await page.goto('/text.html');await workspace(page).locator('#text-input').fill('A\nA');await workspace(page).locator('#text-run').click();await expect(workspace(page).locator('#text-copy')).toBeEnabled();await workspace(page).locator('#text-input').fill('B\nB');await page.waitForTimeout(700);await expect(workspace(page).locator('#text-result')).toHaveValue('B');await expect(workspace(page).locator('#text-copy')).toBeEnabled();
 await page.goto('/units.html');await workspace(page).locator('#unit-swap').click();await expect(workspace(page).locator('#unit-from').locator('..').locator('.choices__item--selectable').first()).toContainText('km');await expect(workspace(page).locator('#unit-to').locator('..').locator('.choices__item--selectable').first()).toContainText('(m)');
});

test('idle pages expose no cancel action and PDF adjustment task keeps its group open',async({page})=>{
 for(const route of ['diff','convert','cron','regex','calculator','text','images','pdf','qr','speedtest']){await page.goto('/'+route+'.html');await expect(workspace(page).locator('button[id$="-cancel"]:visible,button#cancel:visible'),route).toHaveCount(0);}
 await page.goto('/pdf.html#rotate');await expect(workspace(page).locator('#pdf-task-adjustments')).toHaveAttribute('aria-pressed','true');await expect(workspace(page).locator('#pdf-task-rotate')).toBeVisible();
});
