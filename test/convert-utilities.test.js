import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { executeConversion as convert } from '../src/tools/convert/runtime.js';
async function text(id, source, options={}, limits={}) {
  const r=await convert(id,source,options,limits); assert.equal(r.status,'ready',r.message); return r.blob.text();
}
test('所有摘要与独立标准实现一致，原始文件字节和换行不被修剪', async () => {
  for(const algorithm of ['md5','sha1','sha224','sha256','sha384','sha512','sha3-256','sha3-512','ripemd160','blake2b','blake2s']) {
    const nodeName={blake2b:'blake2b512',blake2s:'blake2s256'}[algorithm] || algorithm;
    assert.equal(await text('hash',new Blob(['abc\r\n']),{algorithm}),createHash(nodeName).update('abc\r\n').digest('hex'),algorithm);
  }
  assert.equal(await text('hash','',{algorithm:'blake3'}),'af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262');
  assert.equal(await text('hash','123456789',{algorithm:'crc32'}),'cbf43926');
});
test('HMAC RFC4231 向量及三种密钥表示不改变字节', async () => {
  assert.equal(await text('hmac','Hi There',{algorithm:'sha256',key:'0b'.repeat(20),keyFormat:'hex'}),'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7');
  for(const algorithm of ['sha256','sha384','sha512']) for(const [keyFormat,key] of [['utf-8','key'],['hex','6b6579'],['base64','a2V5']]) {
    assert.equal(await text('hmac','message',{algorithm,keyFormat,key}),createHmac(algorithm,'key').update('message').digest('hex'));
  }
});
test('Gzip/Zlib/Deflate 全字节与空输入往返，Base64/Hex 传输保持字节', async () => {
  const bytes=Uint8Array.from({length:256},(_,i)=>i);
  for(const id of ['gzip','zlib','deflate']) for(const data of [bytes,new Uint8Array()]) for(const outputFormat of ['raw','base64','hex']) {
    const encoded=await convert(id,data,{outputFormat}); assert.equal(encoded.status,'ready',encoded.message);
    const input=outputFormat === 'raw' ? new Uint8Array(await encoded.blob.arrayBuffer()) : await encoded.blob.text();
    const decoded=await convert(id,input,{direction:'decode',inputFormat:outputFormat,outputFormat:'raw'});
    assert.equal(decoded.status,'ready',decoded.message);
    assert.deepEqual(new Uint8Array(await decoded.blob.arrayBuffer()),data,id);
  }
});
test('解压流损坏或输出超限时不返回部分成功', async () => {
  assert.equal((await convert('gzip',new Uint8Array([1,2,3]),{direction:'decode'})).status,'error');
  for(const id of ['gzip','zlib','deflate']) {
    const result=await convert(id,'checksum sample',{outputFormat:'raw'});
    const good=new Uint8Array(await result.blob.arrayBuffer());
    const changed=good.slice(); changed[changed.length-1]^=1;
    for(const bad of [good.subarray(0,-1),changed,new Uint8Array([...good,1])]) {
      assert.equal((await convert(id,bad,{direction:'decode'})).status,'error',id);
    }
  }
  const encoded=await text('gzip','a'.repeat(10000));
  assert.equal((await convert('gzip',encoded,{direction:'decode',inputFormat:'base64'},{output:100})).status,'error');
});
test('2～36 进制使用任意精度整数，拒绝无效数字及非整数', async () => {
  assert.equal(await text('radix','9007199254740993',{from:'10',to:'16'}),'20000000000001');
  assert.equal(await text('radix','-0xff',{from:'16',to:'10'}),'-255');
  assert.equal(await text('radix','z',{from:'36',to:'2'}),'100011');
  for(const input of ['12x','1.2','1e3','']) assert.equal((await convert('radix',input,{from:'10',to:'16'})).status,'error',input);
});
test('SI/IEC 单位和时间长度使用十进制计算，舍入结果明确标记', async () => {
  assert.equal(await text('bytes-unit','1',{from:'MiB',to:'MB'}),'1.048576');
  assert.equal(await text('bytes-unit','8',{from:'b',to:'B'}),'1');
  assert.equal(await text('bytes-unit','9007199254740993',{from:'B',to:'B'}),'9007199254740993');
  assert.equal(await text('duration-unit','1.5',{from:'h',to:'s'}),'5400');
  assert.match(await text('duration-unit','1',{from:'s',to:'min'}),/^≈ /);
  assert.equal((await convert('bytes-unit','Infinity')).status,'error');
});
test('颜色转换保留 alpha 并告知格式量化；HSV 对象可作为输入', async () => {
  assert.equal(await text('color','#ff000080',{format:'hex'}),'#ff000080');
  assert.equal(await text('color','{"h":120,"s":100,"v":100,"a":0.5}',{format:'hex'}),'#00ff0080');
  const result=await convert('color','#fff',{format:'hsl'}); assert.equal(result.status,'ready'); assert.match(result.notice,/量化|精度/);
  assert.equal((await convert('color','not-a-color')).status,'error');
});
test('文本只执行选定操作，保留未选择转换的空白与换行', async () => {
  assert.equal(await text('case','hello world',{style:'camel'}),'helloWorld');
  assert.equal(await text('case','helloWorld',{style:'snake'}),'hello_world');
  assert.equal(await text('case',' aB\n',{style:'upper'}),' AB\n');
  assert.equal(await text('lines','a\r\na\r\nb\r\n',{operation:'dedupe'}),'a\r\nb\r\n');
  assert.equal(await text('lines','a\r\na\nb\rc',{operation:'dedupe'}),'a\r\nb\rc');
  assert.equal(await text('lines','a\r\n \nb\rc',{operation:'remove-empty'}),'a\r\nb\rc');
  assert.equal(await text('lines',' b \r\n a ',{operation:'trim'}),'b\r\na');
  assert.equal(await text('lines','b\na',{operation:'sort'}),'a\nb');
  assert.equal(await text('newline','a\rb\r\nc\n',{ending:'crlf'}),'a\r\nb\r\nc\r\n');
  assert.equal(await text('normalize','e\u0301',{form:'NFC'}),'é');
});
