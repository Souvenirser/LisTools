import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import {readFileSync} from 'node:fs';
import {languages,matchLanguage,preferredLanguage} from './src/i18n-core.js';
import { pages } from './src/tools/shared/navigation.js';
import { extensionPolicy, pageConnectPolicy } from './src/tools/shared/policy.js';

// The tiny synchronous startup catalog is derived from the same locale resources.
function bootLabels(){
 const labels=Object.fromEntries(languages.map(({code})=>[code,JSON.parse(readFileSync(new URL(`./src/locales/${code}.json`,import.meta.url),'utf8')).motion]));
 return `(()=>{const labels=${JSON.stringify(labels)},supported=new Set(Object.keys(labels));${matchLanguage.toString()};${preferredLanguage.toString()};window.LisToolsBootCatalog={labels,preferred:preferredLanguage};})();`;
}

export default defineConfig({
  root: fileURLToPath(new URL('./pages', import.meta.url)),
  publicDir: fileURLToPath(new URL('./public', import.meta.url)),
  resolve: { alias: { '/src': fileURLToPath(new URL('./src', import.meta.url)) } },
  base: './',
  worker: { format: 'es' },
  plugins: [{name:'boot-labels',configureServer(server){server.middlewares.use('/boot-labels.js',(_req,res)=>{res.setHeader('Content-Type','application/javascript');res.end(bootLabels());});},generateBundle(){this.emitFile({type:'asset',fileName:'boot-labels.js',source:bootLabels()});}}, {name:'tool-page-network-policy',apply:'build',transformIndexHtml: {
    order:'pre',handler(_html,context) {
      return [{tag:'meta',attrs:{'http-equiv':'Content-Security-Policy',content:pageConnectPolicy(context.filename)},injectTo:'head-prepend'}];
    }
  }}],
  preview: {
    headers: { 'Content-Security-Policy': extensionPolicy }
  },
  build: {
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
    emptyOutDir: true,
    target: ['chrome120','firefox140','safari18'], license: { fileName: 'THIRD_PARTY_LICENSES.md' },
    rolldownOptions: { input: { ...Object.fromEntries(pages.filter(page=>!page.file.includes('#')).map(page=>[page.id,fileURLToPath(new URL(`./pages/${page.file}`,import.meta.url))])), popup:fileURLToPath(new URL('./pages/popup.html',import.meta.url)), } }
  }
});
