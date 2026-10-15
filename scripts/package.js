import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { zipSync, unzipSync } from 'fflate';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const manifest = JSON.parse(await readFile(path.join(dist, 'manifest.json'), 'utf8'));
assert.equal(manifest.version, pkg.version, 'package 和 manifest 版本必须一致');
assert.equal(manifest.manifest_version, 3);
assert.ok(!manifest.permissions?.length && !manifest.host_permissions?.length);

// Vite 的主入口许可报告不包含仅由 Worker 引用的依赖。
const licensePath = path.join(dist, 'THIRD_PARTY_LICENSES.md');
let licenses = await readFile(licensePath, 'utf8');
for (const [name, license] of [['microdiff', 'LICENSE'], ['jsonc-parser', 'LICENSE.md']]) {
  if (licenses.includes(`## ${name} - `)) continue;
  const directory = path.join(root, 'node_modules', name);
  const dependency = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
  licenses += `\n## ${name} - ${dependency.version} (${dependency.license})\n\n${await readFile(path.join(directory, license), 'utf8')}\n`;
}
await writeFile(licensePath, licenses);
await writeFile(path.join(dist, 'LICENSE'), await readFile(path.join(root, 'LICENSE')));

const files = {};
async function collect(directory, prefix = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) await collect(path.join(directory, entry.name), relative);
    else files[relative] = new Uint8Array(await readFile(path.join(directory, entry.name)));
  }
}
await collect(dist);
for (const name of ['index.html', 'diff.html', 'THIRD_PARTY_LICENSES.md', manifest.background.service_worker, ...Object.values(manifest.icons)]) {
  assert.ok(files[name], `扩展缺少资源：${name}`);
}
for (const entry of ['index.html', 'diff.html']) {
  const html = new TextDecoder().decode(files[entry]);
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (match[1].startsWith('http')) throw new Error(`不允许外部资源：${match[1]}`);
    assert.ok(files[match[1].replace(/^\.\//, '')], `${entry} 入口引用丢失：${match[1]}`);
  }
}
const archive = zipSync(files, { level: 6 });
assert.ok(unzipSync(archive)['manifest.json'], 'ZIP 根目录必须包含 manifest.json');
await mkdir(path.join(root, 'releases'), { recursive: true });
const output = path.join(root, 'releases', `LisTools-${pkg.version}.zip`);
await writeFile(output, archive);
console.log(`Chrome 扩展：${dist}`);
console.log(`发布 ZIP：${output} (${(archive.length / 1024 / 1024).toFixed(2)} MB)`);
