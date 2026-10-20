import test from 'node:test';
import assert from 'node:assert/strict';
import { compareJson } from '../src/tools/json-diff/core.js';
import * as errors from '../src/tools/json-diff/errors.js';

test('截图中的非法标点明确归属左侧，给出中文原因、字符编号及修正建议', () => {
  const result = compareJson('{"1":"b"， "12":"b"}', '{"1":"b","12":"a"}');
  assert.equal(result.status, 'error');
  assert.equal(result.issues?.length, 1);
  const issue = result.issues[0];
  assert.equal(issue.side, 'left');
  assert.match(issue.message, /中文逗号/);
  assert.match(issue.hint, /英文逗号/);
  assert.match(issue.character, /U\+FF0C/);
  assert.equal(issue.line, 1);
  assert.equal(issue.column, 9);
  assert.deepEqual(result.validation, { left: 'invalid', right: 'valid' });
});

test('两侧分别校验；相同错误文本也必须在两侧明确显示', () => {
  for (const [left, right] of [['{"a":}', '[1,]'], ['{"a":}', '{"a":}']]) {
    const result = compareJson(left, right);
    assert.equal(result.issues?.length, 2);
    assert.deepEqual(result.issues.map(i => i.side), ['left', 'right']);
    assert.deepEqual(result.validation, { left: 'invalid', right: 'invalid' });
  }
  const right = compareJson('{}', '{"a":}');
  assert.deepEqual(right.validation, { left: 'valid', right: 'invalid' });
});

test('常见语法错误输出具体中文说明，不透传英文解析码', () => {
  const cases = [
    ['  ', /为空/], ["{'a':'b'}", /双引号/], ['{a:1}', /双引号/],
    ['{"a" 1}', /冒号/], ['{"a":1 "b":2}', /逗号/], ['{"a":1,}', /末尾.*逗号/],
    ['[1,]', /末尾.*逗号/], ['{"a":}', /缺少.*值/], ['{"a":1', /结束.*}/],
    ['[1', /结束.*\]/], ['{"a":"x}', /字符串.*双引号/],
    [String.raw`{"a":"\q"}`, /转义/], [String.raw`{"a":"\u12G4"}`, /Unicode/],
    ['{"a":01}', /数字/], ['1e+', /数字/], ['/* note */{}', /注释/],
    ['{} {}', /根值|多余内容/], ['{"a":1,"a":2}', /重复/]
  ];
  for (const [source, message] of cases) {
    const result = compareJson(source, '{}');
    assert.equal(result.status, 'error', source);
    assert.match(result.message, message, source);
    assert.ok(result.issues?.[0].hint, source);
    assert.doesNotMatch(result.message, /InvalidSymbol|Expected|UnexpectedEnd|SyntaxError/);
  }
});

test('零宽字符可见，合法字符串内的中文标点不会误报', () => {
  const result = compareJson('{"a":1\u200b}', '{}');
  assert.match(result.message, /零宽/);
  assert.match(result.issues[0].character, /U\+200B/);
  assert.equal(compareJson('{"a":"中文，冒号：弯引号“”"}', '{}').status, 'ready');
  assert.match(compareJson('{"a":1😀}', '{}').issues[0].character, /U\+1F600/);
});

test('LF、CRLF、CR 的行列一致，未闭合字符串定位到末尾', () => {
  for (const newline of ['\n', '\r\n', '\r']) {
    const result = compareJson(`{${newline}"a": ]${newline}}`, '{}');
    assert.equal(result.line, 2);
    assert.equal(result.column, 6);
  }
  const text = '{"a":"未结束';
  const end = compareJson(text, '{}');
  assert.equal(end.position, text.length);
  assert.equal(end.issues[0].excerpt.token, '文件末尾');
});

test('错误诊断仅返回附近片段，大 JSON 不被整份复制进错误消息', () => {
  const text = '{"text":"' + 'x'.repeat(1000000) + '"，"b":1}';
  const result = compareJson(text, '{}');
  assert.equal(result.status, 'error');
  assert.ok(JSON.stringify(result).length < 3000);
  assert.ok(result.issues?.[0].excerpt);
});

test('两侧合法时格式化异常属于工具阶段，不得归为右侧 JSON 不合法', () => {
  const stringify = JSON.stringify;
  let result;
  try {
    JSON.stringify = () => { throw new Error('Synthetic formatting failure'); };
    result = compareJson('{"a":1}', '{"a":2}');
  } finally { JSON.stringify = stringify; }
  assert.equal(result.status, 'error');
  assert.equal(result.side, undefined);
  assert.equal(result.issues?.[0].stage, 'format');
  assert.deepEqual(result.validation, { left: 'valid', right: 'valid' });
  assert.match(result.message, /生成|格式化/);
  assert.doesNotMatch(result.message, /Synthetic/);
});

test('运行异常中文化并区分嵌套限制与普通错误，不一概称为内存不足', () => {
  assert.equal(typeof errors.runtimeDiagnostic, 'function');
  const deep = errors.runtimeDiagnostic(new RangeError('Maximum call stack size exceeded'), 'parse', 'left');
  assert.match(deep.message, /嵌套/);
  assert.equal(deep.category, 'runtime');
  const ordinary = errors.runtimeDiagnostic(new RangeError('Unexpected error'), 'compare');
  assert.doesNotMatch(ordinary.message, /内存|Unexpected/);
  for (const stage of ['worker', 'compare', 'format', 'render', 'read']) {
    const issue = errors.runtimeDiagnostic(new Error('English implementation detail'), stage);
    assert.match(issue.message, /[\u4e00-\u9fff]/u);
    assert.doesNotMatch(issue.message, /English/);
  }
});

test('文件以严格 UTF-8 解码，兼容 BOM，编码与读取失败均保留所在侧', async () => {
  assert.equal(typeof errors.readDiffFile, 'function');
  const bom = new File([new Uint8Array([239, 187, 191]), '{"a":"你好"}'], 'bom.json');
  assert.equal(await errors.readDiffFile(bom, 'left'), '{"a":"你好"}');
  await assert.rejects(errors.readDiffFile(new File([new Uint8Array([192, 175])], 'bad.json'), 'right'), error => {
    assert.equal(error.diagnostic.side, 'right');
    assert.equal(error.diagnostic.stage, 'read');
    assert.match(error.diagnostic.message, /UTF-8/);
    return true;
  });
  await assert.rejects(errors.readDiffFile({ arrayBuffer: async () => { throw new Error('Access denied'); } }, 'left'), error => {
    assert.equal(error.diagnostic.side, 'left');
    assert.match(error.diagnostic.message, /读取/);
    assert.doesNotMatch(error.diagnostic.message, /Access/);
    return true;
  });
});

test('合法原始值、大数和开头 BOM 不被当作语法错误', () => {
  for (const source of ['null', 'false', '123', '"字符串"', '900719925474099312345', '1e99999', '\ufeff{"a":1}']) {
    assert.equal(compareJson(source, '{}').status, 'ready', source);
  }
});

test('解析器全部错误码均有中文说明，重复字段消息与片段有长度上限', () => {
  for (let code = 1; code <= 16; code++) {
    const issue = errors.parseDiagnostic('?', code, 0, 1, 0, 0);
    assert.match(issue.message, /[\u4e00-\u9fff]/u);
    assert.ok(issue.hint);
  }
  const key = 'x'.repeat(100000);
  const result = compareJson(`{"${key}":1,"${key}":2}`, '{}');
  assert.match(result.message, /重复/);
  assert.ok(JSON.stringify(result).length < 3000);
});

test('解析过程本身失败标记校验未完成，不将系统错误当成非法 JSON', () => {
  const number = globalThis.BigInt;
  let result;
  try {
    globalThis.BigInt = () => { throw new Error('Synthetic parser failure'); };
    result = compareJson('1e1', '{}');
  } finally { globalThis.BigInt = number; }
  assert.deepEqual(result.validation, { left:'incomplete', right:'valid' });
  assert.equal(result.issues[0].category, 'runtime');
  assert.match(result.message, /校验未能完成/);
});
