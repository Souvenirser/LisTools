import test from 'node:test';
import assert from 'node:assert/strict';
import { imagePlan, imageHeader, uniqueNames } from '../src/tools/images/core.js';
import * as imageCore from '../src/tools/images/core.js';
// Catches resizing in the wrong order, aspect distortion, and accidental target downsizing.
test('image resize uses cropped geometry and retains resolution unless explicitly reduced', () => {
  assert.deepEqual(imagePlan(800,600,{width:400,height:500,aspect:true,scale:100}),{width:400,height:300});
  assert.deepEqual(imagePlan(800,600,{width:0,height:150,aspect:true,scale:100}),{width:200,height:150});
  assert.deepEqual(imagePlan(800,600,{width:0,height:0,aspect:true,scale:50}),{width:400,height:300});
  assert.throws(()=>imagePlan(800,600,{width:90000,height:0,aspect:true,scale:100}),{code:'images.dimensions'});
});
test('rejects animated or unsupported media before decode and reads static PNG dimensions', () => {
  const data=new Uint8Array(33);data.set([137,80,78,71,13,10,26,10]);data.set([0,0,0,13,73,72,68,82],8);new DataView(data.buffer).setUint32(16,640);new DataView(data.buffer).setUint32(20,480);
  assert.deepEqual(imageHeader(data),{width:640,height:480,type:'image/png'});
  assert.throws(()=>imageHeader(new TextEncoder().encode('GIF89a')),{code:'images.unsupported'});
  const animation=new Uint8Array(41);animation.set(data);animation.set([97,99,84,76],37);
  assert.throws(()=>imageHeader(animation),{code:'images.animated'});
});
test('duplicate output names never overwrite ZIP entries',()=>assert.deepEqual(uniqueNames(['a.png','a.png','a-2.png','a.png']),['a.png','a-2.png','a-2-2.png','a-3.png']));

test('JPEG output drops APP1 metadata while preserving image segments and scan bytes',async()=>{
  assert.equal(typeof imageCore.removeJpegMetadata,'function');
  const segment=(marker,value)=>{const body=Buffer.from(value);return Buffer.concat([Buffer.from([255,marker,(body.length+2)>>8,(body.length+2)&255]),body]);};
  const start=Buffer.from([255,216]),app0=segment(224,'JFIF'),scan=Buffer.concat([segment(218,''),Buffer.from('Exif inside compressed pixels'),Buffer.from([255,217])]);
  const blob=new Blob([start,app0,segment(225,'Exif\0\0private'),segment(225,'XMP private'),scan],{type:'image/jpeg'});
  const result=await imageCore.removeJpegMetadata(blob);
  assert.deepEqual(Buffer.from(await result.arrayBuffer()),Buffer.concat([start,app0,scan]));
  assert.equal(result.type,'image/jpeg');
  const png=new Blob(['png'],{type:'image/png'});assert.equal(await imageCore.removeJpegMetadata(png),png);
});
