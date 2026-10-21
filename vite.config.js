import { defineConfig } from 'vite';
import { pages } from './src/tools/shared/navigation.js';
import { extensionPolicy, pageConnectPolicy } from './src/tools/shared/policy.js';

export default defineConfig({
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
    target: ['chrome120','firefox140','safari18'], license: { fileName: 'THIRD_PARTY_LICENSES.md' },
    rolldownOptions: { input: { ...Object.fromEntries(pages.filter(page=>!page.file.includes('#')).map(page=>[page.id,page.file])), popup:'popup.html' } }
  }
});
