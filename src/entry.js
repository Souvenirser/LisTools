// Keep the first visible document in its final language, route and layout.
const entries=import.meta.glob(['./main.js','./diff.js','./convert.js','./timestamp.js','./cron.js','./regex.js','./password.js','./calculator.js','./dates.js','./units.js','./money.js','./insurance.js','./tax.js','./draw.js','./timer.js','./text.js','./qr.js','./images.js','./pdf.js','./speedtest.js','./popup.js']);
try {
  if(document.body.dataset.entry!=='popup')await import('./style.css');
  await entries[`./${document.body.dataset.entry}.js`]();
  const workspace=document.body.dataset.entry!=='popup'?await import('./i18n.js'):undefined;
  await workspace?.prepareWorkspace();
  await new Promise(resolve=>document.hidden?setTimeout(resolve,0):requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  // The header observer must establish the final scroll range before restoration.
  workspace?.restoreWorkspaceNavigation();
  window.LisToolsBoot?.ready();
} catch(error) {
  window.LisToolsBoot?.fail();
  console.error('LisTools page initialization failed',error);
}
