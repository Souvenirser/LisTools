import { cp, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const output = await mkdtemp(path.join(tmpdir(), 'listools-diff-benchmark-'));
await cp(path.join(root, 'dist'), output, { recursive:true });
for (const name of ['diff-performance.html', 'diff-performance.js']) await cp(path.join(root, 'test/browser', name), path.join(output, name));
console.log(`验收目录：${output}`);
console.log(`node node_modules/vite/bin/vite.js preview --outDir '${output}' --host 127.0.0.1 --port 4192 --strictPort`);
console.log('打开 http://127.0.0.1:4192/diff-performance.html，使用 Chrome 执行首次和重复比较。');
