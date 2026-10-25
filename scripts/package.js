import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { zipSync, unzipSync } from 'fflate';
import { decodeHTML } from 'entities';
import { pages } from '../src/tools/shared/navigation.js';
import { extensionPolicy, pageConnectPolicy } from '../src/tools/shared/policy.js';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const manifest = JSON.parse(await readFile(path.join(dist, 'manifest.json'), 'utf8'));
assert.equal(manifest.version, pkg.version, 'package 和 manifest 版本必须一致');
assert.equal(manifest.manifest_version, 3);
assert.ok(!manifest.permissions?.length && !manifest.host_permissions?.length);
assert.equal(manifest.content_security_policy.extension_pages,extensionPolicy);
assert.equal(manifest.action.default_popup,'popup.html');
assert.ok(!manifest.background, '工具菜单不需要后台脚本');
assert.ok(manifest.browser_specific_settings.gecko.id);
assert.deepEqual(manifest.browser_specific_settings.gecko.data_collection_permissions,{required:['none']});
assert.ok(manifest.browser_specific_settings.safari.strict_min_version);
const entries=[...pages.filter(page=>!page.file.includes('#')).map(page=>page.file),manifest.action.default_popup];

// Vite 的主入口许可报告不包含仅由 Worker 引用的依赖。
const licensePath = path.join(dist, 'THIRD_PARTY_LICENSES.md');
let licenses = await readFile(licensePath, 'utf8');
const workerDependencies = ['microdiff','jsonc-parser','diff','@radix-ui/colors','i18next','@scure/base','entities','jsesc','@kayahr/text-encoding','yaml','fast-xml-parser','papaparse','@noble/hashes','crc-32','change-case','decimal.js','colord','fflate','@cloudflare/speedtest','croner','cronstrue','choices.js','flag-icons','nanoid','@eslint-community/regexpp','mathjs','qrcode','jsqr','cropperjs','browser-image-compression','pdf-lib','nzh','sortablejs'];
const supplemental = { 'change-case':'change-case-5.4.4.LICENSE', '@nodable/entities':'nodable-entities-3.1.0.LICENSE' };
const visited = new Set();
async function locatePackage(name,from) {
  let cursor=from;
  for (;;) {
    const directory=path.join(cursor,'node_modules',name);
    try { return {directory,dependency:JSON.parse(await readFile(path.join(directory,'package.json'),'utf8'))}; }
    catch(error) { if(error.code!=='ENOENT') throw error; }
    const parent=path.dirname(cursor);
    if(parent===cursor) throw new Error(`缺少依赖：${name}`);
    cursor=parent;
  }
}
async function addLicense(name,from=root) {
  const {directory,dependency}=await locatePackage(name,from);
  const identity=`${name}@${dependency.version}`;
  if (visited.has(identity)) return;
  visited.add(identity);
  const supplement=supplemental[identity] || supplemental[name];
  if (!licenses.includes(`## ${name} - ${dependency.version} (`)) {
    const names = await readdir(directory);
    const license = names.find(file => /^(license|licence|copying)([.\-]|$)/i.test(file));
    assert.ok(license || supplement, `缺少许可证正文：${identity}`);
    const body = await readFile(license ? path.join(directory,license) : path.join(root,'licenses',supplement),'utf8');
    licenses += `\n## ${name} - ${dependency.version} (${dependency.license})\n\n${body}\n`;
    for (const notice of names.filter(file => /^notice([.\-]|$)/i.test(file))) licenses += `\n${await readFile(path.join(directory,notice),'utf8')}\n`;
  }
  for (const child of Object.keys(dependency.dependencies || {})) await addLicense(child,directory);
}
for (const name of workerDependencies) await addLicense(name);
const wordlistDirectory=path.join(root,'src/tools/password/data');
const wordlistNotice=await readFile(path.join(wordlistDirectory,'NOTICE.txt'),'utf8');
const wordlistLicense=await readFile(path.join(wordlistDirectory,'LICENSE-CC-BY-4.0.txt'),'utf8');
licenses+=`\n## EFF Large Wordlist (CC-BY-4.0)\n\n${wordlistNotice}\n\n${wordlistLicense}\n`;
licenses+=`\n## Lucide static SVG subset - 1.61.0 (ISC; Feather MIT)\n\n${await readFile(path.join(root,'licenses/lucide-1.61.0.LICENSE'),'utf8')}\n`;
await writeFile(licensePath, licenses);
await writeFile(path.join(dist, 'LICENSE'), await readFile(path.join(root, 'LICENSE')));
await writeFile(path.join(dist,'THIRD_PARTY_NOTICES.md'),await readFile(path.join(root,'THIRD_PARTY_NOTICES.md')));

const files = {};
async function collect(directory, prefix = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) await collect(path.join(directory, entry.name), relative);
    else files[relative] = new Uint8Array(await readFile(path.join(directory, entry.name)));
  }
}
await collect(dist);
for (const name of [...entries, 'THIRD_PARTY_LICENSES.md','THIRD_PARTY_NOTICES.md', ...Object.values(manifest.icons)]) {
  assert.ok(files[name], `扩展缺少资源：${name}`);
}
for (const entry of entries) {
  const html = new TextDecoder().decode(files[entry]);
  assert.ok(decodeHTML(html).includes(pageConnectPolicy(entry)),`${entry} 缺少页面网络隔离策略`);
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (match[1].startsWith('http')) throw new Error(`不允许外部资源：${match[1]}`);
    assert.ok(files[match[1].split('#')[0].replace(/^\.\//, '')], `${entry} 入口引用丢失：${match[1]}`);
  }
}
// Each supported locale must be present in the offline bundle, including lazy chunks.
const { languages } = await import('../src/i18n-core.js');
for (const { code } of languages) {
  if (code === 'en') continue; // English fallback is embedded in the common entry.
  assert.ok(Object.keys(files).some(name => name.startsWith(`assets/${code}-`) && name.endsWith('.js')), `扩展缺少语言包：${code}`);
}
for (const name of ['@radix-ui/colors', 'i18next','choices.js','flag-icons','fuse.js','@vvo/tzdb','sortablejs']) assert.ok(licenses.includes(`## ${name} - `), `许可证缺失：${name}`);
const flagCodes=new Set((await readdir(path.join(root,'node_modules/flag-icons/flags/4x3'))).filter(name=>/^[a-z]{2}\.svg$/.test(name)).map(name=>name.slice(0,2)));
for(const flag of flagCodes)assert.ok(Object.keys(files).some(name=>name.startsWith(`assets/${flag}-`)&&name.endsWith('.svg')),`扩展缺少国旗：${flag}`);
assert.equal(Object.keys(files).filter(name=>/^assets\/[a-z]{2}-[^/]+\.svg$/.test(name)).length,flagCodes.size,'国家和地区国旗必须完整且不重复');
const archive = zipSync(files, { level: 6 });
assert.ok(unzipSync(archive)['manifest.json'], 'ZIP 根目录必须包含 manifest.json');
await mkdir(path.join(root, 'releases'), { recursive: true });
const output = path.join(root, 'releases', `LisTools-${pkg.version}.zip`);
await writeFile(output, archive);
console.log(`浏览器扩展资源：${dist}`);
console.log(`通用 ZIP：${output} (${(archive.length / 1024 / 1024).toFixed(2)} MB)`);
