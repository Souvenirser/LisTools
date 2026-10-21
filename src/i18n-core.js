export const languages = [
  ['zh-Hans','简体中文','cn'],['zh-Hant','繁體中文','cn'],['en','English','us'],['es','Español','es'],['fr','Français','fr'],['de','Deutsch','de'],['pt','Português','br'],['ru','Русский','ru'],['ja','日本語','jp'],['ko','한국어','kr'],
  ['ar','العربية','sa'],['hi','हिन्दी','in'],['bn','বাংলা','bd'],['ur','اردو','pk'],['id','Bahasa Indonesia','id'],['ms','Bahasa Melayu','my'],['vi','Tiếng Việt','vn'],['th','ไทย','th'],['tr','Türkçe','tr'],['fa','فارسی','ir'],
  ['it','Italiano','it'],['nl','Nederlands','nl'],['pl','Polski','pl'],['uk','Українська','ua'],['ro','Română','ro'],['cs','Čeština','cz'],['hu','Magyar','hu'],['el','Ελληνικά','gr'],['sv','Svenska','se'],['da','Dansk','dk'],
  ['fi','Suomi','fi'],['nb','Norsk bokmål','no'],['he','עברית','il'],['ta','தமிழ்','in'],['te','తెలుగు','in'],['mr','मराठी','in'],['gu','ગુજરાતી','in'],['pa-Guru','ਪੰਜਾਬੀ','in'],['kn','ಕನ್ನಡ','in'],['ml','മലയാളം','in'],
  ['sw','Kiswahili','tz'],['fil','Filipino','ph'],['ne','नेपाली','np'],['si','සිංහල','lk'],['my','မြန်မာ','mm'],['km','ខ្មែរ','kh'],['am','አማርኛ','et'],['ha','Hausa','ng'],['yo','Yorùbá','ng'],['zu','isiZulu','za']
].map(([code, name, flag]) => ({ code, name, flag, dir: ['ar','fa','he','ur'].includes(code) ? 'rtl' : 'ltr' }));
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
