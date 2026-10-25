import {test,expect} from '@playwright/test';
import {selectLanguage} from './language-helpers.js';
import {tools} from '../../src/tools/convert/registry.js';
import {readdir,stat} from 'node:fs/promises';

test('JSON exposes cancellation during work and ignores a late cancelled result',async({page})=>{
  await page.addInitScript(()=>{const Native=window.Worker;window.Worker=class extends Native {postMessage(data){if(data.source!==undefined){const callback=this.onmessage;setTimeout(()=>callback?.({data:{status:'ready',text:'"late"',inputBytes:6,outputBytes:6,nodeCount:1}}),800);}else super.postMessage(data);}};});
  await page.goto('/index.html');await selectLanguage(page,'en');
  await page.locator('#auto-format').uncheck();await expect(page.locator('#json-cancel')).toBeHidden();
  await page.locator('#source').fill('{"keep":true}');await page.locator('#format').click();
  await expect(page.locator('#json-cancel')).toBeVisible();await page.locator('#json-cancel').click();
  await expect(page.locator('#json-cancel')).toBeHidden();await expect(page.locator('#source')).toHaveValue('{"keep":true}');
  await page.waitForTimeout(900);await expect(page.locator('#copy')).toBeDisabled();
});

test('conversion keeps one text and one file buffer while mode changes clear results',async({page})=>{
  await page.goto('/convert.html#base64');await selectLanguage(page,'en');await page.locator('#convert-auto').uncheck();
  await page.locator('#convert-source .cm-content').fill('parked text');
  await page.locator('#input-mode').selectOption('file');await page.locator('#convert-file').setInputFiles({name:'bytes.txt',mimeType:'text/plain',buffer:Buffer.from('file bytes')});
  await expect(page.locator('#convert-source .cm-content')).toHaveText('file bytes');await page.locator('#convert-run').click();await expect(page.locator('#convert-copy')).toBeEnabled();
  await page.locator('#input-mode').selectOption('text');await expect(page.locator('#convert-source .cm-content')).toHaveText('parked text');await expect(page.locator('#convert-copy')).toBeDisabled();
  await page.locator('#input-mode').selectOption('file');await expect(page.locator('#convert-input-info')).toContainText('bytes.txt');
  await expect(page.locator('#convert-source .cm-content')).toHaveText('file bytes');
});

test('all conversion tasks expose their own input, output and help',async({page})=>{
  await page.goto('/convert.html#html-entities');await selectLanguage(page,'en');
  await expect(page.locator('#convert-usage')).toContainText('HTML');await expect(page.locator('#tool-hint')).not.toContainText('Form components');
  const data=tools.map(tool=>({id:tool.id,usage:tool.usage,input:tool.input,output:tool.output}));
  expect(data).toHaveLength(37);for(const tool of data){expect(tool.usage,tool.id).toBeTruthy();expect(tool.input,tool.id).toBeTruthy();expect(tool.output,tool.id).toBeTruthy();}
});

test('MD5 shows compatibility explanation with other formats and replacement picker identifies files',async({page})=>{
  await page.goto('/convert.html#md5');await selectLanguage(page,'en');
  await expect(page.locator('#md5-other-formats #md5-truncated')).toHaveCount(1);await expect(page.locator('#md5-truncated')).toBeHidden();
  await expect(page.locator('#md5-values > .md5-value')).toHaveCount(1);
  await page.locator('#md5-mode').selectOption('files');await page.locator('#md5-files').setInputFiles({name:'named.txt',mimeType:'text/plain',buffer:Buffer.from('abc')});
  await expect(page.locator('#md5-choose')).toHaveText('Replace files');await page.locator('#md5-run').click();
  await expect(page.locator('#md5-file-rows button').first()).toHaveAccessibleName('Copy checksum for named.txt');
});

test('timestamp hides empty result formats and reveals a real result before extra formats',async({page})=>{
  await page.goto('/timestamp.html');await selectLanguage(page,'en');
  await expect(page.locator('#timestamp-panel .conversion-results')).toBeHidden();await expect(page.locator('#datetime-panel .conversion-results')).toBeHidden();
  await page.locator('#timestamp-source').fill('0');await expect(page.locator('#timestamp-local')).toHaveValue(/1970/);await expect(page.locator('#timestamp-more-formats')).toBeVisible();
  await expect(page.locator('#timestamp-more-formats')).not.toHaveAttribute('open','');
});

test('cron supports manual Enter and labels each copied execution as ISO',async({page})=>{
  await page.goto('/cron.html');await selectLanguage(page,'en');await page.locator('#cron-auto').uncheck();
  await page.locator('#cron-expression').fill('0 9 * * *');await page.locator('#cron-expression').press('Enter');
  await expect(page.locator('#cron-dates tbody tr')).toHaveCount(10);await expect(page.locator('#cron-dates tbody button').first()).toHaveText('Copy ISO');
  await expect(page.locator('#cron-dates thead th')).toHaveCount(3);
});

test('regex distinguishes no execution, zero matches and changed manual inputs',async({page})=>{
  await page.goto('/regex.html');await selectLanguage(page,'en');await page.locator('.task-help summary').click();await page.locator('#regex-auto').uncheck();
  await expect(page.locator('#regex-current')).toHaveText('Not run');await expect(page.locator('.regex-capture-title')).toBeHidden();
  await page.locator('#regex-pattern').fill('absent');await page.locator('#regex-source .cm-content').fill('sample');await page.locator('#regex-run').click();
  await expect(page.locator('#regex-current')).toHaveText('No matches');
  await page.locator('#regex-source .cm-content').fill('changed');await expect(page.locator('#regex-status')).toContainText('Inputs changed');
});

test('password Enter generates masked values and speed test discloses network use before start',async({page})=>{
  await page.goto('/password.html');await selectLanguage(page,'en');await page.locator('#password-length').fill('24');await page.locator('#password-length').press('Enter');
  await expect(page.locator('#password-results input[type="password"]')).toHaveCount(1);
  const external=[];page.on('request',request=>{if(/^https?:/.test(request.url())&&!request.url().startsWith('http://127.0.0.1:'))external.push(request.url());});
  await page.goto('/speedtest.html');await selectLanguage(page,'en');expect(external).toEqual([]);await expect(page.locator('#speed-network-notice')).toBeVisible();await expect(page.locator('#speed-budget')).toBeVisible();
  const positions=await page.locator('#speed-network-notice,#speed-start').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().top));expect(positions[0]).toBeLessThan(positions[1]);
});

test('cron reuses the searchable flag timezone selector and retains custom zones and offset reference',async({page})=>{
  await page.goto('/cron.html');await selectLanguage(page,'en');await page.locator('#cron-auto').uncheck();
  const picker=page.locator('.cron-timezone-controls .choices');await expect(picker).toBeVisible();await picker.click();
  await picker.locator('input[type="search"]').fill('China');await picker.locator('[data-choice][data-value="Asia/Shanghai"]').click();
  await expect(page.locator('#cron-zone')).toHaveValue('Asia/Shanghai');await expect(picker.locator('.choices__list--single img.timezone-flag')).toHaveCount(1);
  await page.locator('#cron-preview-settings summary').click();await page.locator('#cron-reference').fill('2026-01-01T00:00:00+08:00');await page.locator('#cron-run').click();await expect(page.locator('#cron-dates tbody tr')).toHaveCount(10);
  const before=await page.locator('#cron-next').textContent();await selectLanguage(page,'zh-Hans');await expect(page.locator('#cron-zone')).toHaveValue('Asia/Shanghai');await expect(page.locator('#cron-reference')).toHaveValue('2026-01-01T00:00:00+08:00');expect(await page.locator('#cron-next').textContent()).toContain(before.split(' · ').at(-1));
  await page.locator('#cron-custom-timezone summary').click();await page.locator('#cron-zone').fill('Etc/GMT+8');await page.locator('#cron-zone').press('Enter');await expect(page.locator('#cron-result-context')).toContainText('Etc/GMT+8');
});


test('regex text remains readable in bounded editors and mobile speed controls stack',async({page})=>{
  await page.goto('/regex.html');await selectLanguage(page,'en');
  for(const selector of ['#regex-pattern','#regex-source .cm-content','#regex-output .cm-content']){const style=await page.locator(selector).evaluate(node=>({font:parseFloat(getComputedStyle(node).fontSize),line:parseFloat(getComputedStyle(node).lineHeight)}));expect(style.font).toBeGreaterThanOrEqual(18);expect(style.line).toBeGreaterThanOrEqual(28);}
  const before=await page.locator('#regex-source').boundingBox();await page.locator('#regex-source .cm-content').fill(Array.from({length:100},(_,i)=>`line ${i}`).join('\n'));const after=await page.locator('#regex-source').boundingBox();expect(after.height).toBeLessThanOrEqual(before.height+2);
  await page.setViewportSize({width:390,height:844});await page.goto('/speedtest.html');
  const profile=await page.locator('#speed-profile').boundingBox(),unit=await page.locator('#speed-unit').boundingBox();expect(unit.y).toBeGreaterThanOrEqual(profile.y+profile.height);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('completed speed test folds settings into a summary and preserves illustrated ratings',async({page})=>{
  const candidates=await Promise.all((await readdir('dist/assets')).filter(name=>/^speedtest-.*\.js$/.test(name)).map(async name=>({name,size:(await stat('dist/assets/'+name)).size})));const sdk=candidates.sort((a,b)=>b.size-a.size)[0].name;
  let loads=0;await page.route(url=>url.pathname.includes('/node_modules/.vite/deps/@cloudflare_speedtest.js')||url.pathname.endsWith('/assets/'+sdk),route=>{loads++;return route.fulfill({contentType:'application/javascript',body:`export default class {
    results={getSummary:()=>({download:120e6,upload:55e6,latency:24,jitter:3}),getDownloadBandwidthPoints:()=>[{bps:120e6,duration:20,bytes:1024}],getUploadBandwidthPoints:()=>[{bps:55e6,duration:20,bytes:1024}],getUnloadedLatencyPoints:()=>[24,27]};
    play(){this.onResultsChange();addEventListener('direct-speed-finish',()=>this.onFinish(),{once:true});}pause(){}
  }`});});
  await page.goto('/speedtest.html');await selectLanguage(page,'en');expect(loads).toBe(0);await page.locator('#speed-start').click();
  await expect(page.locator('#speed-primary-metrics [data-metric="downloadBps"] strong')).toHaveText('15.00 MB/s');await page.evaluate(()=>dispatchEvent(new Event('direct-speed-finish')));
  await expect(page.locator('#speed-settings')).not.toHaveAttribute('open','');await expect(page.locator('#speed-settings-summary')).toContainText('MB/s');
  await expect(page.locator('[data-direction="download"]')).toHaveAttribute('data-level','train');await expect(page.locator('[data-direction="upload"]')).toHaveAttribute('data-level','car');await expect(page.locator('#speed-level-scale li')).toHaveCount(7);
  await page.locator('#speed-settings-summary').click();await page.locator('#speed-unit').selectOption('Mbps');await expect(page.locator('[data-direction="download"]')).toContainText('120.00 Mbps');
});

test('switching modes during file preview preserves both buffers and retries the preview',async({page})=>{
  await page.addInitScript(()=>{const read=Blob.prototype.arrayBuffer;Blob.prototype.arrayBuffer=async function(){await new Promise(resolve=>setTimeout(resolve,400));return read.call(this);};});
  await page.goto('/convert.html#base64');await selectLanguage(page,'en');await page.locator('#convert-auto').uncheck();await page.locator('#convert-source .cm-content').fill('parked');
  await page.locator('#convert-file').setInputFiles({name:'slow.txt',mimeType:'text/plain',buffer:Buffer.from('slow preview')});await page.locator('#input-mode').selectOption('text');
  await expect(page.locator('#convert-source .cm-content')).toHaveText('parked');await page.locator('#input-mode').selectOption('file');await expect(page.locator('#convert-source .cm-content')).toHaveText('slow preview');
});
