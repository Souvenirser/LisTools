// 仅接收 Worker 返回的短诊断，不保留整份输入，也不解释输入中的 HTML。
export function createDiagnosticView({ root, sources, onLocate, contentName, t, language }) {
  const badges = {};
  let currentStates = {};
  const labels = { valid:'校验通过', invalid:'格式错误', incomplete:'校验未完成', unchecked:'尚未校验', pending:'校验中', readable:'可比较' };
  const label = value => t('diagnostic.' + value, { defaultValue:labels[value] });
  const sideName = side => language() === 'zh-Hans'
    ? `${side === 'left' ? '左侧原' : '右侧新'} ${contentName()}`
    : t(side === 'left' ? 'diff.original' : 'diff.new', { name:contentName() });
  for (const side of ['left', 'right']) {
    badges[side] = [document.createElement('span'), document.createElement('span')];
    for (const badge of badges[side]) badge.className = 'validation-badge';
    document.getElementById(`${side}-import`).before(badges[side][0]);
    document.getElementById(`${side}-result-title`).parentElement.append(badges[side][1]);
  }
  function status(states = {}) {
    currentStates = states;
    for (const side of ['left', 'right']) {
      const value = states[side] || 'unchecked';
      for (const badge of badges[side]) {
        badge.dataset.validation = value;
        badge.textContent = label(value);
      }
      sources[side].setAttribute('aria-invalid', String(value === 'invalid'));
    }
  }
  function clear() { root.hidden = true; root.replaceChildren(); status(); }
  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function card(issue, side, validation) {
    const node = element('section', '', 'diagnostic-card');
    node.dataset.diagnosticSide = side || 'tool';
    node.dataset.validation = issue ? 'invalid' : validation;
    const name = side ? sideName(side) : t('diff.name');
    const title = issue ? issue.category === 'syntax' ? label('invalid') : issue.stage === 'read' ? t('diagnostic.importFailed', { defaultValue:'导入失败' }) : issue.stage === 'parse' ? label('incomplete') : t('diagnostic.processingFailed', { defaultValue:'处理失败' }) : label(validation);
    node.append(element('strong', `${name} · ${title}`));
    if (!issue) return node;
    if (issue.line) node.append(element('span', t('common.location',issue), 'diagnostic-location'));
    if (language() === 'zh-Hans') node.append(element('p', issue.message), element('p', issue.hint, 'diagnostic-hint'));
    else {
      const code = issue.translationCode ?? issue.code;
      const key = typeof code === 'number' ? `syntax${code}` : code;
      node.append(element('p', t('diagnostic.' + (key || 'TaskFailed'), { defaultValue:issue.message })));
    }
    const end = t('diagnostic.end', { defaultValue:'文件末尾' });
    if (issue.character) {
      const character = language() === 'zh-Hans' ? issue.character : issue.excerpt?.token === '文件末尾' ? end : issue.character.replace(/^[^（]*（/, '(').replace(/）$/,')');
      node.append(element('p', t('diagnostic.character', { character, defaultValue:'错误位置：{{character}}' }), 'diagnostic-character'));
    }
    if (issue.excerpt) {
      const context = element('pre', '', 'diagnostic-context');
      context.dir = 'ltr';
      context.append(document.createTextNode(issue.excerpt.before), element('mark', issue.excerpt.token === '文件末尾' ? end : issue.excerpt.token), document.createTextNode(issue.excerpt.after));
      node.append(context);
    }
    if (side && issue.position !== undefined) {
      const button = element('button', `${t('common.locate')} · ${sideName(side)}`);
      button.type = 'button';
      button.addEventListener('click', () => onLocate(issue));
      node.append(button);
    }
    return node;
  }
  function show(state) {
    root.replaceChildren(); root.hidden = false;
    status(state.validation);
    const sides = state.issues.filter(issue => issue.side);
    if (sides.length) for (const side of ['left', 'right']) root.append(card(sides.find(issue => issue.side === side), side, state.validation[side]));
    for (const issue of state.issues.filter(issue => !issue.side)) root.append(card(issue));
    const invalid = ['left', 'right'].filter(side => state.validation[side] === 'invalid');
    if (language() === 'zh-Hans') {
      if (invalid.length === 2) return '无法对比：左右两侧 JSON 格式均有错误';
      if (invalid.length) return `无法对比：${sideName(invalid[0])} 格式错误`;
      if (sides.some(issue => issue.stage === 'read')) return `无法对比：${sideName(sides[0].side)} 文件导入失败`;
      return '无法对比：工具处理失败，请查看两侧校验状态';
    }
    return invalid.length ? `${t('diff.failed')}: ${invalid.map(sideName).join(' / ')} · ${label('invalid')}` : t('diff.failed');
  }
  return { clear, status, show, refresh:() => status(currentStates) };
}
