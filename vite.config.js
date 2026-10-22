import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { pages } from './src/tools/shared/navigation.js';
import { extensionPolicy, pageConnectPolicy } from './src/tools/shared/policy.js';

export default defineConfig({
  root: fileURLToPath(new URL('./pages', import.meta.url)),
  publicDir: fileURLToPath(new URL('./public', import.meta.url)),
  resolve: { alias: { '/src': fileURLToPath(new URL('./src', import.meta.url)) } },
  base: './',
  worker: { format: 'es' },
  plugins: [{name:'tool-page-network-policy',apply:'build',transformIndexHtml: {
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
    rolldownOptions: { input: { ...Object.fromEntries(pages.filter(page=>!page.file.includes('#')).map(page=>[page.id,fileURLToPath(new URL(`./pages/${page.file}`,import.meta.url))])), popup:fileURLToPath(new URL('./pages/popup.html',import.meta.url)) } }
  }
});
