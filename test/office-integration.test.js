import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pages } from '../src/tools/shared/navigation.js';
import { pageConnectPolicy } from '../src/tools/shared/policy.js';

const added=['calculator','dates','qr','images','text','units','money','pdf','draw','timer'];
test('retired recruiting tools are removed from the shared catalog',()=>{
  assert.ok(!pages.some(page=>['interview','experience','salary'].includes(page.id)));
});
test('all ten office tools are independent offline extension entries',()=>{
  for(const id of added){
    const page=pages.find(page=>page.id===id);
    assert.ok(page,`missing tool ${id}`);
    assert.equal(page.file,`${id}.html`);
    assert.equal(pageConnectPolicy(page.file),"connect-src 'none'");
    const html=readFileSync(new URL(`../${page.file}`,import.meta.url),'utf8');
    assert.ok(html.includes(`/src/${id}.js`));
  }
  assert.equal(pages.filter(page=>!page.file.includes('#')).length,18);
  assert.equal(pages.length,19);
});
test('new tool metadata remains algorithm-free so legacy pages do not eagerly load new libraries',()=>{
  const navigation=readFileSync(new URL('../src/tools/shared/navigation.js',import.meta.url),'utf8');
  assert.ok(!/from ['"](?:mathjs|pdf-lib|cropperjs|qrcode|jsqr)/.test(navigation));
  assert.equal(pages.find(page=>page.id==='json').file,'index.html');
});
