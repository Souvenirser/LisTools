import QRCode from 'qrcode';
import jsQR from 'jsqr';
const fail=code=>{throw Object.assign(new Error(code),{code:`qr.${code}`});};
export async function generateQr(text,{size=320,level='M'}={}) {
 if(!text)fail('empty');if(!Number.isInteger(size)||size<128||size>2048)fail('invalidSize');if(!['L','M','Q','H'].includes(level))fail('invalidLevel');
 if(new TextEncoder().encode(text).length>2953)fail('tooLong');
 try {const options={width:size,errorCorrectionLevel:level,margin:4};const symbol=QRCode.create([{data:text,mode:'byte'}],options);size=Math.max(size,symbol.modules.size+8);options.width=size;return {svg:await QRCode.toString([{data:text,mode:'byte'}],{...options,type:'svg'}),modules:{size:symbol.modules.size,data:symbol.modules.data},size};}
 catch {return fail('tooLong');}
}
export const decodeQr=(pixels,width,height)=>jsQR(pixels,width,height,{inversionAttempts:'attemptBoth'})?.data??null;
