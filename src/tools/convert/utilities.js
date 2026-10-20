import { checkSize, encodeText } from './bytes.js';
import { decodeBase } from './codecs.js';
import { parseJson, LosslessNumber } from './json.js';

async function hashFunction(name) {
  if (['md5','sha1','ripemd160'].includes(name)) return (await import('@noble/hashes/legacy.js'))[name];
  if (['sha224','sha256','sha384','sha512'].includes(name)) return (await import('@noble/hashes/sha2.js'))[name];
  if (['sha3-256','sha3-512'].includes(name)) return (await import('@noble/hashes/sha3.js'))[name.replace('-','_')];
  if (['blake2b','blake2s'].includes(name)) return (await import('@noble/hashes/blake2.js'))[name];
  if (name === 'blake3') return (await import('@noble/hashes/blake3.js')).blake3;
  throw new Error('不支持的摘要算法');
}
function hex(bytes) { return Array.from(bytes,b => b.toString(16).padStart(2,'0')).join(''); }
async function hash(input, options, keyed) {
  const bytes = await input.bytes(), algorithm = options.algorithm || 'sha256';
  if (!keyed && algorithm === 'crc32') {
    const { default: CRC32 } = await import('crc-32');
    return {text:(CRC32.buf(bytes) >>> 0).toString(16).padStart(8,'0')};
  }
  const fn = await hashFunction(algorithm);
  if (!keyed) return {text:hex(fn(bytes))};
  if (!['sha256','sha384','sha512'].includes(algorithm)) throw new Error('HMAC 仅支持 SHA-256/384/512');
  const { hmac } = await import('@noble/hashes/hmac.js');
  const key = options.keyFormat === 'hex' || options.keyFormat === 'base64' ? decodeBase(options.key || '', options.keyFormat) : await encodeText(options.key || '');
  return {text:hex(hmac(fn,key,bytes))};
}
async function compression(id, input, options, maximum) {
  const lib = await import('fflate');
  const decoding = options.direction === 'decode';
  const format = options.inputFormat || 'raw';
  const bytes = format === 'raw' ? await input.bytes() : decodeBase(await input.text(),format);
  const chunks = [];
  let total = 0, finished = false;
  function append(chunk, final) {
    total += chunk.length;
    checkSize(total,maximum.output,'压缩/解压输出');
    chunks.push(chunk);
    finished = final;
  }
  if (decoding) {
    // Native streams validate checksums and truncation; fflate's decoders do not.
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream({gzip:'gzip',zlib:'deflate',deflate:'deflate-raw'}[id]));
    const reader = stream.getReader();
    try {
      for (;;) {
        const {value,done} = await reader.read();
        if (done) { finished = true; break; }
        append(value,false);
      }
    } catch (error) {
      await reader.cancel().catch(() => {});
      throw new Error(`解压失败：数据损坏、校验不通过或超出限制（${error.message}）`);
    } finally { reader.releaseLock(); }
  } else {
    const name = {gzip:'Gzip',zlib:'Zlib',deflate:'Deflate'}[id];
    const stream = new lib[name]({level:6},append);
    if (!bytes.length) stream.push(bytes,true);
    for (let start=0;start<bytes.length;start+=65536) stream.push(bytes.subarray(start,start+65536),start+65536 >= bytes.length);
  }
  if (!finished) throw new Error('压缩数据不完整');
  const output = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) { output.set(chunk,at); at += chunk.length; }
  const outputFormat = options.outputFormat || (decoding ? 'raw' : 'base64');
  if (outputFormat !== 'raw') {
    checkSize(total * (outputFormat === 'hex' ? 2 : 4/3),maximum.output,'输出');
    const bases = await import('@scure/base');
    return {text:bases[outputFormat].encode(output)};
  }
  return {bytes:output,extension:decoding ? 'bin' : {gzip:'gz',zlib:'zlib',deflate:'deflate'}[id]};
}
function radix(source, options) {
  const from = Number(options.from || 10), to = Number(options.to || 16);
  if (![from,to].every(n => Number.isInteger(n) && n >= 2 && n <= 36)) throw new Error('进制必须是 2～36 的整数');
  let text = source.trim().toLowerCase(), sign = 1n;
  if (/^[+-]/.test(text)) { if (text[0] === '-') sign = -1n; text = text.slice(1); }
  const prefix = {2:'0b',8:'0o',16:'0x'}[from];
  if (prefix && text.startsWith(prefix)) text = text.slice(2);
  if (!text || text.length > 10000) throw new Error('请输入最多 10000 位的整数');
  let value = 0n;
  for (const c of text) {
    const digit = '0123456789abcdefghijklmnopqrstuvwxyz'.indexOf(c);
    if (digit < 0 || digit >= from) throw new Error('输入包含不属于所选进制的数字');
    value = value * BigInt(from) + BigInt(digit);
  }
  return {text:(sign * value).toString(to)};
}
async function units(source, options, duration) {
  const { default: Decimal } = await import('decimal.js');
  const D = Decimal.clone({precision:200,rounding:Decimal.ROUND_HALF_UP});
  const values = duration ? {ns:'1',us:'1000',ms:'1000000',s:'1000000000',min:'60000000000',h:'3600000000000',d:'86400000000000'} : {
    b:'0.125',B:'1',kB:'1000',MB:'1e6',GB:'1e9',TB:'1e12',PB:'1e15',EB:'1e18',
    KiB:'1024',MiB:'1048576',GiB:'1073741824',TiB:'1099511627776',PiB:'1125899906842624',EiB:'1152921504606846976'
  };
  const from = options.from || (duration ? 's' : 'B'), to = options.to || (duration ? 'ms' : 'KiB');
  if (!Object.hasOwn(values,from) || !Object.hasOwn(values,to)) throw new Error('请选择受支持的单位；MB 为十进制，MiB 为二进制');
  const raw = source.trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw) || raw.split(/e/i)[0].replace(/\D/g,'').replace(/^0+/,'').length > 100) throw new Error('请输入最多 100 位有效数字的有限十进制数');
  const value = new D(raw);
  if (!value.isFinite() || Math.abs(value.e) > 10000) throw new Error('数值或指数超出支持范围');
  const result = value.mul(values[from]).div(values[to]);
  const shown = result.toSignificantDigits(30);
  const approximate = !result.eq(shown);
  return {text:`${approximate ? '≈ ' : ''}${shown.toString()}`,notice:`${from} → ${to}；200 位计算精度，显示最多 30 位有效数字${approximate ? '，结果已舍入' : ''}`};
}
async function color(source, options) {
  const { colord } = await import('colord');
  let value = source;
  if (source.trim().startsWith('{')) {
    const record = parseJson(source);
    value = Object.fromEntries(Object.entries(record).map(([k,v]) => [k,v instanceof LosslessNumber ? Number(v.value) : v]));
  }
  const color = colord(value);
  if (!color.isValid()) throw new Error('请输入合法 HEX、RGB、HSL，或含 h/s/v/a 的 HSV JSON 对象');
  const methods = {hex:'toHex',rgb:'toRgbString',hsl:'toHslString',hsv:'toHsv'};
  if (!methods[options.format || 'hex']) throw new Error('不支持的颜色输出格式');
  const result = color[methods[options.format || 'hex']]();
  return {text:typeof result === 'string' ? result : JSON.stringify(result,null,2),notice:'保留透明度；颜色格式存在色深量化与舍入，HEX 为 8 位/通道精度'};
}
function lines(source, operation) {
  const pieces = source.split(/(\r\n|\r|\n)/), endings = pieces.filter((_,i) => i % 2);
  let rows = pieces.flatMap((text,i) => i % 2 ? [] : [{text,ending:pieces[i+1] || ''}]);
  const trailing = /[\r\n]$/.test(source);
  if (trailing) rows.pop();
  if (operation === 'trim') rows = rows.map(row => ({...row,text:row.text.trim()}));
  else if (operation === 'remove-empty') rows = rows.filter(row => row.text.trim() !== '');
  else if (operation === 'dedupe') {
    const seen = new Set();
    rows = rows.filter(row => { if (seen.has(row.text)) return false; seen.add(row.text); return true; });
  } else if (operation === 'sort') rows.sort((a,b) => a.text < b.text ? -1 : a.text > b.text ? 1 : 0);
  else throw new Error('请选择逐行处理操作');
  return rows.map((row,i) => row.text + (i < rows.length-1 ? row.ending || endings[0] || '\n' : trailing ? row.ending || endings.at(-1) : '')).join('');
}
export async function run(id, input, options, maximum) {
  if (id === 'hash' || id === 'hmac') return hash(input,options,id === 'hmac');
  if (['gzip','zlib','deflate'].includes(id)) return compression(id,input,options,maximum);
  const source = await input.text();
  if (id === 'radix') return radix(source,options);
  if (id === 'bytes-unit' || id === 'duration-unit') return units(source,options,id === 'duration-unit');
  if (id === 'color') return color(source,options);
  if (id === 'case') {
    if (options.style === 'upper') return {text:source.toUpperCase()};
    if (options.style === 'lower') return {text:source.toLowerCase()};
    const lib = await import('change-case');
    const method = {camel:'camelCase',pascal:'pascalCase',snake:'snakeCase',kebab:'kebabCase',constant:'constantCase'}[options.style || 'camel'];
    if (!method) throw new Error('请选择命名转换方式');
    return {text:lib[method](source)};
  }
  if (id === 'lines') return {text:lines(source,options.operation || 'dedupe')};
  if (id === 'newline') {
    const ending = {lf:'\n',crlf:'\r\n',cr:'\r'}[options.ending || 'lf'];
    if (!ending) throw new Error('请选择换行符');
    return {text:source.replace(/\r\n|\r|\n/g,ending)};
  }
  if (id === 'normalize') return {text:source.normalize(options.form || 'NFC'),notice:'Unicode 规范化为显式转换，可能改变码点表示'};
  throw new Error('未找到工具');
}
