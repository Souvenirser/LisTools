import microdiff from 'microdiff';
import { visit } from 'jsonc-parser';
import { Change, Chunk } from '@codemirror/merge';
import { Text } from '@codemirror/state';
import { textDiff, inlineDiff } from './text-diff.js';
import { parseDiagnostic, runtimeDiagnostic, errorResult } from './errors.js';

const escapePointer = (key) => String(key).replace(/~/g, '~0').replace(/\//g, '~1');

function numberKey(raw) {
  if (/^-?\d+$/.test(raw)) {
    if (raw === '0' || raw === '-0') return '0';
    const significant = raw.replace(/0+$/, '');
    return `${significant}e${raw.length - significant.length}`;
  }
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
  let root, lastToken, number;
  function fail(code, position, length, line, column, extra) {
    const parent = stack.at(-1);
    const diagnostic = parseDiagnostic(source, code, position, length, line, column, {
      lastToken, number, expectProperty:parent && !Array.isArray(parent.value) && ['{', ','].includes(lastToken), ...extra
    });
    throw Object.assign(new SyntaxError(diagnostic.message), { diagnostic });
  }
  function add(value) {
    const parent = stack.at(-1);
    if (!parent) root = value;
    else if (Array.isArray(parent.value)) parent.value.push(value);
    else parent.value[parent.key] = value;
  }
  function begin(value) { add(value); stack.push({ value }); }
  visit(source[0] === '\ufeff' ? ' ' + source.slice(1) : source, {
    onObjectBegin: () => { begin(Object.setPrototypeOf({}, null)); lastToken = '{'; },
    onArrayBegin: () => { begin([]); lastToken = '['; },
    onObjectEnd: () => { stack.pop(); lastToken = '}'; },
    onArrayEnd: () => { stack.pop(); lastToken = ']'; },
    onObjectProperty: (key, offset, length, line, column) => {
      const parent = stack.at(-1);
      if (Object.hasOwn(parent.value, key)) fail('DuplicateKey', offset, length, line, column, { key });
      parent.key = key;
      lastToken = 'property';
    },
    onLiteralValue: (value, offset, length) => {
      number = typeof value === 'number' ? { from:offset, to:offset + length } : undefined;
      add(number ? parseNumber(source.slice(offset, offset + length), value) : value);
      lastToken = 'value';
    },
    onSeparator: separator => { lastToken = separator; },
    onError: fail
  }, { disallowComments: true, allowTrailingComma: false, allowEmptyContent: false });
  return root;
}

function format(value, numbers, interesting, quote) {
  const parts = [];
  const locations = new Map();
  const indents = [], properties = new Map();
  const indent = depth => indents[depth] ?? (indents[depth] = '  '.repeat(depth));
  function property(key) {
    let text = properties.get(key);
    if (text === undefined) { text = `${quote(key)}: `; if (properties.size < 128) properties.set(key, text); }
    return text;
  }
  let offset = 0;
  const append = (text) => { parts.push(text); offset += text.length; };
  function write(node, depth, pointer, from = offset) {
    const valueFrom = offset;
    const tracked = pointer !== undefined && interesting.has(pointer);
    if (typeof node === 'symbol' || typeof node === 'number') append(numbers.get(node));
    else if (node === null || typeof node !== 'object') append(typeof node === 'string' ? quote(node) : String(node));
    else {
      const array = Array.isArray(node);
      const keys = array ? null : Object.keys(node).sort();
      const length = array ? node.length : keys.length;
      append(array ? '[' : '{');
      for (let i = 0; i < length; i++) {
        const key = array ? i : keys[i];
        append(`${i ? ',' : ''}\n${indent(depth + 1)}`);
        const propertyFrom = offset;
        if (!array) append(property(key));
        write(node[key], depth + 1, tracked ? `${pointer}/${array ? key : escapePointer(key)}` : undefined, propertyFrom);
      }
      if (length) append(`\n${indent(depth)}`);
      append(array ? ']' : '}');
    }
    if (tracked) locations.set(pointer, { from, valueFrom, to: offset });
  }
  write(value, 0, '');
  return { text: parts.join(''), locations };
}

function location(map, pointer) {
  while (!map.has(pointer)) pointer = pointer.slice(0, pointer.lastIndexOf('/'));
  return map.get(pointer);
}

// 结构未变且只修改原始值时，复用左侧排版，仅替换变化值并平移已有位置。
function replaceValues(a, differences, changes, numbers, quote) {
  if (differences.some(change => change.type !== 'CHANGE' || change.oldValue !== null && typeof change.oldValue === 'object' || change.value !== null && typeof change.value === 'object')) return;
  const edits = differences.map((change, index) => {
    const range = a.locations.get(changes[index].pointer), value = change.value;
    return { from:range.valueFrom, to:range.to, text:typeof value === 'symbol' || typeof value === 'number' ? numbers.get(value) : typeof value === 'string' ? quote(value) : JSON.stringify(value) };
  }).sort((x, y) => x.from - y.from);
  const parts = [];
  let from = 0, delta = 0;
  for (const edit of edits) {
    parts.push(a.text.slice(from, edit.from), edit.text); from = edit.to;
    edit.delta = delta += edit.text.length - (edit.to - edit.from);
  }
  parts.push(a.text.slice(from));
  function shifted(position) {
    let low = 0, high = edits.length;
    while (low < high) { const mid = (low + high) >>> 1; if (edits[mid].to <= position) low = mid + 1; else high = mid; }
    return position + (low ? edits[low - 1].delta : 0);
  }
  const locations = new Map();
  for (const [pointer, range] of a.locations) locations.set(pointer, { from:shifted(range.from), valueFrom:shifted(range.valueFrom), to:shifted(range.to) });
  return { text:parts.join(''), locations };
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

// 直接复用结构差异的字段范围，避免再对 JSON 全文做行/字符搜索。
function fieldChanges(changes, a, b, gaps) {
  const ranges = changes.map(change => {
    const gap = gaps.get(change.pointer);
    if (gap) {
      const bounds = map => ({ from:gap.before === undefined ? map.get(gap.parent).valueFrom + 1 : map.get(gap.before).to,
        to:gap.after === undefined ? map.get(gap.parent).to - 1 : map.get(gap.after).from });
      const old = bounds(a.locations), next = bounds(b.locations);
      return new Change(old.from, old.to, next.from, next.to);
    }
    const old = location(a.locations, change.pointer), next = location(b.locations, change.pointer);
    return new Change(old.from, old.to, next.from, next.to);
  }).sort((x, y) => x.fromA - y.fromA || x.fromB - y.fromB);
  const merged = [];
  for (const range of ranges) {
    const previous = merged.at(-1);
    if (previous && (range.fromA < previous.toA || range.fromB < previous.toB)) {
      previous.fromA = Math.min(previous.fromA, range.fromA); previous.toA = Math.max(previous.toA, range.toA);
      previous.fromB = Math.min(previous.fromB, range.fromB); previous.toB = Math.max(previous.toB, range.toB);
    } else merged.push(range);
  }
  let endA = 0, endB = 0;
  for (const range of merged) {
    if (a.text.slice(endA, range.fromA) !== b.text.slice(endB, range.fromB)) { range.fromA = endA; range.fromB = endB; }
    endA = range.toA; endB = range.toB;
  }
  if (a.text.slice(endA) !== b.text.slice(endB)) merged.push(new Change(endA, a.text.length, endB, b.text.length));
  let coarse = false;
  const refined = [], deadline = performance.now() + 100;
  for (const range of merged) {
    const local = inlineDiff(a.text.slice(range.fromA, range.toA), b.text.slice(range.fromB, range.toB), Math.min(20, deadline - performance.now()));
    coarse ||= Boolean(local.coarse);
    for (const change of local) refined.push(change.offset(range.fromA, range.fromB));
  }
  return Object.defineProperty(refined, 'coarse', { value:coarse });
}

// 为新增/删除记录两侧共有的相邻字段，回退范围只包含插入/删除及其标点。
function gapLocations(differences, left, right, interesting) {
  const gaps = new Map(), parents = new Map();
  for (const { type, path } of differences) {
    if (type === 'CHANGE') continue;
    const keys = path.slice(1), key = keys.at(-1);
    const parent = keys.slice(0, -1).map(key => `/${escapePointer(key)}`).join('');
    if (!parents.has(parent)) {
      let a = left, b = right;
      for (const key of keys.slice(0, -1)) { a = a[key]; b = b[key]; }
      let common = Object.keys(a).filter(key => Object.hasOwn(b, key));
      common = Array.isArray(a) ? common.map(Number).sort((x, y) => x - y) : common.sort();
      parents.set(parent, common);
    }
    const common = parents.get(parent);
    let low = 0, high = common.length;
    while (low < high) { const mid = (low + high) >>> 1; if (common[mid] < key) low = mid + 1; else high = mid; }
    const before = low ? `${parent}/${escapePointer(common[low - 1])}` : undefined;
    const after = low < common.length ? `${parent}/${escapePointer(common[low])}` : undefined;
    if (before !== undefined) interesting.add(before);
    if (after !== undefined) interesting.add(after);
    gaps.set(keys.map(key => `/${escapePointer(key)}`).join(''), { parent, before, after });
  }
  return gaps;
}

export function compareJson(leftSource, rightSource) {
  const start = performance.now();
  let previous = start;
  const phaseMs = {};
  const mark = name => { const now = performance.now(); phaseMs[name] = Math.round(now - previous); previous = now; };
  const validation = { left:'unchecked', right:'unchecked' };
  let stage = 'compare';
  try {
    const pool = new Map();
    const numbers = new Map();
    const parseNumber = (raw, value) => {
      const ordinaryInteger = /^-?\d{1,15}$/.test(raw);
      if (ordinaryInteger) {
        value = value === 0 ? 0 : value;
        if (!numbers.has(value)) numbers.set(value, raw);
        return value;
      }
      const key = numberKey(raw);
      // 指数或小数只有与安全整数完全等值时才共用该整数；其余仍使用无损标记。
      if (Number.isSafeInteger(value) && numberKey(String(value)) === key) {
        value = value === 0 ? 0 : value;
        if (!numbers.has(value)) numbers.set(value, raw);
        return value;
      }
      if (!pool.has(key)) {
        const token = Symbol();
        pool.set(key, token);
        numbers.set(token, raw);
      }
      return pool.get(key);
    };
    const issues = [];
    function parseSide(source, side) {
      try { const value = parseStrict(source, parseNumber); validation[side] = 'valid'; return value; }
      catch (error) {
        const issue = { ...(error.diagnostic || runtimeDiagnostic(error, 'parse')), side };
        validation[side] = issue.category === 'syntax' ? 'invalid' : 'incomplete';
        issues.push(issue);
      }
    }
    const left = parseSide(leftSource, 'left');
    mark('parseLeftMs');
    let right;
    if (leftSource === rightSource) {
      right = left;
      validation.right = validation.left;
      if (issues.length) issues.push({ ...issues[0], side:'right' });
    } else right = parseSide(rightSource, 'right');
    mark('parseRightMs');
    if (issues.length) return errorResult(issues, validation);
    const differences = left === right ? [] : microdiff({ root: left }, { root: right }, { cyclesFix: false });
    const changes = differences.map(({ type, path }) => ({
      type, pointer: path.slice(1).map(key => `/${escapePointer(key)}`).join('')
    }));
    mark('structureMs');
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
    const gaps = gapLocations(differences, left, right, interesting);
    mark('prepareMs');
    stage = 'format';
    const quoted = new Map();
    const quote = value => {
      const cached = quoted.get(value);
      if (cached !== undefined) return cached;
      const text = JSON.stringify(value);
      if (quoted.size < 128 && value.length <= 4096) quoted.set(value, text);
      return text;
    };
    const a = format(left, numbers, interesting, quote);
    mark('formatLeftMs');
    const b = !changes.length ? a : replaceValues(a, differences, changes, numbers, quote) || format(right, numbers, interesting, quote);
    mark('formatRightMs');
    stage = 'compare';
    const textChanges = fieldChanges(changes, a, b, gaps);
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
    mark('highlightMs');
    return {
      status: 'ready', coarse:Boolean(textChanges.coarse), validation, phaseMs, total: changes.length, counts, changes,
      leftText: a.text, rightText: b.text, textChanges,
      durationMs: Math.round(performance.now() - start)
    };
  } catch (error) {
    return errorResult([runtimeDiagnostic(error, stage)], validation);
  }
}

export function compareText(leftSource, rightSource) {
  const start = performance.now();
  const leftText = leftSource.replace(/\r\n?/g, '\n');
  const rightText = rightSource.replace(/\r\n?/g, '\n');
  const textChanges = textDiff(leftText, rightText);
  const a = Text.of(leftText.split('\n')), b = Text.of(rightText.split('\n'));
  const counts = { added: 0, removed: 0, modified: 0 };
  const changes = Chunk.build(a, b, { override: () => textChanges }).map(chunk => {
    const fromA = Math.min(chunk.fromA, a.length), toA = Math.min(chunk.endA, a.length);
    const fromB = Math.min(chunk.fromB, b.length), toB = Math.min(chunk.endB, b.length);
    const type = fromA === toA ? 'CREATE' : fromB === toB ? 'REMOVE' : 'CHANGE';
    counts[{ CREATE: 'added', REMOVE: 'removed', CHANGE: 'modified' }[type]] += 1;
    const lines = (doc, from, to) => {
      const first = doc.lineAt(from).number, last = doc.lineAt(to).number;
      return first === last ? `${first}` : `${first}–${last}`;
    };
    return {
      type, fromA, toA, fromB, toB,
      anchorA: Math.min(fromA + chunk.changes[0].fromA, a.length),
      anchorB: Math.min(fromB + chunk.changes[0].fromB, b.length),
      lines: { left: lines(a, fromA, toA), right: lines(b, fromB, toB) },
      label: `原 第 ${lines(a, fromA, toA)} 行 → 新 第 ${lines(b, fromB, toB)} 行`
    };
  });
  return { status: 'ready', coarse:Boolean(textChanges.coarse), total: changes.length, counts, changes, leftText, rightText, textChanges, durationMs: Math.round(performance.now() - start) };
}
