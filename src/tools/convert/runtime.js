import { limits, createInput, encodeText, decodeText, checkSize } from './bytes.js';

const groups = {
  codecs: () => import('./codecs.js'),
  formats: () => import('./formats.js'),
  utilities: () => import('./utilities.js')
};
const formatIds = new Set(['json-yaml','xml-json','csv-json','tsv-json','jsonl','query-json']);
const utilityIds = new Set(['hash','hmac','gzip','zlib','deflate','radix','bytes-unit','duration-unit','color','case','lines','newline','normalize']);

export async function executeConversion(toolId, input, options = {}, overrides = {}) {
  const maximum = { ...limits, ...overrides };
  const started = performance.now();
  try {
    if (toolId==='md5') {
      const { runMd5Task }=await import('./md5.js');
      const result=await runMd5Task(input,options);
      if(result.status==='error') return result;
      const preview=result.items.map(item=>item.hex || item.errorCode).join('\n');
      const blob=new Blob([preview],{type:'text/plain;charset=utf-8'});
      return {...result,kind:'text',blob,copyBlob:blob,preview,previewKind:'text',truncated:false,outputBytes:blob.size,extension:'txt'};
    }
    const source = createInput(input, maximum);
    const inputBytes = (await source.bytes()).length;
    const group = formatIds.has(toolId) ? 'formats' : utilityIds.has(toolId) ? 'utilities' : 'codecs';
    const result = await (await groups[group]()).run(toolId, source, options, maximum);
    const kind = typeof result.text === 'string' ? 'text' : 'bytes';
    const bytes = kind === 'text' ? await encodeText(result.text) : result.bytes;
    if (!(bytes instanceof Uint8Array)) throw new Error('工具未返回有效结果');
    checkSize(bytes.length, maximum.output, '输出');
    const blob = new Blob([bytes], { type: kind === 'text' ? 'text/plain;charset=utf-8' : 'application/octet-stream' });
    let display = result.text, notice = result.notice || '';
    if (kind === 'bytes') {
      try { display = decodeText(bytes, result.displayEncoding || options.charset || 'utf-8'); }
      catch { notice += `${notice ? '；' : ''}结果无法按所选字符集无损解码，显示 Hex，可下载原始字节`; }
    }
    let preview, copyBlob;
    if (display !== undefined) {
      const encoded = await encodeText(display);
      copyBlob = kind === 'text' ? blob : new Blob([encoded], {type:'text/plain;charset=utf-8'});
      preview = new TextDecoder('utf-8', { ignoreBOM:true }).decode(encoded.subarray(0, maximum.preview), {stream:encoded.length > maximum.preview});
    } else preview = Array.from(bytes.subarray(0, Math.floor(maximum.preview / 3)), b => b.toString(16).padStart(2,'0')).join(' ');
    return {
      status:'ready', kind, blob, copyBlob, preview,
      truncated: copyBlob ? copyBlob.size > maximum.preview : bytes.length * 3 > maximum.preview,
      previewKind: display === undefined ? 'hex' : 'text',
      inputBytes, outputBytes:bytes.length, durationMs:Math.round(performance.now() - started),
      extension:result.extension || (kind === 'text' ? 'txt' : 'bin'), notice
    };
  } catch (error) {
    const position = error.position;
    const prefix = typeof input === 'string' && position !== undefined ? input.slice(0,position).split(/\r\n|\r|\n/) : [];
    return { status:'error', code:error.code || 'ConversionError', message:error.message.slice(0,600), position, line:error.line ?? (prefix.length || undefined), column:error.column ?? (prefix.length ? prefix.at(-1).length + 1 : undefined) };
  }
}
