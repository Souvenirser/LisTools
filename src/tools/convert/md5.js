import { md5 } from '@noble/hashes/legacy.js';
import { hmac } from '@noble/hashes/hmac.js';
import { hex, base64 } from '@scure/base';
import Papa from 'papaparse';
import { encodeText } from './bytes.js';
import { decodeBase } from './codecs.js';

export const md5Limits = Object.freeze({ text:10 * 1024 ** 2, lines:10000, files:100, file:4 * 1024 ** 3, key:64 * 1024, chunk:2 * 1024 ** 2 });
const formatName = value => ({hex32:'hex32lower',hex16:'hex16lower'}[value] || value);
export function md5Formats(value) {
  if (!/^[0-9a-f]{32}$/.test(value)) throw new Error('Invalid MD5 digest');
  return {hex32lower:value,hex32upper:value.toUpperCase(),hex16lower:value.slice(8,24),hex16upper:value.slice(8,24).toUpperCase(),base64:base64.encode(hex.decode(value))};
}
export function compareMd5(value, expected, format = 'hex32lower') {
  format = formatName(format);
  const truncated = format === 'hex16lower' || format === 'hex16upper';
  const text = String(expected ?? '').trim();
  if (!text) return {status:'empty',truncated};
  const formats = md5Formats(value);
  if (!Object.hasOwn(formats,format)) return {status:'invalid',truncated};
  if (format === 'base64') {
    try { if (decodeBase(text,'base64').length !== 16) return {status:'invalid',truncated}; }
    catch { return {status:'invalid',truncated}; }
  } else if (!(truncated ? /^[0-9a-f]{16}$/i : /^[0-9a-f]{32}$/i).test(text)) return {status:'invalid',truncated};
  return {status:(format === 'base64' ? hex.encode(decodeBase(text,'base64')) === value : text.toLowerCase() === formats[format].toLowerCase()) ? 'match' : 'mismatch',truncated};
}
const failure = (errorCode,errorParams = {}) => ({status:'error',errorCode,errorParams});
async function inputBytes(text, representation) {
  return representation === 'hex' || representation === 'base64' ? decodeBase(text,representation) : encodeText(text,representation);
}
export async function runMd5Task(input, options = {}, emit = () => {}) {
  const started = performance.now(), mode = options.mode || 'text', representation = options.representation || 'utf-8';
  if (!['text','lines','files','hmac'].includes(mode)) return failure('unknown');
  if (mode === 'files' ? !Array.isArray(input) : typeof input !== 'string') return failure('unknown');
  if (mode === 'files' && input.length > md5Limits.files) return failure('fileCount',{limit:md5Limits.files});
  if (mode !== 'files' && new TextEncoder().encode(input).length > md5Limits.text) return failure('inputSize',{limit:md5Limits.text});
  let rows = mode === 'files' ? input.map((file,index)=>({file,index})) : [{text:input,index:0}];
  if (mode === 'lines') {
    const lines = input === '' ? [] : input.split(/\r\n|\r|\n/);
    if (/[\r\n]$/.test(input)) lines.pop();
    if (lines.length > md5Limits.lines) return failure('lineLimit',{limit:md5Limits.lines});
    rows = lines.map((text,index)=>({text,index,line:index+1})).filter(row=>!options.skipEmpty || row.text.length !== 0);
  }
  let key;
  try {
    if (mode === 'hmac') {
      try { key = await inputBytes(options.key || '',options.keyFormat || 'utf-8'); }
      catch { return failure('representation'); }
      if (key.length > md5Limits.key) return failure('keySize',{limit:md5Limits.key});
    }
    if (mode !== 'files') {
      let decodedSize = 0;
      for (const row of rows) {
        try { row.bytes = await inputBytes(row.text,representation); decodedSize += row.bytes.length; }
        catch { row.invalidEncoding = true; }
        if (decodedSize > md5Limits.text) return failure('inputSize',{limit:md5Limits.text});
      }
    }
    const items = [], total = rows.length;
    const totalBytes = rows.reduce((sum,row)=>sum+(mode === 'files' ? Number.isFinite(row.file?.size) && row.file.size >= 0 && row.file.size <= md5Limits.file && typeof row.file.slice === 'function' ? row.file.size : 0 : row.bytes?.length || 0),0);
    let processedBytes = 0, completed = 0, lastProgress = -Infinity, byteCount = 0;
    function progress(item,bytesRead,fileBytes,final = false) {
      const now = performance.now();
      if (final || now-lastProgress >= 100) {
        emit({event:'progress',itemId:item.id,bytesRead,fileBytes,totalBytes,processedBytes,completed,total});
        lastProgress = now;
      }
    }
    for (const row of rows) {
      let bytesRead = 0;
      const item = {id:String(row.index),index:row.index+1,...(row.line ? {line:row.line} : {}),...(mode === 'files' ? {name:row.file?.name || ''} : {}),size:0,status:'ready'};
      if (mode === 'files') {
        const file = row.file;
        item.size = Number.isFinite(file?.size) ? file.size : 0;
        if (!file || !Number.isFinite(file.size) || file.size < 0 || typeof file.slice !== 'function') Object.assign(item,failure('read'));
        else if (file.size > md5Limits.file) Object.assign(item,failure('fileSize',{limit:md5Limits.file}));
        else {
          const state = md5.create();
          try {
            for (let at=0;at<file.size;at+=md5Limits.chunk) {
              const bytes = new Uint8Array(await file.slice(at,Math.min(at+md5Limits.chunk,file.size)).arrayBuffer());
              if (bytes.length !== Math.min(md5Limits.chunk,file.size-at)) throw new Error('Incomplete file read');
              state.update(bytes); bytesRead += bytes.length; processedBytes += bytes.length; byteCount += bytes.length;
              progress(item,bytesRead,file.size);
            }
            item.hex = hex.encode(state.digest());
          } catch { Object.assign(item,failure('read')); }
          finally { state.destroy(); }
        }
      } else {
        try {
          if (row.invalidEncoding) throw new Error('Invalid encoding');
          const bytes = row.bytes;
          item.size = bytes.length;
          if (bytes.length > md5Limits.text) Object.assign(item,failure('inputSize',{limit:md5Limits.text}));
          else { item.hex = hex.encode(mode === 'hmac' ? hmac(md5,key,bytes) : md5(bytes)); processedBytes += bytes.length; byteCount += bytes.length; }
        } catch { Object.assign(item,failure('encoding')); }
      }
      items.push(item); completed++;
      progress(item,mode === 'files' ? bytesRead : item.size,item.size,completed === total);
      emit({event:'item-complete',itemId:item.id,item});
    }
    return {status:'ready',mode,items,inputBytes:byteCount,durationMs:performance.now()-started};
  } finally { key?.fill(0); }
}
export function exportMd5(items, format, type = 'json', labels = {}) {
  format = formatName(format || 'hex32lower');
  const rows = items.map(item=>({...(item.line !== undefined ? {line:item.line} : {}),...(item.name !== undefined ? {name:item.name} : {}),size:item.size,status:item.status,digest:item.status === 'ready' ? md5Formats(item.hex)[format] : '',...(item.errorCode ? {errorCode:item.errorCode,errorParams:item.errorParams || {}} : {})}));
  if (type === 'json') return JSON.stringify(rows,null,2);
  if (type !== 'csv') throw new Error('Invalid export type');
  const defaults = {line:'Line',name:'Name',size:'Size',status:'Status',digest:'Digest'};
  const fields = [...new Set(rows.flatMap(row=>Object.keys(row)))];
  return Papa.unparse({fields:fields.map(key=>labels[key] || defaults[key] || key),data:rows.map(row=>fields.map(key=>typeof row[key] === 'object' ? JSON.stringify(row[key]) : row[key] ?? ''))},{escapeFormulae:true});
}
