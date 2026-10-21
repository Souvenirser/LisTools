import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { matchLanguage, preferredLanguage, languages, createLanguageLoader } from '../src/i18n-core.js';

const flatten = (object, prefix = '') => Object.fromEntries(Object.entries(object).flatMap(([key,value]) => typeof value === 'string' ? [[prefix + key, value]] : Object.entries(flatten(value, prefix + key + '.'))));
const params = value => [...value.matchAll(/{{(\w+)}}/g)].map(match => match[1]).sort();
test('50 complete local language packages preserve interpolation parameters', () => {
  const base = flatten(JSON.parse(readFileSync(new URL('../src/locales/en.json', import.meta.url))));
  assert.equal(languages.length, 50);
  assert.equal(readdirSync(new URL('../src/locales/', import.meta.url)).filter(file => file.endsWith('.json')).length, 50);
  for (const { code } of languages) {
    const resource = flatten(JSON.parse(readFileSync(new URL(`../src/locales/${code}.json`, import.meta.url))));
    assert.deepEqual(Object.keys(resource).sort(), Object.keys(base).sort(), code);
    for (const key of Object.keys(base)) {
      assert.ok(resource[key].trim(), `${code}:${key}`);
      assert.deepEqual(params(resource[key]), params(base[key]), `${code}:${key}`);
    }
    if (code !== 'en') assert.ok(Object.keys(base).filter(key => resource[key] !== base[key]).length > 160, `${code} must contain real translations`);
  }
});
test('browser matching handles Chinese script, regions, aliases and fallback', () => {
  for (const [input, expected] of Object.entries({ 'zh-CN':'zh-Hans','zh-SG':'zh-Hans','zh-TW':'zh-Hant','zh-HK':'zh-Hant','zh-Hant':'zh-Hant','en-US':'en','pt-BR':'pt','iw-IL':'he','no-NO':'nb','pa-IN':'pa-Guru','pa-PK':null,'xx':null })) assert.equal(matchLanguage(input), expected, input);
  assert.equal(preferredLanguage(null, ['xx','de-DE']), 'de');
  assert.equal(preferredLanguage('ru', ['zh-CN']), 'ru');
  assert.equal(preferredLanguage('xx', ['zz']), 'en');
});
test('rapid language loading applies only the last selection', async () => {
  const resolvers = {}, applied = [];
  const change = createLanguageLoader(code => new Promise(resolve => { resolvers[code] = resolve; }), (code, resource) => applied.push([code,resource]));
  const slow = change('ru'), fast = change('ar');
  resolvers.ar({ text: 'Arabic' }); await fast;
  resolvers.ru({ text: 'Russian' }); await slow;
  assert.deepEqual(applied, [['ar',{ text:'Arabic' }]]);
});

test('static page translation markers resolve to real English keys', () => {
  const base = flatten(JSON.parse(readFileSync(new URL('../src/locales/en.json', import.meta.url))));
  for (const page of ['index','diff','timestamp']) {
    const html = readFileSync(new URL(`../${page}.html`, import.meta.url),'utf8');
    for (const [, key] of html.matchAll(/data-(?:i18n(?:-[\w-]+)?|label-key)="([\w.]+)"/g)) assert.ok(base[key], `${page}:${key}`);
  }
});

test('localized diagnostics distinguish invalid numbers and trailing commas', async () => {
  const { compareJson } = await import('../src/tools/json-diff/core.js');
  assert.equal(compareJson('{"n":01}', '{}').issues[0].translationCode, 2);
  assert.equal(compareJson('{"n":1,}', '{}').issues[0].translationCode, 4);
});

test('all language choices have fixed local flag metadata',()=>{
  assert.equal(new Set(languages.map(item=>item.flag)).size,41);
  for(const item of languages)assert.match(item.flag,/^[a-z]{2}$/,item.code);
  const flag=code=>languages.find(item=>item.code===code).flag;
  assert.equal(flag('zh-Hans'),'cn');assert.equal(flag('zh-Hant'),'cn');
  assert.equal(flag('en'),'us');assert.equal(flag('pt'),'br');assert.equal(flag('ar'),'sa');
});

test('Cron resources cover every language, preserve syntax and contain no generation markers',()=>{
 for(const {code} of languages){
  const resource=JSON.parse(readFileSync(new URL(`../src/locales/${code}.json`,import.meta.url)));
  const cron=flatten(resource.cron);
  assert.ok(Object.keys(cron).length>=74,code);
  for(const [key,value] of Object.entries(cron))assert.doesNotMatch(value,/_*LT\d+_*/i,`${code}:${key}`);
  for(const syntax of ['L-n','nW','LW','nL','n#1–5','?'])assert.ok(cron.syntaxQuartz.includes(syntax),`${code}:${syntax}`);
  for(const alias of ['@hourly','@daily'])assert.ok(cron['errors.alias'].includes(alias),`${code}:${alias}`);
  assert.ok(cron['errors.questionMark'].includes('Quartz'),code);
 }
});

test('Cron examples remain executable and occurrence explanations use actual numeric parameters',()=>{
 for(const {code} of languages){
  const {cron}=JSON.parse(readFileSync(new URL(`../src/locales/${code}.json`,import.meta.url)));
  assert.ok(cron.values.includes('0,15,30'),`${code}: ASCII list example`);
  assert.ok(cron.meanings.nth.includes('{{n}}'),`${code}: actual occurrence number`);
  assert.ok(cron.meanings.lastWeekday.includes('{{weekdays}}'),`${code}: explicit weekday range`);
  assert.ok(cron.meanings.nearest.includes('{{weekdays}}'),`${code}: explicit weekday range`);
 }
});
