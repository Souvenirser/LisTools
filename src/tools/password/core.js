import { customAlphabet } from 'nanoid';

export const CHARACTER_CLASSES = {
  uppercase:'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase:'abcdefghijklmnopqrstuvwxyz',
  digits:'0123456789',
  symbols:'!@#$%^&*()_+-=[]{};:,.?'
};
const fail = code => { throw Object.assign(new Error(code), {code}); };

function integer(value, fallback, min, max, code) {
  if (value === undefined) return fallback;
  if (!/^[0-9]+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < min || Number(value) > max) fail(code);
  return Number(value);
}

function randomGenerator(alphabet, length) {
  if (typeof globalThis.crypto?.getRandomValues !== 'function') fail('random');
  const generate = customAlphabet(alphabet, length);
  return () => {
    try { return generate(); }
    catch { fail('random'); }
  };
}

export function generatePasswords(options = {}) {
  const length = integer(options.length, 20, 4, 256, 'length');
  const batch = integer(options.batch, 1, 1, 100, 'batch');
  const excluded = new Set(`${options.exclude || ''}${options.excludeAmbiguous ? '0O1lI' : ''}`);
  const filter = alphabet => [...new Set(alphabet)].filter(char => !excluded.has(char)).join('');
  let classes;
  if (options.customAlphabet !== undefined) {
    if (typeof options.customAlphabet !== 'string' || !/^[\x20-\x7e]+$/.test(options.customAlphabet)) fail('alphabet');
    const alphabet = filter(options.customAlphabet);
    if (alphabet.length < 2) fail('alphabet');
    classes = [alphabet];
  } else {
    classes = Object.entries(CHARACTER_CLASSES).filter(([name]) => options[name] !== false).map(([, alphabet]) => filter(alphabet));
    if (!classes.length) fail('classes');
    if (classes.some(alphabet => !alphabet.length)) fail('empty-class');
    if (options.requireEach !== false && length < classes.length) fail('short');
  }
  const generate = randomGenerator(classes.join(''), length);
  const results = [];
  for (let i = 0; i < batch; i++) {
    let accepted = false;
    for (let attempt = 0; attempt < 10000; attempt++) {
      const candidate = generate();
      if (options.requireEach === false || classes.every(alphabet => [...candidate].some(char => alphabet.includes(char)))) {
        results.push(candidate); accepted = true; break;
      }
    }
    if (!accepted) fail('attempts');
  }
  return results;
}

export function parseWordlist(text) {
  const words = new Map();
  const unique = new Set();
  for (const line of text.trim().split(/\r?\n/)) {
    const match = /^([1-6]{5})\t([a-z]+(?:-[a-z]+)*)$/.exec(line);
    if (!match || words.has(match[1]) || unique.has(match[2])) fail('wordlist');
    words.set(match[1], match[2]); unique.add(match[2]);
  }
  if (words.size !== 7776) fail('wordlist');
  return words;
}

export function generatePassphrases(wordlist, options = {}) {
  const count = integer(options.words, 6, 4, 12, 'words');
  const batch = integer(options.batch, 1, 1, 100, 'batch');
  const separator = options.separator ?? ' ';
  if (![' ', '-', '_'].includes(separator)) fail('separator');
  const roll = randomGenerator('123456', 5);
  return Array.from({length:batch}, () => Array.from({length:count}, () => {
    const word = wordlist.get(roll());
    if (!word) fail('wordlist');
    return word;
  }).join(separator));
}
