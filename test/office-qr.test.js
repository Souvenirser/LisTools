import test from 'node:test';
import assert from 'node:assert/strict';
import { generateQr, decodeQr } from '../src/tools/qr/core.js';
test('Unicode QR SVG uses explicit margin and quality and decodes rasterized modules',async()=>{
 const result=await generateQr('Hello 世界 👋',{size:256,level:'M'});assert.match(result.svg,/<svg/);assert.equal(result.size,256);
 const width=result.modules.size+8,scale=4, pixels=new Uint8ClampedArray(width*scale*width*scale*4).fill(255);
 for(let y=0;y<result.modules.size;y++)for(let x=0;x<result.modules.size;x++)if(result.modules.data[y*result.modules.size+x])for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){const at=(((y+4)*scale+dy)*width*scale+(x+4)*scale+dx)*4;pixels[at]=pixels[at+1]=pixels[at+2]=0;}
 assert.equal(decodeQr(pixels,width*scale,width*scale),'Hello 世界 👋');
});
test('QR rejects empty input, excessive payload, invalid size and unsupported level',async()=>{
 await assert.rejects(generateQr(''),{code:'qr.empty'});await assert.rejects(generateQr('x'.repeat(5000)),{code:'qr.tooLong'});await assert.rejects(generateQr('ok',{size:0}),{code:'qr.invalidSize'});await assert.rejects(generateQr('ok',{level:'Z'}),{code:'qr.invalidLevel'});
 assert.equal(decodeQr(new Uint8ClampedArray(16).fill(255),2,2),null);
});
test('dense QR output keeps at least one image pixel per module including quiet zone',async()=>{
 const result=await generateQr('a'.repeat(2500),{size:128,level:'L'});
 assert.ok(result.size>=result.modules.size+8);
});
