// Shared language state only: the popup does not import page/editor initialization.
import i18next from 'i18next';
import english from './locales/en.json';
import { languages, preferredLanguage, createLanguageLoader } from './i18n-core.js';

const instance=i18next.createInstance();
const packages=import.meta.glob('./locales/*.json', {import:'default'});
const listeners=new Set();
const preferenceKey='listools-language';
await instance.init({lng:'en',fallbackLng:'en',resources:{en:{translation:english}},interpolation:{escapeValue:false},initAsync:false});
export const t=(key,params)=>instance.t(key,params);
export const language=()=>instance.language;
export const onLanguageChange=callback=>{listeners.add(callback);return()=>listeners.delete(callback);};
export const errorText=error=>error.code && instance.exists(error.code)?t(error.code,error.params):error.message;
const commit=createLanguageLoader(async code=>code==='en'?english:packages[`./locales/${code}.json`](),(code,resource)=>{
  instance.addResourceBundle(code,'translation',resource,true,true);
  void instance.changeLanguage(code);
  for(const listener of listeners)listener();
});
export async function setLanguage(code,persist=false) {
  if(await commit(code)) {
    if(persist)try{localStorage.setItem(preferenceKey,code);}catch{/* Preferences are optional. */}
    return true;
  }
  return false;
}
let saved;
try{saved=localStorage.getItem(preferenceKey);}catch{/* Preferences are optional. */}
try { await setLanguage(preferredLanguage(saved,navigator.languages || [navigator.language])); }
catch { await setLanguage('en'); }
export { languages };
