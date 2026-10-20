import { base64, base64url, base32, base32hex, base58, hex } from '@scure/base';
import { checkSize, decodeText, encodeText } from './bytes.js';

const coders = { base64, base64url, base32, base32hex, base58, hex };
export function decodeBase(source, id = 'base64') {
  let text = source;
  if (['base64','base64url','base32','base32hex'].includes(id)) {
    const multiple = id.startsWith('base32') ? 8 : 4;
    if (text.includes('=')) {
      if (text.length % multiple || !/^[^=]*=+$/.test(text)) throw new Error('补位位置或长度不合法');
    } else text += '='.repeat((multiple - text.length % multiple) % multiple);
  }
  return coders[id].decode(id === 'hex' ? text.toLowerCase() : text);
}

export async function run(id, input, options, maximum) {
  const decode = options.direction === 'decode';
  if (Object.hasOwn(coders, id) || id === 'binary') {
    if (decode) {
      const source = await input.text();
      if (id === 'base58' && source.length > 4096) throw new Error('Base58 上限为原始字节 2 KiB / 编码文本 4 KiB（上游库限制）；大文件请使用 Base64 或 Hex');
      if (id === 'binary') {
        const text = source.replace(/[ \t\r\n]/g, '');
        if (/[^01]/.test(text) || text.length % 8) throw new Error('二进制字节串必须由完整的 8 位字节组成');
        checkSize(text.length / 8, maximum.output, '输出');
        return { bytes: Uint8Array.from(text.match(/.{8}/g) || [], b => parseInt(b, 2)) };
      }
      return { bytes: decodeBase(source, id) };
    }
    const bytes = input.isText ? await encodeText(await input.text(), options.charset || 'utf-8') : await input.bytes();
    if (id === 'base58' && bytes.length > 2048) throw new Error('Base58 上限为原始字节 2 KiB / 编码文本 4 KiB（上游库限制）；大文件请使用 Base64 或 Hex');
    const factor = { base64:4/3, base64url:4/3, base32:8/5, base32hex:8/5, hex:2, binary:8, base58:1.366 }[id];
    checkSize(Math.ceil(bytes.length * factor), maximum.output, '输出');
    if (id === 'binary') return { text: Array.from(bytes, b => b.toString(2).padStart(8,'0')).join('') };
    let text = coders[id].encode(bytes);
    if (id === 'base64url') text = text.replace(/=+$/, '');
    return { text };
  }
  if (id === 'charset') {
    const source = input.isText ? await input.text() : decodeText(await input.bytes(), options.from || 'utf-8');
    return { bytes: await encodeText(source, options.to || 'utf-8'), displayEncoding: options.to || 'utf-8', extension:'bin' };
  }
  const source = await input.text();
  if (id === 'url-component') return { text: decode ? decodeURIComponent(source) : encodeURIComponent(source) };
  if (id === 'uri') return { text: decode ? decodeURI(source) : encodeURI(source) };
  if (id === 'form') return { text: decode ? decodeURIComponent(source.replace(/\+/g,' ')) : encodeURIComponent(source).replace(/%20/g,'+') };
  if (id === 'html-entities' || id === 'xml-entities') {
    const entities = await import('entities');
    const name = `${decode ? 'decode' : 'encode'}${id === 'html-entities' ? 'HTML' : 'XML'}`;
    return { text: entities[name](source) };
  }
  if (id === 'json-string' || id === 'unicode') {
    if (decode) {
      const text = JSON.parse(id === 'unicode' ? `"${source}"` : source);
      if (typeof text !== 'string') throw new Error('输入必须为 JSON 字符串，不能是对象或表达式');
      return { text };
    }
    const { default: jsesc } = await import('jsesc');
    return { text: jsesc(source, { json:true, wrap:id === 'json-string' }) };
  }
  if (id === 'codepoints') {
    if (!decode) return { text: Array.from(source, c => `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4,'0')}`).join(' ') };
    const values = source ? source.split(/\s+/) : [];
    if (values.some(v => !/^U\+[\dA-F]{4,6}$/i.test(v))) throw new Error('码点格式应为 U+4E2D U+1F642');
    return { text: values.map(v => String.fromCodePoint(parseInt(v.slice(2),16))).join('') };
  }
  if (id === 'jwt') {
    const parts = source.split('.');
    if (parts.length !== 3) throw new Error('仅支持三段式 JWT；五段式 JWE 需要解密，不能直接解码');
    const { parseJson, stringifyJson } = await import('./json.js');
    const read = value => parseJson(decodeText(decodeBase(value,'base64url')));
    const header = read(parts[0]), payload = read(parts[1]);
    if (!header || Array.isArray(header) || typeof header !== 'object' || !payload || Array.isArray(payload) || typeof payload !== 'object') throw new Error('JWT 头部和载荷必须为 JSON 对象');
    decodeBase(parts[2],'base64url');
    return { text:stringifyJson({ header,payload,signature:parts[2] }), extension:'json', notice:'仅解码，未验签；解码成功不表示令牌可信或有效' };
  }
  throw new Error('未找到编码工具');
}
