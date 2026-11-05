import {test,expect} from '@playwright/test';

async function ready(page){await page.goto('/popup.html');await expect(page.locator('html')).toHaveAttribute('data-ui-state','ready');await page.waitForTimeout(260);}
async function fold(page){return page.locator('details[data-group-id="daily"]>summary').evaluate(node=>new Promise(resolve=>{
 const frames=[],start=performance.now();node.click();function sample(){frames.push({height:document.body.getBoundingClientRect().height,group:node.parentElement.getBoundingClientRect().height,bottom:document.querySelector('.tool-menu-footer').getBoundingClientRect().bottom});if(performance.now()-start<360)requestAnimationFrame(sample);else resolve(frames);}sample();
}));}

test('popup expansion and collapse have intermediate heights instead of a single jump',async({page})=>{
 await page.setViewportSize({width:360,height:900});await ready(page);
 test.skip(!await page.evaluate(()=>CSS.supports('interpolate-size','allow-keywords')&&CSS.supports('interactivity','inert')),'Native height interpolation is a progressive enhancement; fallback folding is covered by menu-expansion.');
 const closed=await page.locator('body').evaluate(n=>n.getBoundingClientRect().height),opening=await fold(page),expanded=opening.at(-1).height;
 expect(expanded).toBeGreaterThan(closed+50);expect(expanded).toBeLessThanOrEqual(560);
 expect(opening.filter(f=>f.height>closed+2&&f.height<expanded-2).length).toBeGreaterThan(2);
 const closing=await fold(page);expect(closing.filter(f=>f.height>closed+2&&f.height<expanded-2).length).toBeGreaterThan(2);
 expect(Math.abs(closing.at(-1).height-closed)).toBeLessThanOrEqual(1);
 for(const f of [...opening,...closing])expect(f.bottom).toBeLessThanOrEqual(561);
});

test('constrained popup footer remains visible through rapid reversal and final collapse',async({page})=>{
 await page.setViewportSize({width:360,height:440});await ready(page);
 for(const frames of [await fold(page),await fold(page)])for(const frame of frames)expect(frame.bottom).toBeLessThanOrEqual(441);
 await page.locator('details[data-group-id="daily"]>summary').evaluate(node=>{node.click();setTimeout(()=>node.click(),50);setTimeout(()=>node.click(),80);});
 await page.waitForTimeout(350);await expect(page.locator('details[data-group-id="daily"]')).toHaveJSProperty('open',true);
 await expect(page.locator('.tool-menu-footer .feedback-link')).toBeInViewport();
});

for(const {height,scale} of [{height:440,scale:1},{height:600,scale:1.25}])test(`an extension popup constrained by Chrome (${height}px, ${scale} scale) keeps its footer in view and only the list scrolls`,async({page})=>{
 await page.addInitScript(()=>{window.chrome??={};window.chrome.runtime??={};window.chrome.runtime.id='popup-viewport-regression';});
 await page.setViewportSize({width:Math.ceil(360*scale),height});await ready(page);await page.evaluate(scale=>document.documentElement.style.zoom=scale,scale);
 await fold(page);
 const sizes=await page.evaluate(()=>({body:document.body.getBoundingClientRect().height,viewport:innerHeight,footer:document.querySelector('.tool-menu-footer').getBoundingClientRect().bottom,list:document.querySelector('.tool-menu-scroll').scrollHeight-document.querySelector('.tool-menu-scroll').clientHeight}));
 expect(sizes.footer).toBeLessThanOrEqual(sizes.viewport+1);expect(sizes.body).toBeLessThanOrEqual(sizes.viewport+1);expect(sizes.list).toBeGreaterThan(0);
 expect(sizes.body).toBeLessThanOrEqual(561);
 await page.locator('.tool-menu-scroll').evaluate(node=>node.scrollTop=node.scrollHeight);
 await expect(page.locator('details[data-group-id="network"]>summary')).toBeInViewport();await expect(page.locator('.tool-menu-footer .feedback-link')).toBeInViewport();
});

test('a fresh tool tab keeps its shell opaque while the work area arrives',async({page})=>{
 await page.addInitScript(()=>{window.entryFrames=[];function frame(){if(document.documentElement.dataset.uiState==='ready')entryFrames.push({body:Number(getComputedStyle(document.body).opacity),main:Number(getComputedStyle(document.querySelector('main')).opacity)});if(entryFrames.length<24)requestAnimationFrame(frame);}requestAnimationFrame(frame);});
 await page.goto('/tax.html');await expect(page.locator('html')).toHaveAttribute('data-ui-state','ready');await page.waitForTimeout(400);
 const frames=await page.evaluate(()=>entryFrames);expect(frames.some(f=>f.main<1)).toBe(true);for(const frame of frames){expect(frame.body).toBe(1);expect(frame.main).toBeGreaterThanOrEqual(.95);}expect(frames.at(-1).main).toBe(1);
 await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await expect(page.locator('html')).toHaveAttribute('data-ui-state','ready');expect(await page.locator('main').evaluate(n=>getComputedStyle(n).animationName)).toBe('none');
});
