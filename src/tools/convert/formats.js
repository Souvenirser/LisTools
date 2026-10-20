import { parseJson, stringifyJson, LosslessNumber } from './json.js';
import { validText } from './bytes.js';

const formatNotice = '转换保留数据值与约定结构，不保留源文件注释、排版或引号写法';
function yamlNumber(raw) {
  if (/^[+]?0[ox]/i.test(raw)) return new LosslessNumber(BigInt(raw.replace(/^\+/, '')).toString());
  let value = raw.replace(/^\+/, '').replace(/^(-?)\./, '$10.').replace(/\.(?=e|$)/i,'.0');
  value = value.replace(/^(-?)0+(?=\d)/, '$1');
  return new LosslessNumber(value);
}
function yamlTags(tags) {
  return tags.map(tag => /:(int|float)$/.test(tag.tag) ? {
    ...tag, identify:value => value instanceof LosslessNumber,
    resolve:yamlNumber, stringify:node => node.value.value
  } : tag);
}
async function yamlConvert(source, reverse) {
  const YAML = await import('yaml');
  const options = {version:'1.2',schema:'core',customTags:yamlTags,resolveKnownTags:false,uniqueKeys:true};
  if (!reverse) return { text:new YAML.Document(parseJson(source),options).toString({lineWidth:0}), extension:'yaml', notice:formatNotice };
  const doc = YAML.parseDocument(source,options);
  if (doc.errors.length || doc.warnings.length) {
    const error = doc.errors[0] || doc.warnings[0];
    throw Object.assign(new Error(error.message),{line:error.linePos?.[0]?.line,column:error.linePos?.[0]?.col});
  }
  const active = new Set();
  function compatible(value) {
    if (value instanceof LosslessNumber || value === null || ['string','boolean'].includes(typeof value)) return value;
    if (!value || typeof value !== 'object') throw new Error('YAML 含有不支持的非 JSON 类型');
    if (active.has(value)) throw new Error('循环 YAML 别名不能转换为 JSON');
    active.add(value);
    let result;
    if (Array.isArray(value)) result = value.map(compatible);
    else if (value instanceof Map) {
      result = Object.create(null);
      for (const [key,item] of value) {
        if (typeof key !== 'string') throw new Error('YAML 映射键必须为字符串');
        result[key] = compatible(item);
      }
    } else throw new Error('YAML 含有不支持的非 JSON 类型');
    active.delete(value);
    return result;
  }
  return {text:stringifyJson(compatible(doc.toJS({mapAsMap:true,maxAliasCount:100}))),extension:'json',notice:formatNotice};
}
function validateOrdered(value) {
  if (!Array.isArray(value)) throw new Error('反向 XML 转换需要本工具产生的保序节点数组');
  for (const node of value) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) throw new Error('XML 节点必须为对象');
    const names = Object.keys(node).filter(k => k !== ':@');
    if (names.length !== 1) throw new Error('每个保序 XML 节点必须只有一个节点名');
    const key = names[0];
    if (node[':@'] !== undefined && (!node[':@'] || Array.isArray(node[':@']) || Object.entries(node[':@']).some(([k,v]) => !k.startsWith('@_') || typeof v !== 'string'))) throw new Error('XML 属性必须是 @_ 前缀的字符串映射');
    if (key === '#text') { if (typeof node[key] !== 'string') throw new Error('XML 文本节点必须为字符串'); }
    else validateOrdered(node[key]);
  }
}
async function xmlConvert(source, reverse) {
  const { XMLParser, XMLBuilder, XMLValidator } = await import('fast-xml-parser');
  const options = {preserveOrder:true,ignoreAttributes:false,trimValues:false,parseTagValue:false,parseAttributeValue:false,commentPropName:'#comment',cdataPropName:'#cdata',processEntities:true,htmlEntities:true,maxNestedTags:100,
    onDangerousProperty:name => { throw new Error(`XML 节点或属性名 ${name} 为解析器保留名称，不能无损转换`); }};
  function validate(xml) {
    validText(xml);
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/u.test(xml)) throw new Error('XML 1.0 包含不允许的字符');
    const declarations = xml.replace(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>/g,'');
    if (/<!\s*(DOCTYPE|ENTITY)\b/i.test(declarations)) throw new Error('不支持 DTD 或实体声明');
    if (/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[\da-fA-F]+);)/.test(declarations)) throw new Error('XML 包含未定义或非法实体');
    for (const match of declarations.matchAll(/&#(x[\da-fA-F]+|\d+);/g)) {
      const cp = match[1][0] === 'x' ? parseInt(match[1].slice(1),16) : Number(match[1]);
      if (!([9,10,13].includes(cp) || cp >= 0x20 && cp <= 0xD7FF || cp >= 0xE000 && cp <= 0xFFFD || cp >= 0x10000 && cp <= 0x10FFFF)) throw new Error('XML 数字字符引用超出 XML 1.0 合法范围');
    }
    const valid = XMLValidator.validate(xml);
    if (valid !== true) throw Object.assign(new Error(valid.err.msg),{line:valid.err.line,column:valid.err.col});
  }
  function parse(xml) {
    validate(xml);
    const nodes = new XMLParser(options).parse(xml);
    const roots = nodes.filter(node => Object.keys(node).some(key => key !== ':@' && !/^[#?]/.test(key)));
    if (roots.length !== 1 || nodes.some(node => node['#text']?.trim() || node['#cdata'])) throw new Error('XML 必须只有一个文档根元素，根元素之外不能包含文本或 CDATA');
    return nodes;
  }
  if (reverse) {
    const value = parseJson(source);
    validateOrdered(value);
    const xml = new XMLBuilder(options).build(value);
    // Builder must not drop unsupported metadata or normalize malformed nodes silently.
    const parsed = parse(xml);
    if (stringifyJson(parsed,0) !== stringifyJson(value,0)) throw new Error('该节点结构无法无损还原 XML');
    return {text:xml,extension:'xml',notice:formatNotice};
  }
  return {text:stringifyJson(parse(source)),extension:'json',notice:formatNotice};
}
async function csvConvert(source, id, options, reverse) {
  const { default: Papa } = await import('papaparse');
  const delimiter = id === 'tsv-json' ? '\t' : ',', header = options.header !== false && options.header !== 'false';
  const cells = options.cells === 'json';
  if (!reverse) {
    const parsed = Papa.parse(source,{delimiter,header:false,dynamicTyping:false,skipEmptyLines:false});
    if (parsed.errors.length) throw new Error(`CSV 解析失败：${parsed.errors[0].message}`);
    const rows = parsed.data;
    if (source.startsWith('\uFEFF') && rows.length) rows[0][0] = '\uFEFF' + rows[0][0];
    if (/[\r\n]$/.test(source) && rows.at(-1)?.length === 1 && rows.at(-1)[0] === '') rows.pop();
    if (!rows.length) return {text:'[]',extension:'json'};
    const columns = rows[0].length;
    if (rows.some(row => row.length !== columns)) throw new Error('CSV 各行列数不一致');
    const names = header ? rows.shift() : null;
    if (names && new Set(names).size !== names.length) throw new Error('CSV 表头存在重复列名');
    const values = rows.map((row,rowIndex) => {
      const values = cells ? row.map((cell,col) => {
        try { return parseJson(cell); } catch (e) { throw new Error(`CSV 第 ${rowIndex+(header ? 2 : 1)} 行第 ${col+1} 列 JSON 单元格无效：${e.message}`); }
      }) : row;
      if (!names) return values;
      const record = Object.create(null);
      names.forEach((name,i) => { record[name] = values[i]; });
      return record;
    });
    return {text:stringifyJson(values),extension:'json',notice:cells ? formatNotice : 'CSV 单元格保持字符串，不自动推断数字或布尔类型'};
  }
  const rows = parseJson(source);
  if (!Array.isArray(rows)) throw new Error('JSON 根值必须为表格行数组');
  if (!rows.length) return {text:'',extension:delimiter === ',' ? 'csv' : 'tsv'};
  const arrays = Array.isArray(rows[0]);
  if (arrays && header) throw new Error('数组行没有列名，请关闭首行表头选项');
  if (!arrays && (!rows[0] || typeof rows[0] !== 'object' || rows[0] instanceof LosslessNumber)) throw new Error('每一行必须为对象或数组');
  const keys = Object.keys(rows[0]);
  if (!keys.length) throw new Error('CSV 不能无损表示非空的零列表格');
  const table = rows.map(row => {
    if (!row || Array.isArray(row) !== arrays || typeof row !== 'object' || Object.keys(row).length !== keys.length || keys.some(k => !Object.hasOwn(row,k))) throw new Error('JSON 各行列结构不一致或存在缺失值');
    return keys.map(key => {
      const value = row[key];
      if (cells) return stringifyJson(value,0);
      if (value instanceof LosslessNumber) return value.value;
      if (['string','boolean'].includes(typeof value)) return String(value);
      throw new Error('默认 CSV 模式不支持 null 或嵌套值；请选择 JSON 单元格模式');
    });
  });
  return {text:Papa.unparse(header ? [keys,...table] : table,{delimiter,newline:'\r\n',quotes:value => value === ''}),extension:delimiter === ',' ? 'csv' : 'tsv',notice:cells ? formatNotice : 'CSV 是文本表格，默认导出不携带 JSON 标量类型信息'};
}
export async function run(id, input, options) {
  const source = await input.text(), reverse = options.direction === 'decode';
  if (id === 'json-yaml') return yamlConvert(source,reverse);
  if (id === 'xml-json') return xmlConvert(source,reverse);
  if (id === 'csv-json' || id === 'tsv-json') return csvConvert(source,id,options,reverse);
  if (id === 'jsonl') {
    if (reverse) {
      const values = parseJson(source);
      if (!Array.isArray(values)) throw new Error('JSON 根值必须为数组');
      return {text:values.map(value => stringifyJson(value,0)).join('\n'),extension:'jsonl'};
    }
    const lines = source ? source.split(/\r\n|\r|\n/) : [];
    if (lines.at(-1) === '') lines.pop();
    const values = lines.map((line,index) => {
      try { return parseJson(line); } catch(e) { throw Object.assign(new Error(`JSON Lines 第 ${index+1} 行：${e.message}`),{line:index+1,column:e.column}); }
    });
    return {text:stringifyJson(values),extension:'json'};
  }
  if (id === 'query-json') {
    if (!reverse) {
      const object = Object.create(null);
      for (const segment of source.split('&')) if (segment) {
        const at = segment.indexOf('='), key = at < 0 ? segment : segment.slice(0,at), value = at < 0 ? '' : segment.slice(at+1);
        const decode = text => decodeURIComponent(text.replace(/\+/g,' '));
        const name = decode(key);
        (object[name] ||= []).push(decode(value));
      }
      return {text:stringifyJson(object),extension:'json'};
    }
    const value = parseJson(source), result = new URLSearchParams();
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('Query String 反向映射需要字符串数组对象');
    for (const [key,values] of Object.entries(value)) {
      if (!Array.isArray(values) || !values.length || values.some(v => typeof v !== 'string')) throw new Error('每个查询参数必须对应非空的字符串数组');
      validText(key);
      for (const item of values) result.append(key,validText(item));
    }
    return {text:result.toString()};
  }
  throw new Error('未找到格式转换工具');
}
