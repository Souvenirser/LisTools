import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { generatePasswords, generatePassphrases, parseWordlist } from '../src/tools/password/core.js';

const wordlistText = () => readFile(new URL('../src/tools/password/data/eff_large_wordlist.txt', import.meta.url), 'utf8');
const code = expected => error => error.code === expected;

test('默认生成一个 20 字符密码，并包含每个所选字符类别', () => {
  const values = generatePasswords();
  assert.equal(values.length, 1);
  assert.equal(values[0].length, 20);
  assert.match(values[0], /[A-Z]/);
  assert.match(values[0], /[a-z]/);
  assert.match(values[0], /[0-9]/);
  assert.match(values[0], /[!@#$%^&*()_+\-=\[\]{};:,.?]/);
});

test('长度和批量边界生效，每类至少一个的条件应用于每个输出', () => {
  for (const length of [4, 256]) {
    const values = generatePasswords({ length, batch:100 });
    assert.equal(values.length, 100);
    for (const value of values) {
      assert.equal(value.length, length);
      assert.match(value, /[A-Z]/); assert.match(value, /[a-z]/);
      assert.match(value, /[0-9]/); assert.match(value, /[!@#$%^&*()_+\-=\[\]{};:,.?]/);
    }
  }
});

test('各字符类别独立开关，排除易混字符和额外字符后仍符合约束', () => {
  const values = generatePasswords({ uppercase:false, lowercase:false, symbols:false, excludeAmbiguous:true, exclude:'2345', length:80, batch:10 });
  for (const value of values) assert.match(value, /^[6789]{80}$/);
  const letters = generatePasswords({ uppercase:false, digits:false, symbols:false, exclude:'abc', length:80 })[0];
  assert.match(letters, /^[d-z]{80}$/);
});

test('自定义可打印 ASCII 字符去重并覆盖类别要求，也遵循排除规则', () => {
  const values = generatePasswords({ customAlphabet:'aaabbbbCC00', uppercase:false, lowercase:false, digits:false, symbols:false, exclude:'C', excludeAmbiguous:true, length:40, batch:3 });
  for (const value of values) assert.match(value, /^[ab]{40}$/);
  assert.match(generatePasswords({ customAlphabet:' a', length:80 })[0], /^[ a]{80}$/);
});

test('非法范围、空类别和非法自定义字符不会生成部分结果', () => {
  for (const length of [3, 257, 4.5, '', '1e2', Infinity]) assert.throws(() => generatePasswords({length}), code('length'));
  for (const batch of [0, 101, 1.5, '', '1e2', Infinity]) assert.throws(() => generatePasswords({batch}), code('batch'));
  assert.throws(() => generatePasswords({ uppercase:false, lowercase:false, digits:false, symbols:false }), code('classes'));
  assert.throws(() => generatePasswords({ exclude:'0123456789' }), code('empty-class'));
  for (const customAlphabet of ['', 'aaa', 'a中', 'a😀', 'a\n', 'a\t', 'a\x7f']) assert.throws(() => generatePasswords({customAlphabet}), code('alphabet'));
  assert.throws(() => generatePasswords({customAlphabet:'ab', exclude:'b'}), code('alphabet'));
});

test('随机源缺失或抛错时停止，不能退回伪随机数', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', { configurable:true, value:undefined });
  try { assert.throws(() => generatePasswords(), code('random')); }
  finally { Object.defineProperty(globalThis, 'crypto', descriptor); }
  mock.method(globalThis.crypto, 'getRandomValues', () => { throw new Error('unavailable'); });
  try { assert.throws(() => generatePasswords(), code('random')); }
  finally { mock.restoreAll(); }
});

test('整串拒绝采样到达上限后报错，不强行插入各类字符', () => {
  mock.method(globalThis.crypto, 'getRandomValues', bytes => bytes.fill(0));
  try {
    assert.throws(() => generatePasswords({ length:4 }), code('attempts'));
    assert.deepEqual(generatePasswords({ length:4, requireEach:false }), ['AAAA']);
  } finally { mock.restoreAll(); }
});

test('EFF 官方词表包含完整的 7776 个唯一五骰键及唯一单词', async () => {
  const words = parseWordlist(await wordlistText());
  assert.equal(words.size, 7776);
  assert.equal(new Set(words.values()).size, 7776);
  assert.equal(words.get('11111'), 'abacus');
  assert.equal(words.get('66666'), 'zoom');
  for (const [key, word] of words) { assert.match(key, /^[1-6]{5}$/); assert.match(word, /^[a-z]+(?:-[a-z]+)*$/); }
  assert.equal(words.get('24255'), 'drop-down');
});

test('缺行、重复键、非法骰键和重复词的词表均拒绝', async () => {
  const text = await wordlistText();
  assert.throws(() => parseWordlist(text.split('\n').slice(1).join('\n')), code('wordlist'));
  assert.throws(() => parseWordlist(text.replace('11112\tabdomen', '11111\tabdomen')), code('wordlist'));
  assert.throws(() => parseWordlist(text.replace('11112\tabdomen', '71112\tabdomen')), code('wordlist'));
  assert.throws(() => parseWordlist(text.replace('11112\tabdomen', '11112\tabacus')), code('wordlist'));
});

test('口令默认为六词，支持 4 至 12 词、批量和三种分隔符', async () => {
  const words = parseWordlist(await wordlistText());
  const defaults = generatePassphrases(words);
  assert.equal(defaults.length, 1); assert.equal(defaults[0].split(' ').length, 6);
  const known = new Set(words.values());
  for (const count of [4, 12]) for (const separator of [' ', '_']) {
    const values = generatePassphrases(words, { words:count, separator, batch:100 });
    assert.equal(values.length, 100);
    for (const value of values) {
      const parts = value.split(separator); assert.equal(parts.length, count);
      for (const part of parts) assert.ok(known.has(part));
    }
  }
});

test('口令允许重复单词，不因去重改变独立抽样', async () => {
  const words = parseWordlist(await wordlistText());
  mock.method(globalThis.crypto, 'getRandomValues', bytes => bytes.fill(0));
  try {
    for (const [separator, expected] of [[' ', 'abacus abacus abacus abacus'], ['-', 'abacus-abacus-abacus-abacus'], ['_', 'abacus_abacus_abacus_abacus']]) {
      assert.deepEqual(generatePassphrases(words, { words:4, separator }), [expected]);
    }
  }
  finally { mock.restoreAll(); }
});

test('非法口令词数、批量、分隔符及随机源缺失均拒绝', async () => {
  const words = parseWordlist(await wordlistText());
  for (const count of [3, 13, '', '6.0', 4.5]) assert.throws(() => generatePassphrases(words, {words:count}), code('words'));
  for (const batch of [0, 101, '1e2']) assert.throws(() => generatePassphrases(words, {batch}), code('batch'));
  for (const separator of ['', '/', '\n']) assert.throws(() => generatePassphrases(words, {separator}), code('separator'));
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', { configurable:true, value:undefined });
  try { assert.throws(() => generatePassphrases(words), code('random')); }
  finally { Object.defineProperty(globalThis, 'crypto', descriptor); }
});
