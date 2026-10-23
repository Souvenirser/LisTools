import {pages,conversionGroups,currentTarget} from './navigation.js';
import {languages} from '../../i18n-core.js';

const entries=[...pages,...conversionGroups.flatMap(group=>group.tools)];
const tools=new Map(entries.map(item=>[item.id,item]));
const routes=new Map(entries.map(item=>[item.file,item.id]));
const locales=new Set(languages.map(item=>item.code));

export function feedbackTool(pathname,hash='') {
  const target=currentTarget(pathname,hash);return routes.get(target) || routes.get(target?.split('#')[0]) || 'toolbox';
}
export function buildFeedbackUrl({issuesUrl,tool='toolbox',version,locale='en'}) {
  if(!locales.has(locale))locale='en';
  const entry=tools.get(tool),zh=locale.startsWith('zh');
  const name=entry?(entry.name?.[zh?0:1] || entry[zh?'zh':'en']):(zh?'工具箱':'Toolbox');
  const url=new URL(`${issuesUrl.replace(/\/$/,'')}/new`);
  url.search=new URLSearchParams({template:'feedback.yml',title:`[LisTools] ${name} - `,tool:`${name} (${entry?.id || 'toolbox'})`,version,locale}).toString();
  return url.href;
}
export function mountFeedbackLink(container,readContext) {
  const link=document.createElement('a');link.className='feedback-link';link.target='_blank';link.rel='noopener noreferrer';
  container.append(link);
  const refresh=()=>{
    const {label,hint,...context}=readContext();
    link.href=buildFeedbackUrl(context);link.textContent=`${label} ↗`;link.title=hint;link.setAttribute('aria-label',`${label} · ${hint}`);
  };
  refresh();return refresh;
}
