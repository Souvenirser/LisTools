import cronstrue from 'cronstrue';

export async function describeCron(parsed, language='en') {
  const locale=language==='zh-Hant' ? 'zh_TW' : language.startsWith('zh') ? 'zh_CN' : 'en';
  if(locale==='zh_CN') await import('cronstrue/locales/zh_CN.js');
  if(locale==='zh_TW') await import('cronstrue/locales/zh_TW.js');
  try {
    let expression=parsed.expression.startsWith('@') ? parsed.normalizedExpression : parsed.expression;
    const explainOffset=parsed.dayOffset!==null && locale!=='en';
    if(explainOffset) {
      const fields=parsed.fields.map(field=>field.id==='day' ? '*' : field.value);
      expression=fields.join(' ');
    }
    const description=cronstrue.toString(expression, {
      locale, use24HourTimeFormat:true, dayOfWeekStartIndexZero:parsed.dialect!=='quartz', logicalAndDayFields:parsed.dialect==='quartz'
    });
    return explainOffset ? `${description}；${locale==='zh_TW' ? '每月最後一天往前' : '每月最后一天往前'} ${parsed.dayOffset} 天` : description;
  } catch {
    return locale==='en' ? 'Expression validated. See the field table and calculated dates below.' : '表达式已通过校验，请查看字段说明和下方执行时间。';
  }
}
