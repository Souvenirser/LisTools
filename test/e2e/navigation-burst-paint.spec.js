import {test,expect,chromium} from '@playwright/test';
import {PNG} from 'pngjs';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';

for(const theme of ['dark','light'])test(`rapid sidebar navigation keeps actual workspace pixels visible (${theme})`,async({browserName,browser},testInfo)=>{
 test.skip(browserName!=='chromium','CDP screencast requires Chromium.');test.setTimeout(120000);
 const extension=process.env.LISTOOLS_BURST_EXTENSION&&resolve(process.env.LISTOOLS_BURST_EXTENSION);let profile,context;
 if(extension){profile=await mkdtemp(join(tmpdir(),'listools-burst-'));context=await chromium.launchPersistentContext(profile,{executablePath:process.env.LISTOOLS_EXTENSION_CHROME,headless:true,ignoreDefaultArgs:['--disable-extensions'],args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`],viewport:{width:1440,height:900}});}else context=await browser.newContext({viewport:{width:1440,height:900}});
 const id=extension&&[...createHash('sha256').update(extension).digest('hex').slice(0,32)].map(n=>'abcdefghijklmnop'[parseInt(n,16)]).join('');
 const base=extension?`chrome-extension://${id}`:testInfo.project.use.baseURL;
 try{
 await context.addInitScript(theme=>{localStorage.setItem('listools-language','zh-Hans');localStorage.setItem('listools-preferences-v1',JSON.stringify({theme}));localStorage.setItem('listools-menu-expanded-v1',JSON.stringify(['daily','files','developer','network']));},theme);
 const page=extension?context.pages()[0]:await context.newPage(),errors=[],frames=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base+'/dates.html');await page.locator('html[data-ui-state=ready]').waitFor();
 const cdp=await context.newCDPSession(page);let capturing=true;cdp.on('Page.screencastFrame',event=>{if(capturing)frames.push(Buffer.from(event.data,'base64'));void cdp.send('Page.screencastFrameAck',{sessionId:event.sessionId}).catch(()=>{});});
 await cdp.send('Page.startScreencast',{format:'png',maxWidth:960,maxHeight:600,everyNthFrame:1});
 for(const pair of [['units','dates'],['money','units'],['cron','convert']]){
  const positions={};for(const id of pair){const link=page.locator(`#tool-menu nav [data-tool-id="${id}"]`);await link.scrollIntoViewIfNeeded();positions[id]=await link.boundingBox();}
  // Capture positions again after the final scroll; the category itself must not move on navigation.
  for(const id of pair)positions[id]=await page.locator(`#tool-menu nav [data-tool-id="${id}"]`).boundingBox();
  for(let burst=0;burst<6;burst++){for(let n=0;n<8;n++){const p=positions[pair[n%2]];await page.mouse.click(p.x+60,p.y+p.height/2);await page.waitForTimeout(35);}await page.waitForTimeout(400);await expect(page.locator('html')).toHaveAttribute('data-ui-state','ready');await expect(page.frameLocator('iframe[data-workspace-active]').locator('main h1')).toBeVisible();}
 }
 await cdp.send('Page.stopScreencast');capturing=false;const blank=[];
 for(let n=0;n<frames.length;n++){const p=PNG.sync.read(frames[n]);let content=0;for(let y=Math.ceil(p.height*.1);y<p.height;y++)for(let x=Math.ceil(p.width*.22);x<p.width;x++){const i=(y*p.width+x)*4,r=p.data[i],g=p.data[i+1],b=p.data[i+2];if(theme==='dark'?Math.min(r,g,b)>100:Math.max(r,g,b)<180)content++;}if(content<100)blank.push({frame:n,content});}
 if(process.env.LISTOOLS_PAINT_EVIDENCE){const out=join(process.env.LISTOOLS_PAINT_EVIDENCE,theme);await mkdir(out,{recursive:true});await writeFile(join(out,'counts.json'),JSON.stringify({frames:frames.length,blank,errors},null,2));for(let n=0;n<frames.length;n++)await writeFile(join(out,`${String(n).padStart(4,'0')}.png`),frames[n]);}
 await testInfo.attach('paint-counts',{body:Buffer.from(JSON.stringify({frames:frames.length,blank,errors})),contentType:'application/json'});if(blank.length)await testInfo.attach('blank-frame',{body:frames[blank[0].frame],contentType:'image/png'});
 expect(frames.length).toBeGreaterThan(0);expect(blank).toEqual([]);expect(errors).toEqual([]);
 }finally{await context.close();if(profile)await rm(profile,{recursive:true,force:true});}
});
