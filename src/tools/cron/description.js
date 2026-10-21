import cronstrue from 'cronstrue';

// Load a supported locale only when its prose is needed; other languages use the UI's field summary.
const loaders={
  ar:()=>import('cronstrue/locales/ar.js'),
  cs:()=>import('cronstrue/locales/cs.js'),
  da:()=>import('cronstrue/locales/da.js'),
  de:()=>import('cronstrue/locales/de.js'),
  es:()=>import('cronstrue/locales/es.js'),
  fa:()=>import('cronstrue/locales/fa.js'),
  fi:()=>import('cronstrue/locales/fi.js'),
  fr:()=>import('cronstrue/locales/fr.js'),
  he:()=>import('cronstrue/locales/he.js'),
  hu:()=>import('cronstrue/locales/hu.js'),
  id:()=>import('cronstrue/locales/id.js'),
  it:()=>import('cronstrue/locales/it.js'),
  ja:()=>import('cronstrue/locales/ja.js'),
  ko:()=>import('cronstrue/locales/ko.js'),
  my:()=>import('cronstrue/locales/my.js'),
  nb:()=>import('cronstrue/locales/nb.js'),
  nl:()=>import('cronstrue/locales/nl.js'),
  pl:()=>import('cronstrue/locales/pl.js'),
  pt_BR:()=>import('cronstrue/locales/pt_BR.js'),
  ro:()=>import('cronstrue/locales/ro.js'),
  ru:()=>import('cronstrue/locales/ru.js'),
  sv:()=>import('cronstrue/locales/sv.js'),
  sw:()=>import('cronstrue/locales/sw.js'),
  th:()=>import('cronstrue/locales/th.js'),
  tr:()=>import('cronstrue/locales/tr.js'),
  uk:()=>import('cronstrue/locales/uk.js'),
  vi:()=>import('cronstrue/locales/vi.js'),
  zh_CN:()=>import('cronstrue/locales/zh_CN.js'),
  zh_TW:()=>import('cronstrue/locales/zh_TW.js')
};
export const cronDescriptionLocales=['en',...Object.keys(loaders)];
export async function describeCron(parsed,language='en') {
  const locale=({'zh-Hans':'zh_CN','zh-Hant':'zh_TW',pt:'pt_BR'})[language] || language;
  if(!cronDescriptionLocales.includes(locale))return null;
  // Upstream describes L-n as a range in several locales. Keep the existing exact Chinese clause;
  // other affected languages use the translated field explanation instead of misleading prose.
  const explainOffset=parsed.dayOffset!==null && locale!=='en';
  if(explainOffset && !['zh_CN','zh_TW'].includes(locale))return null;
  try {
    if(loaders[locale])await loaders[locale]();
    let expression=parsed.expression.startsWith('@')?parsed.normalizedExpression:parsed.expression;
    if(explainOffset)expression=parsed.fields.map(field=>field.id==='day'?'*':field.value).join(' ');
    const description=cronstrue.toString(expression,{locale,use24HourTimeFormat:true,dayOfWeekStartIndexZero:parsed.dialect!=='quartz',logicalAndDayFields:parsed.dialect==='quartz'});
    return explainOffset?`${description}；${locale==='zh_TW'?'每月最後一天往前':'每月最后一天往前'} ${parsed.dayOffset} 天`:description;
  } catch {return null;}
}
