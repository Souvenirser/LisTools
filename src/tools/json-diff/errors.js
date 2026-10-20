const syntax = {
  1: ['存在 JSON 不支持的字符', '检查此处标点、引号或不可见字符。'],
  2: ['数字格式不正确', '使用 JSON 数字格式，例如 -12、0.5 或 1e3。'],
  3: ['字段名必须使用双引号', '将字段名写为 "字段名": 值。'],
  4: ['缺少 JSON 值', '此处应填写对象、数组、字符串、数字、true、false 或 null。'],
  5: ['字段名后缺少冒号', '在字段名和对应值之间添加英文冒号 :。'],
  6: ['相邻字段或数组元素之间缺少逗号', '在两项之间添加英文逗号 ,。'],
  7: ['对象缺少结束符 }', '检查并补齐对象的右大括号 }。'],
  8: ['数组缺少结束符 ]', '检查并补齐数组的右方括号 ]。'],
  9: ['JSON 根值后存在多余内容', '仅保留一个根值；多个对象应放入数组中。'],
  10: ['标准 JSON 不支持注释', '删除 // 或 /* */ 注释后重试。'],
  11: ['注释未结束，且标准 JSON 不支持注释', '删除此处注释后重试。'],
  12: ['字符串缺少结束双引号', '检查字符串结尾，并为内容中的双引号添加反斜杠转义。'],
  13: ['数字未写完整', '小数点和指数后必须包含数字，例如 0.5、1e3。'],
  14: ['Unicode 转义不正确', '使用反斜杠 u 加四位十六进制数字，例如 \\u4F60。'],
  15: ['字符串转义不正确', '反斜杠后仅允许 "、\\、/、b、f、n、r、t 或 u。'],
  16: ['字符串中存在未转义的控制字符', '将换行、回车和制表符写为 \\n、\\r 和 \\t。']
};
const punctuation = {
  '，': ['中文逗号', '英文逗号 ,'], '：': ['中文冒号', '英文冒号 :'],
  '“': ['弯双引号', '英文双引号 "'], '”': ['弯双引号', '英文双引号 "'],
  '‘': ['弯单引号', '英文双引号 "'], '’': ['弯单引号', '英文双引号 "'],
  '｛': ['全角大括号', '英文大括号 {'], '｝': ['全角大括号', '英文大括号 }'],
  '［': ['全角方括号', '英文方括号 ['], '］': ['全角方括号', '英文方括号 ]']
};
const invisible = { '\u200b':'零宽空格', '\u200c':'零宽非连接符', '\u200d':'零宽连接符', '\u2060':'不可见连接符', '\ufeff':'不可见 BOM 字符', '\u00a0':'不换行空格' };

function endLocation(source) {
  let line = 0, start = 0;
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '\r') { if (source[i + 1] === '\n') i++; line++; start = i + 1; }
    else if (source[i] === '\n') { line++; start = i + 1; }
  }
  return [line, source.length - start];
}

export function parseDiagnostic(source, code, position, length, line, column, context = {}) {
  let [message, hint] = syntax[code] || syntax[1];
  let translationCode = code;
  const char = position < source.length ? String.fromCodePoint(source.codePointAt(position)) : undefined;
  if (code === 'DuplicateKey') {
    message = `存在重复字段：${context.key.slice(0, 60)}`;
    hint = '同一对象中的字段名必须唯一，避免不同解析器覆盖数据。';
  } else if (code === 4 && !source.trim()) {
    code = translationCode = 'EmptyInput'; message = '输入内容为空'; hint = '粘贴或导入需要对比的 JSON。';
  } else if ([3, 4].includes(code) && context.lastToken === ',' && /[}\]]/.test(char || '')) {
    translationCode = 4;
    message = '对象或数组末尾存在多余逗号'; hint = '删除结束括号前最后一个逗号。';
  } else if (code === 1 && punctuation[char]) {
    const [name, replacement] = punctuation[char];
    message = `此处使用了${name}`; hint = `替换为${replacement}。`;
  } else if (code === 1 && invisible[char]) {
    message = `此处存在${invisible[char]}`; hint = '删除此字符；JSON 字符串外仅允许普通空格、换行、回车和制表符。';
  } else if (code === 1 && (char === "'" || context.expectProperty)) {
    message = '字段名和字符串必须使用双引号'; hint = '使用英文双引号 "，不能使用单引号或省略引号。';
  } else if ([6, 9].includes(code) && context.number?.to === position && /\d/.test(char || '') && /^-?0$/.test(source.slice(context.number.from, position))) {
    translationCode = 2;
    message = '数字不能包含多余的前导零'; hint = '将 01 改为 1；若需保留前导零，请写成字符串 "01"。';
  }
  if (code === 12) { position = source.length; length = 0; [line, column] = endLocation(source); }
  const unicode = char ? `U+${char.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}` : '';
  const tokenLength = Math.min(Math.max(length || char?.length || 1, 1), 16);
  return {
    category:'syntax', stage:'parse', code, translationCode: typeof translationCode === 'number' ? translationCode : code, position, length:Math.min(length || 0, 16), line:line + 1, column:column + 1,
    message, hint, character:position >= source.length ? '文件末尾' : `${invisible[char] || char}（${unicode}）`,
    excerpt:{ before:source.slice(Math.max(0, position - 36), position), token:position >= source.length ? '文件末尾' : invisible[char] ? `\\u${char.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}` : source.slice(position, position + tokenLength), after:source.slice(position + tokenLength, position + tokenLength + 36) }
  };
}

export function runtimeDiagnostic(error, stage, side) {
  const messages = {
    read:['文件读取失败', '重新选择文件，并确认文件可以访问。'],
    worker:['对比任务无法启动或意外中断', '请重新对比；仍失败时刷新工具页面。'],
    parse:['JSON 校验未能完成', '可尝试减少输入大小或嵌套层级后重试。'],
    compare:['差异计算失败', '请重新对比；较大的数据可尝试分段比较。'],
    format:['生成格式化内容失败', '可尝试减少输入大小或嵌套层级后重试。'],
    render:['对比结果显示失败', '请重新对比；仍失败时刷新工具页面。']
  };
  let [message, hint] = messages[stage] || messages.compare;
  let code = 'TaskFailed';
  if (/maximum call stack|too much recursion/i.test(error?.message || '')) {
    code = 'NestingLimit'; message = 'JSON 嵌套过深，超出当前处理能力'; hint = '减少嵌套层级或拆分数据后重试。';
  } else if (/invalid string length|allocation failed|out of memory/i.test(error?.message || '')) {
    code = 'SizeLimit'; message = '数据超出当前浏览器的处理容量'; hint = '关闭占用资源的页面，或拆分文件后重试。';
  }
  return { category:stage === 'read' ? 'file' : 'runtime', stage, code, ...(side ? { side } : {}), message, hint };
}

export function errorResult(issues, states = { left:'unchecked', right:'unchecked' }) {
  const validation = { ...states };
  for (const issue of issues) if (issue.side) validation[issue.side] = issue.category === 'syntax' ? 'invalid' : 'incomplete';
  return { ...issues[0], status:'error', issues, validation };
}

export async function readDiffFile(file, side) {
  let bytes;
  try { bytes = await file.arrayBuffer(); }
  catch (error) { throw Object.assign(new Error('文件读取失败'), { diagnostic:runtimeDiagnostic(error, 'read', side) }); }
  try { return new TextDecoder('utf-8', { fatal:true }).decode(bytes); }
  catch (error) {
    const diagnostic = error instanceof TypeError
      ? { category:'file', stage:'read', code:'InvalidEncoding', side, message:'文件不是有效的 UTF-8 编码', hint:'请将文件另存为 UTF-8 编码后重新导入。' }
      : runtimeDiagnostic(error, 'read', side);
    throw Object.assign(new Error(diagnostic.message), { diagnostic });
  }
}
