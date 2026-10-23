import {textKey} from './label-key.js';
import { tools, categories, findTools } from '../convert/registry.js';

export const toolGroups=[{id:'daily',key:'ux.group_daily',icon:'⌗'},{id:'files',key:'ux.group_files',icon:'▤'},{id:'developer',key:'ux.group_developer',icon:'{ }'},{id:'network',key:'ux.group_network',icon:'↯'}];
export const pages = [
  {id:'json',file:'index.html',key:'json.title',icon:'{ }',zh:'JSON 解析与格式化',en:'JSON parser & formatter',group:'developer',summaryKey:'ux.purpose_json'},
  {id:'diff',file:'diff.html',key:'diff.name',icon:'±',zh:'JSON / 文本对比',en:'JSON / text comparison',group:'developer',summaryKey:'ux.purpose_diff'},
  {id:'timestamp',file:'timestamp.html',key:'timestamp.name',icon:'◷',zh:'时间戳转换',en:'Timestamp converter',group:'developer',summaryKey:'ux.purpose_timestamp'},
  {id:'md5',file:'convert.html#md5',key:'md5.name',icon:'#',zh:'MD5 校验',en:'MD5 checksum',group:'developer',summaryKey:'ux.purpose_md5'},
  {id:'convert',file:'convert.html',key:'common.convert',icon:'⇄',zh:'编码与转换',en:'Encoding & conversion',group:'developer',summaryKey:'ux.purpose_convert'},
  {id:'speedtest',file:'speedtest.html',key:'uiText.saf21bd04',icon:'↯',zh:'网速测试',en:'Speed test',group:'network',summaryKey:'ux.purpose_speedtest'},
  {id:'cron',file:'cron.html',key:'cron.title',icon:'▦',zh:'Cron 表达式',en:'Cron expressions',group:'developer',summaryKey:'ux.purpose_cron'},
  {id:'password',file:'password.html',key:'uiText.s100a0613',icon:'⚿',zh:'随机密码与口令',en:'Random passwords & passphrases',group:'network',summaryKey:'ux.purpose_password'},
  {id:'regex',file:'regex.html',key:'common.regex',icon:'.*',zh:'正则测试',en:'Regex testing',group:'developer',summaryKey:'ux.purpose_regex'},
  {id:'calculator',file:'calculator.html',key:'calculator.name',icon:'⌗',zh:'计算器',en:'Calculator',group:'daily',summaryKey:'ux.purpose_calculator'},
  {id:'dates',file:'dates.html',key:'dates.name',icon:'◴',zh:'日期计算',en:'Date calculator',group:'daily',summaryKey:'ux.purpose_dates'},
  {id:'qr',file:'qr.html',key:'qr.name',icon:'▦',zh:'二维码生成与识别',en:'Generate and read QR codes',group:'files',summaryKey:'ux.purpose_qr'},
  {id:'images',file:'images.html',key:'images.name',icon:'▧',zh:'图片压缩与裁剪',en:'Compress and edit images',group:'files',summaryKey:'ux.purpose_images'},
  {id:'text',file:'text.html',key:'text.name',icon:'Aa',zh:'文本去重与提取',en:'Clean and extract text',group:'files',summaryKey:'ux.purpose_text'},
  {id:'units',file:'units.html',key:'units.name',icon:'↔',zh:'单位换算',en:'Unit converter',group:'daily',summaryKey:'ux.purpose_units'},
  {id:'money',file:'money.html',key:'money.name',icon:'¥',zh:'人民币大写',en:'Chinese money',group:'daily',summaryKey:'ux.purpose_money'},
  {id:'pdf',file:'pdf.html',key:'pdf.name',icon:'▤',zh:'PDF 合并与拆分',en:'Merge and split PDFs',group:'files',summaryKey:'ux.purpose_pdf'},
  {id:'draw',file:'draw.html',key:'draw.name',icon:'⚄',zh:'抽签与分组',en:'Random draw',group:'daily',summaryKey:'ux.purpose_draw'},
  {id:'timer',file:'timer.html',key:'timer.name',icon:'◷',zh:'倒计时与秒表',en:'Timer & stopwatch',group:'daily',summaryKey:'ux.purpose_timer'},
];

const aliases = {json:'format beautify 美化',diff:'compare 对比',timestamp:'date time 日期',speedtest:'speed network 网速',cron:'crontab schedule 定时',password:'passphrase random 随机 口令',regex:'regexp regular expression 正则 匹配 正则测试（开发用） Regex testing (developers)'};
export const conversionGroups = categories.map(category=>({
  ...category,
  tools:tools.filter(tool=>tool.category===category.id).map(tool=>({
    id:tool.id, file:`convert.html#${tool.id}`, name:tool.name, category:category.name,
    key:tool.id==='md5'?'md5.name':textKey(tool.name[1]),categoryKey:textKey(category.name[1]),summaryKey:tool.category==='encoding'?(tool.id==='base58'?'ux.base58Hint':'ux.encodingHint'):tool.hint[1]?textKey(tool.hint[1]):'ux.purpose_convert', icon:tool.id==='md5'?'#':'⇄'
  }))
}));
const leaves = [...new Map([
  ...pages.filter(page=>page.id!=='convert'),
  ...conversionGroups.flatMap(group=>group.tools)
].map(item=>[item.file,item])).values()];

export const taskRoutes={text:['dedupe','extract','replace','mask','case','newline'],qr:['generate','recognize'],images:['compress','resize','crop','format'],pdf:['merge','split','extract','reorder','delete','rotate','images'],dates:['difference','shift','milestone','workdays'],draw:['list','numbers'],timer:['countdown','stopwatch']};
const taskNames={text:['ux.textLines','ux.textExtract','ux.textReplace','ux.textMask','ux.textCase','ux.textNewline'],qr:['ux.qrGenerate','ux.qrRecognize'],images:['images.compressTask','images.resizeTask','images.crop','images.formatTask']};
const taskAliases={dedupe:'deduplicate unique 去重 整理',extract:'extract 提取 邮箱 email phone 手机号',replace:'replace 替换',mask:'mask 脱敏',case:'case naming 大小写 命名',newline:'newline line endings 换行',generate:'generate 生成',recognize:'scan read 识别',compress:'compress 压缩',resize:'resize 缩放 尺寸',crop:'crop 裁剪',format:'format 格式',merge:'merge 合并',split:'split 拆分',reorder:'reorder 重排 页序',delete:'delete 删除',rotate:'rotate 旋转',images:'images 图片',difference:'difference 日期差',shift:'shift 日期加减',milestone:'age anniversary 年龄 周年',workdays:'workdays 工作日',list:'list 名单 分组',numbers:'numbers 随机 数字',countdown:'countdown 倒计时',stopwatch:'stopwatch 秒表'};
const taskLeaves=Object.entries(taskRoutes).flatMap(([id,tasks])=>tasks.map((task,index)=>{const page=pages.find(p=>p.id===id);return {...page,id:id+'-'+task,file:page.file+'#'+task,key:taskNames[id]?.[index]||id+'.'+task,aliases:taskAliases[task]};}));
export function searchNavigation(query='',translate=()=> '') {
  const terms=query.toLowerCase().trim().split(/\s+/);
  const conversions=new Set(findTools(query,translate).map(tool=>`convert.html#${tool.id}`));
  const matches=leaves.filter(item=>conversions.has(item.file) || terms.every(term=>[
    item.id,item.zh,item.en,...(item.name || []),...(item.category || []),aliases[item.id],item.key?translate(item.key):''
  ].join(' ').toLowerCase().includes(term)));
  if(!query.trim())return matches;
  const tasks=taskLeaves.filter(item=>terms.every(term=>[item.zh,item.en,item.aliases,translate(item.key)].join(' ').toLowerCase().includes(term)));
  const ordinary=new Set(tasks.filter(item=>['text-dedupe','text-case','text-newline'].includes(item.id)).map(item=>({'text-dedupe':'lines','text-case':'case','text-newline':'newline'})[item.id]));
  for(const id of ordinary){if(!matches.some(item=>item.id===id))matches.push(leaves.find(item=>item.id===id));}
  return [...tasks,...matches.filter(item=>!ordinary.has(item.id)),...matches.filter(item=>ordinary.has(item.id)).map(item=>({...item,secondary:true}))];
}

export function currentTarget(pathname,hash='') {
  const file=pathname.split('/').pop() || 'index.html';
  if(file==='convert.html') return `convert.html#${tools.find(tool=>`#${tool.id}`===hash)?.id || tools[0].id}`;
  const page=pages.find(page=>page.file===file);
  return page&&(taskRoutes[page.id]?.includes(hash.slice(1))?file+hash:file);
}
