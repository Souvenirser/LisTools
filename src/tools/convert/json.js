import { visit, printParseErrorCode } from 'jsonc-parser';
import { LosslessNumber } from 'lossless-json';
export { LosslessNumber };

// Reuse the strict visitor used by JSON diff, with safe records and raw number literals.
export function parseJson(source) {
  const stack = [];
  let root;
  function fail(message, position) {
    const lines = source.slice(0,position).split(/\r\n|\r|\n/);
    throw Object.assign(new SyntaxError(message), { position, line:lines.length, column:lines.at(-1).length + 1 });
  }
  function add(value) {
    const parent = stack.at(-1);
    if (!parent) root = value;
    else if (Array.isArray(parent.value)) parent.value.push(value);
    else parent.value[parent.key] = value;
  }
  const begin = value => { add(value); stack.push({value}); };
  visit(source, {
    onObjectBegin: () => begin(Object.create(null)), onArrayBegin: () => begin([]),
    onObjectEnd: () => { stack.pop(); }, onArrayEnd: () => { stack.pop(); },
    onObjectProperty: (key, offset) => {
      const parent = stack.at(-1);
      if (Object.hasOwn(parent.value,key)) fail(`重复字段：${key}`,offset);
      parent.key = key;
    },
    onLiteralValue: (value, offset, length) => add(typeof value === 'number' ? new LosslessNumber(source.slice(offset,offset+length)) : value),
    onError: (code, offset) => fail(printParseErrorCode(code),offset)
  }, { disallowComments:true, allowTrailingComma:false, allowEmptyContent:false });
  return root;
}

// LosslessJSON.stringify identifies numbers by a user-spoofable property; use instance identity.
export function stringifyJson(value, indent = 2) {
  const active = new Set();
  function write(value, depth) {
    if (value instanceof LosslessNumber) return value.value;
    if (typeof value === 'bigint') return value.toString();
    if (value === null || ['string','boolean'].includes(typeof value)) return JSON.stringify(value);
    if (typeof value === 'number' && Number.isFinite(value)) return Object.is(value,-0) ? '-0' : String(value);
    if (!value || typeof value !== 'object') throw new Error('包含无法表达为 JSON 的数据类型');
    if (active.has(value)) throw new Error('循环引用无法转换为 JSON');
    active.add(value);
    const array = Array.isArray(value), keys = array ? value.map((_,i) => i) : Object.keys(value);
    const entries = keys.map(key => `${array ? '' : JSON.stringify(key) + (indent ? ': ' : ':')}${write(value[key],depth+1)}`);
    const pad = n => ' '.repeat(indent*n);
    const body = indent && entries.length ? `\n${pad(depth+1)}${entries.join(`,\n${pad(depth+1)}`)}\n${pad(depth)}` : entries.join(',');
    active.delete(value);
    return `${array ? '[' : '{'}${body}${array ? ']' : '}'}`;
  }
  return write(value,0);
}
