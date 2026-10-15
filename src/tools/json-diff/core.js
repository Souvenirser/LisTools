import microdiff from 'microdiff';
import { visit, printParseErrorCode } from 'jsonc-parser';
import { diff } from '@codemirror/merge';

const escapePointer = (key) => String(key).replace(/~/g, '~0').replace(/\//g, '~1');

function numberKey(raw) {
  const [mantissa, exponent = '0'] = raw.toLowerCase().split('e');
  const fraction = mantissa.split('.')[1] || '';
  const digits = mantissa.replace(/[-.]/g, '').replace(/^0+/, '');
  const significant = digits.replace(/0+$/, '');
  if (!significant) return '0';
  const power = BigInt(exponent) - BigInt(fraction.length) + BigInt(digits.length - significant.length);
  return `${raw[0] === '-' ? '-' : ''}${significant}e${power}`;
}

function parseStrict(source, parseNumber) {
  const stack = [];
  let root;
  function fail(message, position) {
    const error = new SyntaxError(message);
    const lines = source.slice(0, position).split('\n');
    Object.assign(error, { position, line: lines.length, column: lines.at(-1).length + 1 });
    throw error;
  }
  function add(value) {
    const parent = stack.at(-1);
    if (!parent) root = value;
    else if (Array.isArray(parent.value)) parent.value.push(value);
    else parent.value[parent.key] = value;
  }
  function begin(value) { add(value); stack.push({ value }); }
  visit(source, {
    onObjectBegin: () => begin(Object.create(null)),
    onArrayBegin: () => begin([]),
    onObjectEnd: () => { stack.pop(); },
    onArrayEnd: () => { stack.pop(); },
    onObjectProperty: (key, offset) => {
      const parent = stack.at(-1);
      if (Object.hasOwn(parent.value, key)) fail(`重复字段：${key}`, offset);
      parent.key = key;
    },
    onLiteralValue: (value, offset, length) => add(typeof value === 'number' ? parseNumber(source.slice(offset, offset + length)) : value),
    onError: (code, offset) => fail(printParseErrorCode(code), offset)
  }, { disallowComments: true, allowTrailingComma: false, allowEmptyContent: false });
  return root;
}

function format(value, numbers, interesting) {
  const parts = [];
  const locations = new Map();
  let offset = 0;
  const append = (text) => { parts.push(text); offset += text.length; };
  function write(node, depth, pointer, from = offset) {
    if (typeof node === 'symbol') append(numbers.get(node));
    else if (node === null || typeof node !== 'object') append(JSON.stringify(node));
    else {
      const array = Array.isArray(node);
      const keys = array ? null : Object.keys(node).sort();
      const length = array ? node.length : keys.length;
      append(array ? '[' : '{');
      for (let i = 0; i < length; i++) {
        const key = array ? i : keys[i];
        append(`${i ? ',' : ''}\n${'  '.repeat(depth + 1)}`);
        const propertyFrom = offset;
        if (!array) append(`${JSON.stringify(key)}: `);
        write(node[key], depth + 1, interesting.size ? `${pointer}/${escapePointer(key)}` : '', propertyFrom);
      }
      if (length) append(`\n${'  '.repeat(depth)}`);
      append(array ? ']' : '}');
    }
    if (interesting.has(pointer)) locations.set(pointer, { from, to: offset });
  }
  write(value, 0, '');
  return { text: parts.join(''), locations };
}

function location(map, pointer) {
  while (!map.has(pointer)) pointer = pointer.slice(0, pointer.lastIndexOf('/'));
  return map.get(pointer);
}

function intersect(changes, from, to, side) {
  let low = 0, high = changes.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (changes[mid][`to${side}`] < from) low = mid + 1;
    else high = mid;
  }
  const change = changes[low];
  return change && change[`from${side}`] <= to ? change : undefined;
}

export function compareJson(leftSource, rightSource) {
  const start = performance.now();
  let side = 'left';
  try {
    const pool = new Map();
    const numbers = new Map();
    const parseNumber = (raw) => {
      const key = numberKey(raw);
      if (!pool.has(key)) {
        const token = Symbol();
        pool.set(key, token);
        numbers.set(token, raw);
      }
      return pool.get(key);
    };
    const left = parseStrict(leftSource, parseNumber);
    side = 'right';
    const right = leftSource === rightSource ? left : parseStrict(rightSource, parseNumber);
    const changes = left === right ? [] : microdiff({ root: left }, { root: right }, { cyclesFix: false }).map(({ type, path }) => ({
      type, pointer: path.slice(1).map(key => `/${escapePointer(key)}`).join('')
    }));
    const interesting = new Set();
    const counts = { added: 0, removed: 0, modified: 0 };
    for (const change of changes) {
      counts[{ CREATE: 'added', REMOVE: 'removed', CHANGE: 'modified' }[change.type]] += 1;
      let path = change.pointer;
      while (!interesting.has(path)) {
        interesting.add(path);
        if (!path) break;
        path = path.slice(0, path.lastIndexOf('/'));
      }
    }
    const a = format(left, numbers, interesting);
    const b = left === right ? a : format(right, numbers, interesting);
    const textChanges = a.text === b.text ? [] : diff(a.text, b.text, { scanLimit: 500, timeout: 250 });
    for (const change of changes) {
      const old = location(a.locations, change.pointer);
      const next = location(b.locations, change.pointer);
      const textChange = change.type === 'CREATE' ? intersect(textChanges, next.from, next.to, 'B') : intersect(textChanges, old.from, old.to, 'A');
      Object.assign(change, {
        fromA: old.from, toA: old.to, fromB: next.from, toB: next.to,
        anchorA: textChange ? Math.max(change.type === 'CREATE' ? 0 : old.from, textChange.fromA) : old.from,
        anchorB: textChange ? Math.max(change.type === 'REMOVE' ? 0 : next.from, textChange.fromB) : next.from
      });
    }
    changes.sort((x, y) => x.fromB - y.fromB || x.fromA - y.fromA);
    return {
      status: 'ready', total: changes.length, counts, changes,
      leftText: a.text, rightText: b.text, textChanges,
      durationMs: Math.round(performance.now() - start)
    };
  } catch (error) {
    return { status: 'error', side, message: error.message, line: error.line, column: error.column, position: error.position };
  }
}
