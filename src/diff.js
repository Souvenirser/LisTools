import { MergeView, Change } from '@codemirror/merge';
import { EditorState } from '@codemirror/state';
import { EditorView, lineNumbers, keymap, drawSelection } from '@codemirror/view';
import { json } from '@codemirror/lang-json';
import { syntaxHighlighting, defaultHighlightStyle, foldGutter } from '@codemirror/language';
import { searchKeymap } from '@codemirror/search';
import { version } from '../package.json';
import { bindFileDrop } from './tools/json/file-drop.js';
import { createDiffController } from './tools/json-diff/controller.js';
import './style.css';
import './diff-style.css';

const $ = id => document.getElementById(id);
$('app-version').textContent = `v${version}`;
const sources = { left: $('left-source'), right: $('right-source') };
const versions = { left: 0, right: 0 };
const reading = { left: false, right: false };
const filenames = { left: '', right: '' };
let merge;
let total = 0;
let current = 0;
let lastError;
let toastTimer;

function notify(message) {
  clearTimeout(toastTimer);
  $('notification').textContent = message;
  $('notification').hidden = false;
  toastTimer = setTimeout(() => { $('notification').hidden = true; }, 3500);
}

function navigation() {
  $('previous').disabled = !total || current === 0;
  $('next').disabled = !total || current === total - 1;
  $('diff-index').disabled = !total;
  $('diff-index').value = total ? current + 1 : 1;
  $('diff-index').max = total || 1;
  $('diff-length').textContent = total.toLocaleString();
}

function resetResult() {
  merge?.destroy();
  merge = undefined;
  total = 0;
  current = 0;
  lastError = undefined;
  $('diff-view').hidden = true;
  $('diff-placeholder').hidden = false;
  $('diff-error').hidden = true;
  $('locate-error').hidden = true;
  $('diff-total').classList.remove('equal');
  $('diff-duration').textContent = '';
  $('change-kind').textContent = '';
  $('change-kind').className = '';
  $('change-path').textContent = '差异将按 JSON 路径逐处定位';
  for (const name of ['added', 'removed', 'modified']) $(`count-${name}`).textContent = '—';
  navigation();
}

function extensions(label) {
  return [
    lineNumbers(), drawSelection(), json(), foldGutter(), syntaxHighlighting(defaultHighlightStyle),
    keymap.of(searchKeymap), EditorState.readOnly.of(true), EditorView.editable.of(false),
    EditorView.contentAttributes.of({ 'aria-label': label, tabindex: '0' }),
    EditorState.phrases.of({ '$ unchanged lines': '收起的 $ 行未变化内容', 'unchanged lines': '未变化行' })
  ];
}

function render(state) {
  resetResult();
  const pending = state.status === 'pending';
  $('compare').disabled = pending;
  $('cancel').hidden = !pending;
  if (state.status === 'ready') {
    try {
      total = state.total;
      $('diff-total').textContent = total ? `共 ${total.toLocaleString()} 处差异` : '0 处差异 · 完全一致';
      $('diff-total').classList.toggle('equal', total === 0);
      for (const name of ['added', 'removed', 'modified']) $(`count-${name}`).textContent = state.counts[name].toLocaleString();
      $('diff-duration').textContent = `计算 ${state.durationMs.toLocaleString()} ms`;
      $('diff-placeholder').hidden = true;
      $('diff-view').hidden = false;
      const changes = state.textChanges.map(c => new Change(c.fromA, c.toA, c.fromB, c.toB));
      merge = new MergeView({
        parent: $('diff-view'),
        a: { doc: state.leftText, extensions: extensions('原 JSON 对比结果') },
        b: { doc: state.rightText, extensions: extensions('新 JSON 对比结果') },
        collapseUnchanged: $('only-diff').checked ? { margin: 3, minSize: 4 } : undefined,
        diffConfig: { override: () => changes }, highlightChanges: true, gutter: true
      });
      merge.a.dom.dataset.diffSide = 'left';
      merge.b.dom.dataset.diffSide = 'right';
      $('inputs').open = false;
      navigation();
    } catch (error) {
      controller.cancel();
      render({ status: 'error', message: `结果显示失败：${error.message}` });
    }
    return;
  }
  if (state.status === 'error') {
    lastError = state;
    $('diff-total').textContent = '无法对比';
    $('diff-placeholder-title').textContent = state.side ? `${state.side === 'left' ? '原' : '新'} JSON 解析失败` : '对比失败';
    $('diff-placeholder-description').textContent = state.line ? `第 ${state.line} 行，第 ${state.column} 列` : '请检查输入或重新尝试。';
    $('diff-error').textContent = state.message;
    $('diff-error').hidden = false;
    $('locate-error').hidden = state.position === undefined;
    $('inputs').open = true;
  } else {
    $('diff-total').textContent = pending ? (state.reading ? '正在读取文件…' : '正在对比…') : '等待对比';
    $('diff-placeholder-title').textContent = pending ? (state.reading ? '正在读取本地文件' : '正在比较两份 JSON') : '放入两份 JSON，查看差异';
    $('diff-placeholder-description').textContent = pending ? '可随时取消，或修改输入重新对比。' : '新增、删除和修改会分别标记，顶部统计全部差异点。';
  }
}

function showChange(change) {
  if (!merge || !total) return;
  current = change.index;
  navigation();
  const labels = { CREATE: ['新增', 'added'], REMOVE: ['删除', 'removed'], CHANGE: ['修改', 'modified'] };
  const [label, style] = labels[change.kind];
  $('change-kind').textContent = label;
  $('change-kind').className = style;
  $('change-path').textContent = change.pointer || '$（根值）';
  $('change-path').title = change.pointer || '$（根值）';
  const a = Math.min(change.anchorA, merge.a.state.doc.length);
  const b = Math.min(change.anchorB, merge.b.state.doc.length);
  merge.a.dispatch({ selection: { anchor: a } });
  merge.b.dispatch({ selection: { anchor: b } });
  const view = change.kind === 'CREATE' ? merge.b : merge.a;
  view.dispatch({ effects: EditorView.scrollIntoView(change.kind === 'CREATE' ? b : a, { y: 'center', x: 'center' }) });
}

const controller = createDiffController({
  createWorker: () => new Worker(new URL('./tools/json-diff/worker.js', import.meta.url), { type: 'module' }),
  onState: render, onChange: showChange
});

function invalidate() {
  controller.cancel();
  render({ status: 'idle' });
}
function compare() {
  controller.compare(sources.left.value, sources.right.value);
}
function compareIfReady() {
  if (!reading.left && !reading.right && sources.left.value.trim() && sources.right.value.trim()) compare();
}
function fileLabels() {
  $('left-file').textContent = filenames.left || '左侧 · 比较基准';
  $('right-file').textContent = filenames.right || '右侧 · 比较目标';
}
async function loadFile(side, file) {
  if (!file) return;
  const currentVersion = ++versions[side];
  reading[side] = true;
  controller.cancel();
  render({ status: 'pending', reading: true });
  try {
    const text = await file.text();
    if (versions[side] !== currentVersion) return;
    sources[side].value = text;
    filenames[side] = file.name;
    fileLabels();
  } catch (error) {
    if (versions[side] === currentVersion) render({ status: 'error', message: `文件读取失败：${error.message}` });
    return;
  } finally {
    if (versions[side] === currentVersion) reading[side] = false;
    $(`${side}-file-input`).value = '';
  }
  if (versions[side] !== currentVersion) return;
  if (!reading.left && !reading.right) {
    render({ status: 'idle' });
    compareIfReady();
  }
}

for (const side of ['left', 'right']) {
  sources[side].addEventListener('input', () => {
    versions[side] += 1;
    reading[side] = false;
    filenames[side] = '';
    fileLabels();
    invalidate();
  });
  $(`${side}-import`).addEventListener('click', () => $(`${side}-file-input`).click());
  $(`${side}-file-input`).addEventListener('change', () => loadFile(side, $(`${side}-file-input`).files[0]));
}
bindFileDrop(document, {
  onFile: (file, event) => {
    const side = event.target.closest('[data-diff-side]')?.dataset.diffSide;
    if (side) void loadFile(side, file);
    else notify('请把文件拖到左侧原 JSON 或右侧新 JSON 区域');
  },
  onActive: active => { $('file-drop-overlay').hidden = !active; }, onError: notify
});
$('compare').addEventListener('click', compare);
$('cancel').addEventListener('click', () => {
  for (const side of ['left', 'right']) { versions[side] += 1; reading[side] = false; }
  invalidate();
  notify('已取消对比，可修改输入后重新开始');
});
$('clear').addEventListener('click', () => {
  for (const side of ['left', 'right']) { versions[side] += 1; reading[side] = false; sources[side].value = ''; filenames[side] = ''; }
  fileLabels();
  invalidate();
  $('inputs').open = true;
});
$('swap').addEventListener('click', () => {
  for (const side of ['left', 'right']) { versions[side] += 1; reading[side] = false; }
  [sources.left.value, sources.right.value] = [sources.right.value, sources.left.value];
  [filenames.left, filenames.right] = [filenames.right, filenames.left];
  fileLabels();
  invalidate();
  compareIfReady();
});
function select(index) {
  if (!total) return;
  current = Math.max(0, Math.min(total - 1, Math.trunc(Number(index) || 0)));
  navigation();
  controller.select(current);
}
$('previous').addEventListener('click', () => select(current - 1));
$('next').addEventListener('click', () => select(current + 1));
$('diff-index').addEventListener('change', () => select(Number($('diff-index').value) - 1));
$('diff-index').addEventListener('keydown', event => {
  if (event.key === 'Enter') { event.preventDefault(); select(Number($('diff-index').value) - 1); }
});
$('only-diff').addEventListener('change', () => merge?.reconfigure({ collapseUnchanged: $('only-diff').checked ? { margin: 3, minSize: 4 } : undefined }));
$('locate-error').addEventListener('click', () => {
  const source = sources[lastError.side];
  source.focus();
  source.setSelectionRange(lastError.position, lastError.position + 1);
  source.scrollTop = Math.max(0, (lastError.line - 3) * parseFloat(getComputedStyle(source).lineHeight));
});
document.addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); compare(); }
});
window.addEventListener('pagehide', () => controller.cancel());
