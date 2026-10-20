import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import Papa from 'papaparse';
import { md5Limits, md5Formats, compareMd5, runMd5Task, exportMd5 } from '../src/tools/convert/md5.js';
const digest = value => createHash('md5').update(value).digest('hex');
test('RFC 1321 vectors and million a', async () => {
  for (const value of ['', 'a', 'abc', 'message digest', 'abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', '1234567890'.repeat(8), 'a'.repeat(1000000)]) {
    assert.equal((await runMd5Task(value)).items[0].hex, digest(value));
  }
});
test('RFC 2202, empty and long HMAC keys', async () => {
  assert.equal((await runMd5Task('Hi There',{mode:'hmac',key:'0b'.repeat(16),keyFormat:'hex'})).items[0].hex,'9294727a3638bb1c13f48ef8158bfc9d');
  for (const key of ['', 'Jefe', 'x'.repeat(1000)]) assert.equal((await runMd5Task('message',{mode:'hmac',key})).items[0].hex,createHmac('md5',key).update('message').digest('hex'));
  assert.equal((await runMd5Task('',{mode:'hmac',key:'x'.repeat(md5Limits.key+1)})).errorCode,'keySize');
});
test('formats and strict comparisons', () => {
  const hash=digest('abc'), formats=md5Formats(hash);
  assert.equal(formats.hex16lower,hash.slice(8,24));
  assert.equal(formats.base64,Buffer.from(hash,'hex').toString('base64'));
  for (const [format,value] of Object.entries(formats)) assert.equal(compareMd5(hash,` ${value}\n`,format).status,'match');
  assert.equal(compareMd5(hash,hash.toUpperCase(),'hex32').status,'match');
  assert.equal(compareMd5(hash,formats.hex16upper,'hex16').truncated,true);
  for (const value of ['a',formats.base64+'=',formats.base64.replace('k','_'),'  '+formats.base64.slice(0,4)+' '+formats.base64.slice(4)]) assert.equal(compareMd5(hash,value,'base64').status,'invalid');
  assert.equal(compareMd5(hash,' ').status,'empty');
  assert.equal(compareMd5(hash,'0'.repeat(32)).status,'mismatch');
});
test('raw encodings preserve BOM NUL CRLF and normalization', async () => {
  for (const text of ['\uFEFFa\0\r\n','é','e\u0301']) assert.equal((await runMd5Task(text)).items[0].hex,digest(text));
  assert.equal((await runMd5Task('中文',{representation:'gbk'})).items[0].hex,digest(Buffer.from('d6d0cec4','hex')));
  assert.equal((await runMd5Task('A\0',{representation:'utf-16le'})).items[0].hex,digest(Buffer.from('41000000','hex')));
  for (const [representation,value] of [['hex','616263'],['base64','YWJj']]) assert.equal((await runMd5Task(value,{representation})).items[0].hex,digest('abc'));
  assert.equal((await runMd5Task('\uD800')).items[0].errorCode,'encoding');
  assert.equal((await runMd5Task('xx',{representation:'hex'})).items[0].errorCode,'encoding');
});
test('lines preserve blanks spaces duplicates original positions and cap before skipping', async () => {
  const result=await runMd5Task('a\r\n\r \na\n',{mode:'lines'});
  assert.deepEqual(result.items.map(x=>[x.line,x.hex]),[[1,digest('a')],[2,digest('')],[3,digest(' ')],[4,digest('a')]]);
  assert.deepEqual((await runMd5Task('a\n\n \n',{mode:'lines',skipEmpty:true})).items.map(x=>x.line),[1,3]);
  assert.equal((await runMd5Task('\n'.repeat(10001),{mode:'lines',skipEmpty:true})).errorCode,'lineLimit');
  assert.equal((await runMd5Task('a'.repeat(md5Limits.text+1))).errorCode,'inputSize');
});
test('files use slices, continue errors, keep duplicates and report final progress', async () => {
  class SliceOnly extends Blob { async arrayBuffer(){throw Error('whole file read');} }
  const bytes=Buffer.alloc(md5Limits.chunk+1,97), file=new SliceOnly([bytes]);
  Object.defineProperty(file,'name',{value:'same.bin'});
  const oversized={size:md5Limits.file+1,name:'huge',slice(){throw Error('must not read');}};
  const failed={size:1,name:'failed',slice(){throw Error('read failed');}};
  const events=[];
  const result=await runMd5Task([file,oversized,failed,file,new Blob([])],{mode:'files'},event=>events.push(event));
  assert.equal(result.items[0].hex,digest(bytes));
  assert.equal(result.items[1].errorCode,'fileSize');
  assert.equal(result.items[2].errorCode,'read');
  assert.equal(result.items[3].name,'same.bin');
  assert.equal(result.items[4].hex,digest(''));
  assert.equal(events.filter(x=>x.event==='item-complete').length,5);
  assert.equal(events.filter(x=>x.event==='progress').at(-1).completed,5);
  assert.equal((await runMd5Task(Array(101).fill(file),{mode:'files'})).errorCode,'fileCount');
});
test('CSV protects formulas; JSON retains names and excludes input secrets', async () => {
  const file=new Blob(['secret']); Object.defineProperty(file,'name',{value:'=formula'});
  const items=(await runMd5Task([file],{mode:'files'})).items;
  assert.equal(Papa.parse(exportMd5(items,'hex32lower','csv'),{header:true}).data[0].Name,"'=formula");
  const output=JSON.parse(exportMd5(items,'hex32lower'));
  assert.equal(output[0].name,'=formula'); assert.equal(output[0].digest,digest('secret'));
  assert.ok(!JSON.stringify(output).includes('secret'));
});

test('mixed CSV rows retain later errors and decoded progress uses actual bytes', async () => {
  const events=[];
  await runMd5Task('616263',{representation:'hex'},event=>events.push(event));
  assert.equal(events[0].totalBytes,3);
  const items=[{status:'ready',size:0,hex:digest('')},{status:'error',size:1,errorCode:'read',errorParams:{}}];
  assert.equal(Papa.parse(exportMd5(items,'base64','csv'),{header:true}).data[1].errorCode,'read');
});

test('empty lines has no phantom row and Base64 allows canonical unpadded input', async () => {
  assert.deepEqual((await runMd5Task('',{mode:'lines'})).items,[]);
  const value=digest('abc');
  assert.equal(compareMd5(value,md5Formats(value).base64.replace(/=+$/,''),'base64').status,'match');
});
test('files larger than old 50 MiB limit hash sequentially in bounded slices', async () => {
  const size=50*1024**2+1, piece=Buffer.alloc(md5Limits.chunk,97), expected=createHash('md5');
  let active=0,maxActive=0,reads=0;
  const file={name:'large.bin',size,slice(start,end){
    assert.ok(end-start<=md5Limits.chunk);
    return {async arrayBuffer(){active++;maxActive=Math.max(maxActive,active);reads++;
      await Promise.resolve(); const chunk=piece.subarray(0,end-start); expected.update(chunk);active--;return chunk.buffer.slice(chunk.byteOffset,chunk.byteOffset+chunk.length);}};
  }};
  const result=await runMd5Task([file],{mode:'files'});
  assert.equal(result.items[0].hex,expected.digest('hex'));
  assert.equal(result.inputBytes,size);assert.equal(maxActive,1);assert.equal(reads,26);
});
test('failed file final progress reports bytes actually read', async () => {
  for (const successfulChunks of [0,1]) {
    const events=[],size=md5Limits.chunk+1;
    const file={size,slice(start,end){if(start>=successfulChunks*md5Limits.chunk)throw Error('read failed');return new Blob([new Uint8Array(end-start)]);}};
    const result=await runMd5Task([file],{mode:'files'},event=>events.push(event));
    const progress=events.filter(event=>event.event==='progress').at(-1);
    assert.equal(result.items[0].errorCode,'read');
    assert.equal(progress.bytesRead,successfulChunks*md5Limits.chunk);
    assert.equal(progress.processedBytes,progress.bytesRead);
    assert.equal(progress.fileBytes,size);
  }
});
test('rejected files do not inflate byte progress totals', async () => {
  const events=[];
  const result=await runMd5Task([new Blob(['abc']),{size:md5Limits.file+1,slice(){throw Error('must not read');}},{size:20}],{mode:'files'},event=>events.push(event));
  const progress=events.filter(event=>event.event==='progress').at(-1);
  assert.equal(progress.totalBytes,3);
  assert.equal(progress.processedBytes,3);
  assert.equal(progress.completed,3);
  assert.equal(progress.total,3);
  assert.deepEqual(result.items.map(item=>item.status),['ready','error','error']);
});
// RFC 2202 section 2: full MD5 outputs, including keys longer than one block.
test('all seven RFC 2202 HMAC-MD5 cases match the published digests',async()=>{
  const ascii=text=>Buffer.from(text).toString('hex');
  const cases=[
    ['0b'.repeat(16),ascii('Hi There'),'9294727a3638bb1c13f48ef8158bfc9d'],
    [ascii('Jefe'),ascii('what do ya want for nothing?'),'750c783e6ab0b503eaa86e310a5db738'],
    ['aa'.repeat(16),'dd'.repeat(50),'56be34521d144c88dbb8c733f0e8b3f6'],
    ['0102030405060708090a0b0c0d0e0f10111213141516171819','cd'.repeat(50),'697eaf0aca3a3aea3a75164746ffaa79'],
    ['0c'.repeat(16),ascii('Test With Truncation'),'56461ef2342edc00f9bab995690efd4c'],
    ['aa'.repeat(80),ascii('Test Using Larger Than Block-Size Key - Hash Key First'),'6b1ab7fe4bd7bf8f0b62e6ce61b9d0cd'],
    ['aa'.repeat(80),ascii('Test Using Larger Than Block-Size Key and Larger Than One Block-Size Data'),'6f630fad67cda0ee1fb1f562db3aa53e']
  ];
  for(const [key,input,expected] of cases)assert.equal((await runMd5Task(input,{mode:'hmac',representation:'hex',key,keyFormat:'hex'})).items[0].hex,expected);
});
