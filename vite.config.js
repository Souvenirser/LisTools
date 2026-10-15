import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  preview: {
    headers: { 'Content-Security-Policy': "script-src 'self'; object-src 'self'; style-src 'self' 'unsafe-inline'; worker-src 'self'; connect-src 'none'" }
  },
  build: {
    target: 'chrome120', license: { fileName: 'THIRD_PARTY_LICENSES.md' },
    rolldownOptions: { input: { main: 'index.html', diff: 'diff.html' } }
  }
});
