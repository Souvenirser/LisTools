import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {activeTool,evaluateTool,chooseTask} from './task-helpers.js';

test('JSON output actions show their names at wide and narrow viewport sizes', async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('listools-language', 'zh-Hans'));
  await page.goto('/index.html');
  const tool = activeTool(page);
  const source = '{"list":[3,1,2]}';
  await tool.locator('#auto-format').uncheck();
  await tool.locator('#source .cm-content').fill(source);
  await tool.locator('#format').click();
  const menu = tool.locator('#editor .jse-menu').first();
  const actions = ['格式化', '压缩', '排序', '转换', '撤销', '重做'];

  for (const width of [1366, 390, 320]) {
    await page.setViewportSize({width, height: 920});
    for (const name of actions) {
      await expect(menu.getByText(name, {exact: true})).toBeVisible({timeout: 3000});
    }
    const overflows = await menu.evaluate((node, names) => {
      const menuBounds = node.getBoundingClientRect();
      return [...node.querySelectorAll('button')]
        .filter(button => names.includes(button.textContent.trim()))
        .some(button => {
          const bounds = button.getBoundingClientRect();
          return bounds.left < menuBounds.left - 1 || bounds.right > menuBounds.right + 1;
        });
    }, actions);
    expect(overflows).toBe(false);
  }

  await menu.getByText('压缩', {exact: true}).click();
  await expect(tool.locator('#editor .cm-content')).toHaveText(source);
  await expect.poll(() => tool.locator('#source').evaluate(node => node.value)).toBe(source);
  await menu.getByText('撤销', {exact: true}).click();
  await expect(tool.locator('#editor .cm-content .cm-line')).toHaveCount(7);
});

test('JSON edits in the result immediately update the input and exports', async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('listools-language', 'en'));
  await page.goto('/index.html');
  const tool = activeTool(page);
  const original = '{"id":9007199254740993,"label":"original"}';
  const edited = '{\n  "id": 9007199254740993,\n  "label": "edited"\n}';
  await tool.locator('#auto-format').uncheck();
  await tool.locator('#source .cm-content').fill(original);
  await tool.locator('#format').click();
  const output = tool.locator('#editor .cm-content');
  await expect(output).toBeEditable({timeout: 2500});
  await output.fill('{"id":');
  await expect(tool.locator('#download')).toBeDisabled();
  await expect(output).toHaveText('{"id":');
  await expect(tool.locator('#source .cm-content')).toHaveText('{"id":', {timeout: 3000});

  await output.fill(edited);
  await expect(tool.locator('#download')).toBeEnabled();
  await expect.poll(() => tool.locator('#source').evaluate(node => node.value)).toBe(edited);
  await tool.locator('#format').click();
  await expect(tool.locator('#download')).toBeEnabled();
  await expect(output).toContainText('edited');
  await evaluateTool(page, () => Object.defineProperty(navigator.clipboard, 'writeText', {
    configurable: true, value: async text => { window.copiedJson = text; }
  }));
  await tool.locator('#copy').click();
  await expect.poll(() => evaluateTool(page, () => window.copiedJson)).toBe(edited);

  const [download] = await Promise.all([page.waitForEvent('download'), tool.locator('#download').click()]);
  const chunks = [];
  for await (const chunk of await download.createReadStream()) chunks.push(chunk);
  expect(Buffer.concat(chunks).toString('utf8')).toBe(edited);
  await tool.getByRole('button', {name: 'Tree', exact: true}).click();
  await expect(tool.locator('#editor')).toContainText('edited');
});

test('JSON input edits update the result with or without automatic formatting', async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('listools-language', 'en'));
  await page.goto('/index.html');
  const tool = activeTool(page);
  const input = tool.locator('#source .cm-content');
  const output = tool.locator('#editor .cm-content');
  await tool.locator('#auto-format').uncheck();
  await input.fill('{"state":"first"}');
  await tool.locator('#format').click();
  await expect(output).toContainText('first');

  await input.fill('{"state":');
  await expect(output).toHaveText('{"state":', {timeout: 3000});
  await expect(tool.locator('#download')).toBeDisabled();
  const raw = ' { "state" : "second" } ';
  await input.fill(raw);
  await expect.poll(() => output.textContent()).toBe(raw);
  await expect(tool.locator('#download')).toBeEnabled();

  await tool.locator('#auto-format').check();
  await input.fill('{"state":"auto"}');
  await expect(output.locator('.cm-line').nth(1)).toHaveText('  "state": "auto"');
  await expect(tool.locator('#download')).toBeEnabled();
});

const cases=[
  {name:'JSON',url:'/index.html',input:'#source',run:'#format',output:'#editor',copy:'#copy',state:'.output-panel',stateAttribute:'data-status',async setup(page){await activeTool(page).locator('#auto-format').uncheck();await activeTool(page).locator('#source .cm-content').fill('{"keep":true,"items":[1,2,3]}');}},
  {name:'diff',url:'/diff.html',input:'#inputs',run:'#compare',output:'#diff-view',state:'body',stateAttribute:'data-status',async setup(page){await activeTool(page).locator('#left-source .cm-content').fill('{"n":1}');await activeTool(page).locator('#right-source .cm-content').fill('{"n":2}');}},
  {name:'converter',url:'/convert.html#base64',input:'#convert-source',run:'#convert-run',output:'#convert-result',copy:'#convert-copy',state:'#convert-output-panel',stateAttribute:'data-status',async setup(page){await activeTool(page).locator('#convert-auto').uncheck();await activeTool(page).locator('#convert-source .cm-content').fill('same successful text');}},
  {name:'regex',url:'/regex.html',input:'#regex-source',run:'#regex-run',output:'#regex-output',copy:'#regex-copy',state:'#regex-status',stateAttribute:'data-task-state',async setup(page){await activeTool(page).locator('.task-help summary').click();await activeTool(page).locator('#regex-auto').uncheck();await chooseTask(page,'regex','match');await activeTool(page).locator('#regex-pattern').fill('ORDER-\\d+');await activeTool(page).locator('#regex-source .cm-content').fill('Alice ORDER-1024\nBob ORDER-2048');}}
];

for(const theme of ['light','dark'])for(const [width,height]of [[1366,768],[390,844]])for(const entry of cases)test(`${entry.name} keeps its successful result and editor geometry through repeated manual runs — ${theme} ${width}`,async({page,browserName})=>{
  let delayedWorkers=0;await page.route(/\/(?:src\/tools\/(?:json|json-diff|convert|regex)\/worker|assets\/worker-[^/?]+)\.js(?:\?.*)?$/,async route=>{const response=await route.fetch();delayedWorkers++;await route.fulfill({response,body:'const listoolsAuditPostMessage=self.postMessage.bind(self);self.postMessage=(...args)=>setTimeout(()=>listoolsAuditPostMessage(...args),180);\n'+await response.text()});});
  await page.setViewportSize({width,height});await page.addInitScript(theme=>{localStorage.setItem('listools-language','en');localStorage.setItem('listools-preferences-v1',JSON.stringify({theme}));},theme);await page.goto(entry.url);await entry.setup(page);await activeTool(page).locator(entry.run).click();await expect(activeTool(page).locator(entry.state)).toHaveAttribute(entry.stateAttribute,'ready');await page.waitForTimeout(220);
  if(entry.name==='diff'){await activeTool(page).locator(entry.run).evaluate(button=>{button.scrollIntoView({block:'center',behavior:'instant'});button.focus({preventScroll:true});});await page.waitForTimeout(50);}else await activeTool(page).locator(entry.run).focus();
  const config={input:entry.input,run:entry.run,output:entry.output,state:entry.state,stateAttribute:entry.stateAttribute};
  await evaluateTool(page,config=>{window.editorAuditConfig=config;window.editorAuditFrames=[];window.editorAuditSample=()=>{const config=window.editorAuditConfig,output=document.querySelector(config.output),content=output.querySelector('.cm-content')?.cloneNode(true);content?.querySelectorAll('.cm-placeholder').forEach(node=>node.remove());const text=content?.textContent??output.textContent;const nodes=Object.fromEntries(['input','run','output'].map(key=>{const element=document.querySelector(config[key]),rect=element.getBoundingClientRect();return[key,{top:rect.top,height:rect.height}];}));return {time:performance.now(),state:document.querySelector(config.state).getAttribute(config.stateAttribute),blank:!output.checkVisibility()||!text.trim(),nodes,scroll:{window:scrollY,main:document.querySelector('main').scrollTop,input:document.querySelector(config.input+' .cm-scroller')?.scrollTop||0,output:output.querySelector('.cm-scroller')?.scrollTop||0},focus:document.activeElement?.id||document.activeElement?.className};};},config);
  const baseline=await evaluateTool(page,()=>window.editorAuditSample());
  for(let attempt=0;attempt<3;attempt++){
    await evaluateTool(page,()=>{window.editorAuditRecording=true;const capture=()=>{if(!window.editorAuditRecording)return;window.editorAuditFrames.push(window.editorAuditSample());window.editorAuditFrame=requestAnimationFrame(capture);};window.editorAuditFrame=requestAnimationFrame(capture);});
    if(browserName==='webkit')await activeTool(page).locator(entry.run).press('Enter');else await activeTool(page).locator(entry.run).click();await expect(activeTool(page).locator(entry.state)).toHaveAttribute(entry.stateAttribute,'pending');if(entry.copy)await expect(activeTool(page).locator(entry.copy)).toBeDisabled();
    if(attempt===0)await page.screenshot({path:test.info().outputPath('pending.png')});await expect(activeTool(page).locator(entry.state)).toHaveAttribute(entry.stateAttribute,'ready');await page.waitForTimeout(220);await evaluateTool(page,()=>{window.editorAuditRecording=false;cancelAnimationFrame(window.editorAuditFrame);});
  }
  const frames=await evaluateTool(page,()=>window.editorAuditFrames),framePath=test.info().outputPath('editor-frames.json');await writeFile(framePath,JSON.stringify({name:entry.name,delayedWorkers,baseline,frames},null,2));await test.info().attach('editor-frames.json',{path:framePath,contentType:'application/json'});
  expect(delayedWorkers).toBeGreaterThanOrEqual(4);expect(frames.filter(frame=>frame.state==='pending').length).toBeGreaterThan(3);
  expect.soft(frames.filter(frame=>frame.blank).length,'no blank result frame after a successful run').toBe(0);
  for(const key of ['input','run','output'])for(const axis of ['top','height'])expect.soft(Math.max(...frames.map(frame=>Math.abs(frame.nodes[key][axis]-baseline.nodes[key][axis]))),`${key} ${axis} stays stable`).toBeLessThanOrEqual(1);
  expect.soft(frames.every(frame=>JSON.stringify(frame.scroll)===JSON.stringify(baseline.scroll)),'same-input reruns preserve scroll').toBe(true);expect.soft(frames.every(frame=>frame.focus===baseline.focus),'same-input reruns preserve focus').toBe(true);
});
