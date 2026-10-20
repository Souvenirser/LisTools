export const languages = [
  ['zh-Hans','简体中文'],['zh-Hant','繁體中文'],['en','English'],['es','Español'],['fr','Français'],['de','Deutsch'],['pt','Português'],['ru','Русский'],['ja','日本語'],['ko','한국어'],
  ['ar','العربية'],['hi','हिन्दी'],['bn','বাংলা'],['ur','اردو'],['id','Bahasa Indonesia'],['ms','Bahasa Melayu'],['vi','Tiếng Việt'],['th','ไทย'],['tr','Türkçe'],['fa','فارسی'],
  ['it','Italiano'],['nl','Nederlands'],['pl','Polski'],['uk','Українська'],['ro','Română'],['cs','Čeština'],['hu','Magyar'],['el','Ελληνικά'],['sv','Svenska'],['da','Dansk'],
  ['fi','Suomi'],['nb','Norsk bokmål'],['he','עברית'],['ta','தமிழ்'],['te','తెలుగు'],['mr','मराठी'],['gu','ગુજરાતી'],['pa-Guru','ਪੰਜਾਬੀ'],['kn','ಕನ್ನಡ'],['ml','മലയാളം'],
  ['sw','Kiswahili'],['fil','Filipino'],['ne','नेपाली'],['si','සිංහල'],['my','မြန်မာ'],['km','ខ្មែរ'],['am','አማርኛ'],['ha','Hausa'],['yo','Yorùbá'],['zu','isiZulu']
].map(([code, name]) => ({ code, name, dir: ['ar','fa','he','ur'].includes(code) ? 'rtl' : 'ltr' }));
const supported = new Set(languages.map(item => item.code));
export function matchLanguage(tag) {
  try {
    const locale = new Intl.Locale(tag);
    const language = locale.language === 'no' ? 'nb' : locale.language;
    return [locale.baseName, `${language}-${locale.maximize().script}`, language].find(code => supported.has(code)) || null;
  } catch { return null; }
}
export function preferredLanguage(saved, browserLanguages = []) {
  return (supported.has(saved) && saved) || browserLanguages.map(matchLanguage).find(Boolean) || 'en';
}
// Load first, then commit synchronously: stale asynchronous imports never change the UI.
export function createLanguageLoader(load, apply) {
  let sequence = 0;
  return async code => {
    const request = ++sequence;
    const resource = await load(code);
    if (request !== sequence) return false;
    apply(code, resource);
    return true;
  };
}
