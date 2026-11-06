// Keep the first visible document in its final language, route and layout.
import {embedded,connectWorkspace} from './tools/shared/workspace-frame.js';
import './workspace-frame.css';
const entries=import.meta.glob(['./main.js','./diff.js','./convert.js','./timestamp.js','./cron.js','./regex.js','./password.js','./calculator.js','./dates.js','./units.js','./money.js','./insurance.js','./tax.js','./draw.js','./timer.js','./text.js','./qr.js','./images.js','./pdf.js','./speedtest.js','./popup.js']);
try {
  if(document.body.dataset.entry!=='popup')await import('./style.css');
  if(!embedded&&!['popup','support'].includes(document.body.dataset.entry)){
    const {mountWorkspace}=await import('./workspace-host.js');await mountWorkspace();
  }else{
  if(embedded){document.documentElement.dataset.workspaceEmbedded='';connectWorkspace();}
  await entries[`./${document.body.dataset.entry}.js`]();
  const workspace=document.body.dataset.entry!=='popup'?await import('./i18n.js'):undefined;
  await workspace?.prepareWorkspace();
  if(!embedded)await new Promise(resolve=>document.hidden?setTimeout(resolve,0):requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  // The header observer must establish the final scroll range before restoration.
  workspace?.restoreWorkspaceNavigation();
  window.LisToolsBoot?.ready();
  if(embedded)parent.LisToolsWorkspace?.ready(window.frameElement);
  }
} catch(error) {
  window.LisToolsBoot?.fail();
  if(embedded)parent.LisToolsWorkspace?.failed(window.frameElement);
  console.error('LisTools page initialization failed',error);
}
