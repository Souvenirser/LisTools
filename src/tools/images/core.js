export function mediaError(code,params) { return Object.assign(new Error(code),{code,params}); }
export function checkDimensions(width,height) {
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width>16384||height>16384||width*height>40_000_000)throw mediaError('images.dimensions');
}
export function imagePlan(width,height,{width:w=0,height:h=0,aspect=true,scale=100}={}) {
  checkDimensions(width,height);w=Number(w);h=Number(h);scale=Number(scale);
  if(!Number.isFinite(w)||!Number.isFinite(h)||w<0||h<0||!Number.isFinite(scale)||scale<=0||scale>400)throw mediaError('images.dimensions');
  if(aspect) {const factor=w?w/width:h?h/height:scale/100;w=Math.round(width*factor);h=Math.round(height*factor);}
  else {w=w||Math.round(width*scale/100);h=h||Math.round(height*scale/100);}
  checkDimensions(w,h);return {width:w,height:h};
}
export function imageHeader(bytes) {
  const b=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes),v=new DataView(b.buffer,b.byteOffset,b.byteLength);
  let width,height,type;
  if(b.length>=24&&[137,80,78,71,13,10,26,10].every((value,i)=>b[i]===value)&&String.fromCharCode(...b.slice(12,16))==='IHDR') {
    type='image/png';width=v.getUint32(16);height=v.getUint32(20);
    for(let pos=8;pos+8<=b.length;){const size=v.getUint32(pos);if(String.fromCharCode(...b.slice(pos+4,pos+8))==='acTL')throw mediaError('images.animated');pos+=12+size;}
  } else if(b[0]===255&&b[1]===216) {
    type='image/jpeg';let i=2;
    while(i+4<=b.length){if(b[i++]!==255)continue;let m=b[i++];if(m===0xda||m===0xd9)break;if(m===0xd8||m===0x01||(m>=0xd0&&m<=0xd7))continue;const n=v.getUint16(i);if(n<2||i+n>b.length)break;
      if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(m)&&n>=7){height=v.getUint16(i+3);width=v.getUint16(i+5);break;}i+=n;
    }
  } else if(b.length>=30&&String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP') {
    type='image/webp';const kind=String.fromCharCode(...b.slice(12,16));
    if(kind==='VP8X'){if(b[20]&2)throw mediaError('images.animated');width=1+b[24]+(b[25]<<8)+(b[26]<<16);height=1+b[27]+(b[28]<<8)+(b[29]<<16);}
    else if(kind==='VP8 '&&b.length>=30){width=v.getUint16(26,true)&0x3fff;height=v.getUint16(28,true)&0x3fff;}
    else if(kind==='VP8L'&&b[20]===0x2f){const bits=v.getUint32(21,true);width=(bits&0x3fff)+1;height=((bits>>>14)&0x3fff)+1;}
  }
  if(!width||!height)throw mediaError('images.unsupported');checkDimensions(width,height);return {width,height,type};
}
export function uniqueNames(names) {
  const used=new Set();return names.map(name=>{name=name.replace(/[\\/]/g,'_');const dot=name.lastIndexOf('.'),base=dot<0?name:name.slice(0,dot),ext=dot<0?'':name.slice(dot);let candidate=name,index=2;while(used.has(candidate))candidate=`${base}-${index++}${ext}`;used.add(candidate);return candidate;});
}
