import { tools, categories, findTools } from '../convert/registry.js';

export const pages = [
  {id:'json',file:'index.html',key:'json.name',icon:'{ }',zh:'JSON 解析',en:'JSON parser'},
  {id:'diff',file:'diff.html',key:'diff.name',icon:'±',zh:'JSON / 文本对比',en:'JSON / text comparison'},
  {id:'timestamp',file:'timestamp.html',key:'timestamp.name',icon:'◷',zh:'时间戳转换',en:'Timestamp converter'},
  {id:'md5',file:'convert.html#md5',key:'md5.name',icon:'#',zh:'MD5 校验',en:'MD5 checksum'},
  {id:'convert',file:'convert.html',key:'common.convert',icon:'⇄',zh:'编码与转换',en:'Encoding & conversion'},
  {id:'speedtest',file:'speedtest.html',key:'common.speedtest',icon:'↯',zh:'网速测试',en:'Speed test'},
  {id:'cron',file:'cron.html',key:'common.cron',icon:'▦',zh:'Cron 表达式',en:'Cron expressions'},
  {id:'password',file:'password.html',key:'common.password',icon:'⚿',zh:'随机密码',en:'Random passwords'},
  {id:'regex',file:'regex.html',key:'common.regex',icon:'.*',zh:'正则测试（开发用）',en:'Regex testing (developers)'},
  {id:'calculator',file:'calculator.html',key:'calculator.name',icon:'⌗',zh:'计算器',en:'Calculator',group:'general'},
  {id:'dates',file:'dates.html',key:'dates.name',icon:'◴',zh:'日期计算',en:'Date calculator',group:'general'},
  {id:'qr',file:'qr.html',key:'qr.name',icon:'▦',zh:'二维码生成与识别',en:'Generate and read QR codes',group:'general'},
  {id:'images',file:'images.html',key:'images.name',icon:'▧',zh:'图片压缩与裁剪',en:'Compress and edit images',group:'general'},
  {id:'text',file:'text.html',key:'text.name',icon:'Aa',zh:'文本去重与提取',en:'Clean and extract text',group:'general'},
  {id:'units',file:'units.html',key:'units.name',icon:'↔',zh:'单位换算',en:'Unit converter',group:'general'},
  {id:'money',file:'money.html',key:'money.name',icon:'¥',zh:'人民币大写',en:'Chinese money',group:'general'},
  {id:'pdf',file:'pdf.html',key:'pdf.name',icon:'▤',zh:'PDF 合并与拆分',en:'Merge and split PDFs',group:'general'},
  {id:'draw',file:'draw.html',key:'draw.name',icon:'⚄',zh:'抽签与分组',en:'Random draw',group:'general'},
  {id:'timer',file:'timer.html',key:'timer.name',icon:'◷',zh:'倒计时与秒表',en:'Timer & stopwatch',group:'general'},
];

const aliases = {json:'format beautify 美化',diff:'compare 对比',timestamp:'date time 日期',speedtest:'speed network 网速',cron:'crontab schedule 定时',password:'passphrase random 随机 口令',regex:'regexp regular expression 正则 匹配'};
export const conversionGroups = categories.map(category=>({
  ...category,
  tools:tools.filter(tool=>tool.category===category.id).map(tool=>({
    id:tool.id, file:`convert.html#${tool.id}`, name:tool.name, category:category.name,
    key:tool.id==='md5'?'md5.name':undefined, icon:tool.id==='md5'?'#':'⇄'
  }))
}));
const leaves = [...new Map([
  ...pages.filter(page=>page.id!=='convert'),
  ...conversionGroups.flatMap(group=>group.tools)
].map(item=>[item.file,item])).values()];

export function searchNavigation(query='',translate=()=> '') {
  const terms=query.toLowerCase().trim().split(/\s+/);
  const conversions=new Set(findTools(query).map(tool=>`convert.html#${tool.id}`));
  return leaves.filter(item=>conversions.has(item.file) || terms.every(term=>[
    item.id,item.zh,item.en,...(item.name || []),...(item.category || []),aliases[item.id],item.key?translate(item.key):''
  ].join(' ').toLowerCase().includes(term)));
}

export function currentTarget(pathname,hash='') {
  const file=pathname.split('/').pop() || 'index.html';
  if(file==='convert.html') return `convert.html#${tools.find(tool=>`#${tool.id}`===hash)?.id || tools[0].id}`;
  return pages.find(page=>page.file===file)?.file;
}

