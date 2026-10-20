import test from 'node:test';
import assert from 'node:assert/strict';
import { executeConversion as convert } from '../src/tools/convert/runtime.js';
test('JWT 拒绝相同值重复字段，保留特殊键和无损数字', async () => {
  const b64 = text => Buffer.from(text).toString('base64url');
  assert.equal((await convert('jwt',`${b64('{"alg":"none","alg":"none"}')}.${b64('{}')}.`)).status,'error');
  const result=await convert('jwt',`${b64('{"alg":"none"}')}.${b64('{"__proto__":"demo","n":9007199254740993123}')}.`);
  assert.equal(result.status,'ready',result.message);
  assert.match(await result.blob.text(),/"__proto__": "demo"/);
  assert.match(await result.blob.text(),/9007199254740993123/);
});
test('Base58 的平方级进制转换有明确小文件界限，不冻结大文件任务', async () => {
  for(const [input,options] of [[new Uint8Array(2049),{}],['1'.repeat(4097),{direction:'decode'}]]) {
    const result=await convert('base58',input,options);
    assert.equal(result.status,'error'); assert.match(result.message,/上游库限制/);
  }
});
test('文件保持独立的字节上限，编码文本文件不受可编辑文本上限影响', async () => {
  const result=await convert('base64',new Blob(['YWJj']),{direction:'decode'},{text:2,file:10,output:20});
  assert.equal(result.status,'ready',result.message);assert.equal(await result.blob.text(),'abc');
  assert.equal((await convert('base64','YWJj',{direction:'decode'},{text:2,file:10})).status,'error');
});
test('各字符集固定非 ASCII 样例编码与来源文件转码一致', async () => {
  const samples=[['utf-8','中','e4b8ad'],['utf-16le','中','2d4e'],['utf-16be','中','4e2d'],['gbk','中文','d6d0cec4'],['gb18030','中文','d6d0cec4'],['big5','中文','a4a4a4e5'],['shift_jis','日本','93fa967b'],['euc-kr','한국','c7d1b1b9'],['windows-1252','€','80']];
  for(const [charset,source,expected] of samples) {
    const encoded=await convert('charset',source,{to:charset});
    assert.equal(encoded.status,'ready',encoded.message);assert.equal(Buffer.from(await encoded.blob.arrayBuffer()).toString('hex'),expected,charset);
    const decoded=await convert('charset',new Blob([Buffer.from(expected,'hex')]),{from:charset,to:'utf-8'});
    assert.equal(decoded.status,'ready',decoded.message);assert.equal(await decoded.blob.text(),source);
  }
});

async function text(id, input, options = {}) {
  const result = await convert(id, input, options);
  assert.equal(result.status, 'ready', result.message);
  return new TextDecoder('utf-8', { ignoreBOM: true }).decode(await result.blob.arrayBuffer());
}

test('Base64 文本保留中文、Emoji、NUL、BOM及换行，允许合法缺失补位', async () => {
  assert.equal(await text('base64', '中文🙂\0\n'), '5Lit5paH8J+ZggAK');
  assert.equal(await text('base64', 'SGVsbG8', { direction: 'decode' }), 'Hello');
  assert.equal(await text('base64', '77u/YQ==', { direction: 'decode' }), '\uFEFFa');
  assert.equal(await text('base64', ''), '');
});

test('字节编码逐字节往返，Base64URL 字母表与标准 Base64 分开', async () => {
  const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
  for (const id of ['base64','base64url','base32','base32hex','base58','hex','binary']) {
    const encoded = await text(id, bytes);
    const decoded = await convert(id, encoded, { direction: 'decode' });
    assert.equal(decoded.status, 'ready', decoded.message);
    assert.deepEqual(new Uint8Array(await decoded.blob.arrayBuffer()), bytes, id);
    assert.equal(decoded.copyBlob, undefined, '二进制不可被替换字符伪装成文本');
  }
  assert.equal(await text('base64url', new Uint8Array([251,255])), '-_8');
  for (const [id, source] of [['base64','-_8='],['base64url','+/8='],['base64','SGVsbG8!'],['base64','A'],['base64','AB=='],['hex','abc'],['binary','100000000']]) {
    assert.equal((await convert(id, source, { direction:'decode' })).status, 'error', `${id}:${source}`);
  }
});

test('文件结果及预览分离，复制和下载引用完整结果；超限不输出部分成功', async () => {
  const result = await convert('base64', new Blob(['a'.repeat(120)]), {}, { preview:16 });
  assert.equal(result.status,'ready', result.message);
  assert.equal(result.blob.size,160);
  assert.ok(result.truncated);
  assert.equal((await result.copyBlob.text()).length,160);
  assert.ok(result.preview.length < 160);
  assert.equal((await convert('base64', 'abcd', {}, { text:3 })).status,'error');
  assert.equal((await convert('base64', new Blob(['abcd']), {}, { file:3 })).status,'error');
  assert.equal((await convert('base64', 'abcd', {}, { output:4 })).status,'error');
  assert.equal((await convert('base64', '\uD800')).status,'error');
});

test('URL、完整 URI、表单的加号和保留字符遵从各自语义', async () => {
  assert.equal(await text('url-component','a b+c/'), 'a%20b%2Bc%2F');
  assert.equal(await text('uri','https://example.test/a b?q=a+b'), 'https://example.test/a%20b?q=a+b');
  assert.equal(await text('form','a b+c'), 'a+b%2Bc');
  assert.equal(await text('form','a+b%2Bc',{direction:'decode'}), 'a b+c');
  assert.equal(await text('url-component','a+b%2Bc',{direction:'decode'}), 'a+b+c');
  assert.equal((await convert('url-component','%GG',{direction:'decode'})).status,'error');
});

test('实体与 Unicode/JSON 转义只处理文本，不执行输入', async () => {
  assert.equal(await text('html-entities','&lt;img src=x onerror=alert(1)&gt;',{direction:'decode'}), '<img src=x onerror=alert(1)>');
  assert.equal(await text('xml-entities','&lt;a&gt;&amp;&#x4e2d;',{direction:'decode'}), '<a>&中');
  const source='中文🙂"\\\n';
  for(const id of ['json-string','unicode','codepoints']) {
    const encoded=await text(id,source);
    assert.equal(await text(id,encoded,{direction:'decode'}),source,id);
  }
  assert.equal(await text('codepoints','中🙂'),'U+4E2D U+1F642');
  assert.equal((await convert('json-string','(()=>1)()',{direction:'decode'})).status,'error');
  assert.equal((await convert('codepoints','U+D800',{direction:'decode'})).status,'error');
});

test('字符集转换保留 BOM，拒绝非法字节和无法编码的字符', async () => {
  const encoded=await convert('charset','中文',{to:'gbk'});
  assert.equal(encoded.status,'ready',encoded.message);
  assert.deepEqual([...new Uint8Array(await encoded.blob.arrayBuffer())],[0xd6,0xd0,0xce,0xc4]);
  assert.equal(await text('charset',new Uint8Array([0xd6,0xd0,0xce,0xc4]),{from:'gbk',to:'utf-8'}),'中文');
  for(const encoding of ['utf-8','utf-16le','utf-16be','gbk','gb18030','big5','shift_jis','euc-kr','windows-1252']) {
    const a=await convert('charset','ABC',{to:encoding});
    assert.equal(a.status,'ready',`${encoding}: ${a.message}`);
    assert.equal(await text('charset',new Uint8Array(await a.blob.arrayBuffer()),{from:encoding,to:'utf-8'}),'ABC');
  }
  assert.equal(await text('charset',new Uint8Array([0xef,0xbb,0xbf,0x61]),{to:'utf-8'}),'\uFEFFa');
  assert.equal((await convert('charset',new Uint8Array([0xff]),{from:'utf-8'})).status,'error');
  assert.equal((await convert('charset','🙂',{to:'gbk'})).status,'error');
});

test('JWT 严格解码并标明未验签，不把可解析等同可信', async () => {
  const token='eyJhbGciOiJub25lIn0.eyJzdWIiOiJkZW1vIn0.';
  const result=await convert('jwt',token);
  assert.equal(result.status,'ready',result.message);
  assert.match(result.notice,/未验签/);
  assert.deepEqual(JSON.parse(await result.blob.text()),{header:{alg:'none'},payload:{sub:'demo'},signature:''});
  assert.equal((await convert('jwt','a.b.c.d.e')).status,'error');
});
