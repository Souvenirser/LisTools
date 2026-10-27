import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePreferences,readPreferences,savePreferences,recordRecent,toggleFavorite,preferencesKey} from '../src/tools/shared/preferences.js';
const store=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};};
test('preferences normalize IDs and never retain input or arbitrary form content',()=>{
 const p=normalizePreferences({theme:'dark',favorites:['qr','qr','unknown','calculator'],recent:['pdf','qr','pdf','dates','units','json','timer'],input:'secret',options:{qrSize:512,qrLevel:'H',timeZone:'Asia/Shanghai',unitCategory:'length',expression:'secret',amount:'123',password:'secret'}});
 assert.equal(p.theme,'dark');assert.deepEqual(p.favorites,['qr','calculator']);assert.deepEqual(p.recent,['pdf','qr','dates','units','json']);assert.deepEqual(p.options,{qrSize:512,qrLevel:'H',timeZone:'Asia/Shanghai',unitCategory:'length'});assert.equal(JSON.stringify(p).includes('secret'),false);
});
test('unknown themes and unsafe option values reset to safe defaults',()=>{
 const p=normalizePreferences({theme:'random',favorites:'qr',recent:[null,{},'pdf'],options:{qrSize:1,qrLevel:'bad',timeZone:'secret key',unitCategory:'secret'}});assert.equal(p.theme,'system');assert.deepEqual(p.favorites,[]);assert.deepEqual(p.recent,['pdf']);assert.deepEqual(p.options,{});
});
test('favorites toggle and recent-five update preserve existing preferences',()=>{
 const s=store();savePreferences({theme:'dark'},s);toggleFavorite('qr',s);toggleFavorite('pdf',s);toggleFavorite('qr',s);for(const id of ['json','qr','pdf','dates','units','timer','pdf'])recordRecent(id,s);const p=readPreferences(s);assert.equal(p.theme,'dark');assert.deepEqual(p.favorites,['pdf']);assert.deepEqual(p.recent,['pdf','timer','units','dates','qr']);assert.equal(JSON.parse(s.getItem(preferencesKey)).version,1);
});
test('malformed storage and denied storage keep the page functional',()=>{
 const s=store();s.setItem(preferencesKey,'{');assert.equal(readPreferences(s).theme,'system');const denied={getItem(){throw Error('denied');},setItem(){throw Error('denied');}};assert.doesNotThrow(()=>savePreferences({theme:'dark'},denied));assert.equal(readPreferences(denied).theme,'dark');
});
test('readable but full storage preserves current-page favorites, recent tools and theme',()=>{
 const s=store();savePreferences({theme:'light'},s);const persist=s.setItem;s.setItem=()=>{throw Error('quota exceeded');};
 toggleFavorite('qr',s);recordRecent('pdf',s);savePreferences({...readPreferences(s),theme:'dark'},s);
 assert.deepEqual(readPreferences(s).favorites,['qr']);assert.deepEqual(readPreferences(s).recent,['pdf']);assert.equal(readPreferences(s).theme,'dark');
 s.setItem=persist;assert.equal(savePreferences(readPreferences(s),s),true);assert.equal(JSON.parse(s.getItem(preferencesKey)).theme,'dark');
});
