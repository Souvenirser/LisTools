import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { languages } from '../src/i18n-core.js';
const ids=['office','calculator','dates','qr','images','text','units','money','pdf','draw','timer','workspace'];
const base=JSON.parse(readFileSync(new URL('../src/locales/en.json',import.meta.url),'utf8'));
const parameters=text=>[...text.matchAll(/\{\{([^}]+)\}\}/g)].map(match=>match[1]).sort();
test('all new office labels and diagnostics have complete fifty-language resources',()=>{
  for(const {code} of languages){
    const resource=JSON.parse(readFileSync(new URL(`../src/locales/${code}.json`,import.meta.url),'utf8'));
    for(const id of ids){
      assert.deepEqual(Object.keys(resource[id]||{}).sort(),Object.keys(base[id]).sort(),`${code}/${id}`);
      for(const [key,value] of Object.entries(resource[id])){
        assert.ok(typeof value==='string' && value.trim(),`${code}/${id}/${key}`);
        assert.ok(!/ZXQ|QXZ|@@\d{4}@@/.test(value),`${code}/${id}/${key}: translation artifact`);
        assert.deepEqual(parameters(value),parameters(base[id][key]),`${code}/${id}/${key}`);
      }
    }
  }
});
test('English message manifests are synchronized with the shipped language source',()=>{
  for(const id of ids.filter(id=>!['office','workspace'].includes(id))){
    const messages=JSON.parse(readFileSync(new URL(`../src/tools/${id}/messages.json`,import.meta.url),'utf8'));
    for(const [key,value] of Object.entries(messages))assert.equal(base[id][key],value,`${id}.${key}`);
  }
});

test('all fifty languages include every supported unit label from the offline CLDR subset',async()=>{const {units}=await import('../src/tools/units/core.js');for(const {code}of languages){const resource=JSON.parse(readFileSync(new URL(`../src/locales/${code}.json`,import.meta.url),'utf8'));assert.deepEqual(Object.keys(resource.unitNames).sort(),units.map(unit=>unit.id).sort(),code);for(const value of Object.values(resource.unitNames))assert.ok(typeof value==='string'&&value.trim(),code);}});


test('product-refinement UI has fifty complete localized templates with stable parameters',()=>{
 const expected=base.refinement;
 for(const {code} of languages){const actual=JSON.parse(readFileSync(new URL(`../src/locales/${code}.json`,import.meta.url),'utf8')).refinement;assert.deepEqual(Object.keys(actual).sort(),Object.keys(expected).sort(),code);for(const [key,value]of Object.entries(actual)){assert.ok(value.trim()&&!/__9\d{3}__|\[\[9\d{3}\]\]/.test(value),code+'/'+key);assert.deepEqual(parameters(value),parameters(expected[key]),code+'/'+key);}}
});
