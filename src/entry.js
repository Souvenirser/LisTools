// Keep the first visible document in its final language, route and layout.
import {embedded,connectWorkspace} from './tools/shared/workspace-frame.js';
import {mountSalaryBootstrap} from './tools/shared/salary-bootstrap.js';
import './workspace-frame.css';
const entries=import.meta.glob(['./main.js','./diff.js','./convert.js','./timestamp.js','./cron.js','./regex.js','./password.js','./calculator.js','./dates.js','./units.js','./money.js','./insurance.js','./tax.js','./draw.js','./timer.js','./salary.js','./text.js','./qr.js','./images.js','./pdf.js','./speedtest.js','./popup.js']);
try {
  const entry=document.body.dataset.entry;
  if(entry!=='popup')await import('./style.css');
  if(!embedded&&!['popup','support','salary'].includes(entry)){
    const {mountWorkspace}=await import('./workspace-host.js');await mountWorkspace();
  }else{
  if(embedded){document.documentElement.dataset.workspaceEmbedded='';connectWorkspace();}
  await entries[`./${entry}.js`]();
  const workspace=entry!=='popup'?await import('./i18n.js'):undefined;
  await workspace?.prepareWorkspace();
  if(!embedded)await new Promise(resolve=>document.hidden?setTimeout(resolve,0):requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  // The header observer must establish the final scroll range before restoration.
  workspace?.restoreWorkspaceNavigation();
  window.LisToolsBoot?.ready();
  if(embedded)parent.LisToolsWorkspace?.ready(window.frameElement);
  }
  if(!embedded&&entry!=='popup')mountSalaryBootstrap();
} catch(error) {
  window.LisToolsBoot?.fail();
  if(embedded)parent.LisToolsWorkspace?.failed(window.frameElement);
  console.error('LisTools page initialization failed',error);
}
