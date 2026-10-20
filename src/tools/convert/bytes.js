export const limits = Object.freeze({ text: 10 * 1024 ** 2, file: 50 * 1024 ** 2, output: 100 * 1024 ** 2, preview: 1024 ** 2 });
export const charsets = ['utf-8','utf-16le','utf-16be','gbk','gb18030','big5','shift_jis','euc-kr','windows-1252'];
const registrations = {
  'utf-16le': () => import('@kayahr/text-encoding/encodings/utf-16le'),
  'utf-16be': () => import('@kayahr/text-encoding/encodings/utf-16be'),
  gbk: () => import('@kayahr/text-encoding/encodings/gbk'),
  gb18030: () => import('@kayahr/text-encoding/encodings/gb18030'),
  big5: () => import('@kayahr/text-encoding/encodings/big5'),
  shift_jis: () => import('@kayahr/text-encoding/encodings/shift_jis'),
  'euc-kr': () => import('@kayahr/text-encoding/encodings/euc-kr'),
  'windows-1252': () => import('@kayahr/text-encoding/encodings/windows-1252')
};
export function validText(text) {
  if (!text.isWellFormed()) throw new Error('文本包含孤立的 Unicode 代理项，无法无损编码');
  return text;
}
export function decodeText(bytes, encoding = 'utf-8') {
  if (!charsets.includes(encoding)) throw new Error('不支持的字符集');
  return new TextDecoder(encoding, { fatal: true, ignoreBOM: true }).decode(bytes);
}
export async function encodeText(text, encoding = 'utf-8') {
  validText(text);
  if (!charsets.includes(encoding)) throw new Error('不支持的字符集');
  if (encoding === 'utf-8') return new TextEncoder().encode(text);
  await registrations[encoding]();
  const { TextEncoder: Encoder } = await import('@kayahr/text-encoding/no-encodings');
  const bytes = new Encoder(encoding).encode(text);
  if (decodeText(bytes, encoding) !== text) throw new Error(`所选字符集 ${encoding} 无法无损表示输入字符`);
  return bytes;
}
export function checkSize(size, maximum, label) {
  if (size > maximum) throw new Error(`${label}超过限制（${(maximum / 1024 ** 2).toLocaleString()} MiB）`);
}
export function createInput(input, maximum) {
  const isText = typeof input === 'string';
  let cached;
  return {
    isText,
    async bytes() {
      if (!cached) {
        if (isText) cached = await encodeText(input);
        else if (input instanceof Blob) {
          checkSize(input.size, maximum.file, '文件');
          cached = new Uint8Array(await input.arrayBuffer());
        } else if (input instanceof Uint8Array) cached = input;
        else throw new Error('输入必须为文本或单个文件');
        checkSize(cached.length, isText ? maximum.text : maximum.file, isText ? '文本' : '文件');
      }
      return cached;
    },
    async text() {
      const bytes = await this.bytes();
      return isText ? input : decodeText(bytes);
    }
  };
}
