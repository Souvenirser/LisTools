import {test,expect} from '@playwright/test';
async function setup(page,theme='dark'){
 await page.setViewportSize({width:1440,height:900});
 await page.addInitScript(theme=>{localStorage.setItem('listools-language','zh-Hans');localStorage.setItem('listools-preferences-v1',JSON.stringify({theme}));window.startFrames=[];let last='';const end=performance.now()+1500;function record(){const m=document.querySelector('main'),h=document.querySelector('h1'),b=document.getElementById('format');if(m&&h&&getComputedStyle(m).visibility!=='hidden'&&getComputedStyle(document.body).visibility!=='hidden'&&h.textContent){const v={title:h.textContent,button:b?.textContent,x:m.getBoundingClientRect().x};const s=JSON.stringify(v);if(s!==last){startFrames.push(v);last=s;}}if(performance.now()<end)requestAnimationFrame(record);}requestAnimationFrame(record);},theme);
}
test('first visible JSON frame already has final text and sidebar geometry',async({page})=>{
 await setup(page);await page.goto('/index.html');await page.locator('#source .cm-content').waitFor();await page.waitForTimeout(200);
 const frames=await page.evaluate(()=>window.startFrames);expect(frames.length).toBeGreaterThan(0);for(const frame of frames){expect(frame.title).toBe('JSON 解析与格式化');expect(frame.button).toBe('格式化');expect(frame.x).toBe(256);}
});
test('dark JSON caret is readable and edit toolbar reuses editor history',async({page,context,browserName})=>{
 await setup(page);await page.goto('/index.html');const editor=page.locator('#source .cm-content');await editor.click();expect(await editor.evaluate(n=>getComputedStyle(n).caretColor)).not.toBe('rgb(0, 0, 0)');
 await expect(page.locator('#json-edit')).toBeVisible();await editor.fill('{"中文":"头中尾", "invalid": }');const text=await editor.innerText();await page.locator('#json-edit').click();await page.locator('#json-edit-select-all').click();await page.keyboard.type('replacement');await page.locator('#json-edit').click();await page.locator('#json-edit-undo').click();await expect(editor).toHaveText(text);await expect(editor).toBeFocused();
 if(browserName==='chromium')await context.grantPermissions(['clipboard-read','clipboard-write']);else await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>window.copiedInput=value}}));await page.locator('#json-copy-input').click();expect(await page.evaluate(browserName=>browserName==='chromium'?navigator.clipboard.readText():window.copiedInput,browserName)).toBe(text);
});
test('fast text rerun does not flash a processing notice',async({page})=>{
 await setup(page);await page.goto('/text.html');await page.locator('#text-input').fill('A\nB\nA');await expect(page.locator('#text-copy')).toBeEnabled();
 await page.evaluate(()=>{window.processingFlashes=[];const node=document.getElementById('tool-status');const end=performance.now()+500;function frame(){if(!node.hidden&&getComputedStyle(node).visibility!=='hidden'&&node.textContent.includes('处理中'))processingFlashes.push(node.textContent);if(performance.now()<end)requestAnimationFrame(frame);}requestAnimationFrame(frame);});
 await page.locator('#text-run').click();await expect(page.locator('#text-copy')).toBeEnabled();await page.waitForTimeout(550);expect(await page.evaluate(()=>processingFlashes)).toEqual([]);
});

test('slow startup offers recovery and then reveals the initialized page',async({page})=>{
 await setup(page);let release;const held=new Promise(resolve=>release=resolve);
 await page.route('**/assets/main-*.js',async route=>{await held;await route.continue();});
 await page.goto('/index.html',{waitUntil:'commit'});
 await expect(page.locator('#page-boot')).toBeVisible();await expect(page.locator('main')).toBeHidden();
 await expect(page.locator('#page-boot button')).toBeVisible({timeout:5000});release();
 await expect(page.locator('html')).toHaveAttribute('data-ui-state','ready');await expect(page.locator('#page-boot')).toHaveCount(0);await expect(page.locator('#json-edit')).toBeVisible();
});
test('failed tool script offers a visible reload action',async({page})=>{
 await setup(page);await page.route('**/assets/main-*.js',route=>route.abort());await page.goto('/index.html');
 await expect(page.locator('html')).toHaveAttribute('data-ui-state','failed');await expect(page.locator('#page-boot button')).toBeVisible();
});
test('failed preferred language falls back to English before showing content',async({page})=>{
 await setup(page);await page.route('**/assets/zh-Hans-*.js',route=>route.abort());await page.goto('/index.html');
 await expect(page.locator('html')).toHaveAttribute('data-ui-state','ready');await expect(page.locator('html')).toHaveAttribute('lang','en');await expect(page.locator('#format')).toHaveText('Format');
});
test('slow text feedback retains immediate cancellation and cannot return after cancel',async({page})=>{
 await setup(page);await page.addInitScript(()=>{const Native=Worker;window.Worker=class extends Native{set onmessage(handler){super.onmessage=event=>setTimeout(()=>handler(event),450);}};});
 await page.goto('/text.html');await page.locator('#text-input').evaluate(n=>n.value='A\nA');await page.locator('#text-run').click();
 await expect(page.locator('#text-cancel')).toBeEnabled();await expect(page.locator('#text-run')).toHaveAttribute('aria-busy','true');await expect(page.locator('#tool-status')).toBeVisible();
 await page.locator('#text-cancel').click();await expect(page.locator('#tool-status')).toHaveAttribute('data-task-state','cancelled');await page.waitForTimeout(600);await expect(page.locator('#tool-status')).toHaveAttribute('data-task-state','cancelled');
});
test('reduced motion disables entry and menu transitions; Escape restores edit trigger',async({page})=>{
 await setup(page);await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/index.html');await page.locator('#json-edit').click();await page.keyboard.press('Escape');await expect(page.locator('#json-edit')).toBeFocused();
 expect(await page.locator('main').evaluate(n=>getComputedStyle(n).animationName)).toBe('none');
});
test('initial focus toolbar is included in readiness, even when its chunk is slow',async({page})=>{
 await setup(page);let release;const held=new Promise(resolve=>release=resolve);await page.route('**/assets/focus-*.js',async route=>{await held;await route.continue();});await page.goto('/text.html',{waitUntil:'commit'});await expect(page.locator('#page-boot')).toBeVisible();await expect(page.locator('html')).toHaveAttribute('data-ui-state','booting');release();await expect(page.locator('html')).toHaveAttribute('data-ui-state','ready');await expect(page.locator('#workspace-focus')).toBeVisible();
});
test('short PDF progress events do not bypass delayed feedback',async({page})=>{
 await setup(page);await page.addInitScript(()=>{window.Worker=class{postMessage(request){setTimeout(()=>this.onmessage?.({data:{taskId:request.taskId,event:'progress',done:1,total:2}}),50);setTimeout(()=>this.onmessage?.({data:{taskId:request.taskId,status:'error',code:'pdf.encrypted'}}),150);}terminate(){}};});
 await page.goto('/pdf.html');await page.locator('#pdf-files').setInputFiles({name:'test.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7\nfixture')});
 await page.evaluate(()=>{window.earlyProgress=[];const start=performance.now();function frame(){const node=document.getElementById('tool-status');if(node.dataset.taskState==='pending'&&getComputedStyle(node).visibility!=='hidden')earlyProgress.push(node.textContent);if(performance.now()-start<400)requestAnimationFrame(frame);}requestAnimationFrame(frame);});
 await page.locator('#pdf-run').click();await expect(page.locator('#tool-status')).toHaveClass(/is-error/);expect(await page.evaluate(()=>earlyProgress)).toEqual([]);
});
