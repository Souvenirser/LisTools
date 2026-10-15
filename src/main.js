import { createJSONEditor, jsonQueryLanguage, Mode } from 'vanilla-jsoneditor';
import { parse, stringify } from 'lossless-json';
import { version } from '../package.json';
import { createJsonController } from './tools/json/controller.js';
import { bindFileDrop } from './tools/json/file-drop.js';
import './style.css';

const $ = (id) => document.getElementById(id);
$('app-version').textContent = `v${version}`;
const source = $('source');
const resultButtons = document.querySelectorAll('[data-result]');
const parser = { parse, stringify };
let editor;
let resultText = '';
let errorPosition;
let inputVersion = 0;
let filename = 'formatted.json';
let toastTimer;
let largeResult = false;

function size(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function notify(message) {
  clearTimeout(toastTimer);
  $('notification').textContent = message;
  $('notification').hidden = false;
  toastTimer = setTimeout(() => { $('notification').hidden = true; }, 3500);
}

function renderMenu(items, { mode }) {
  const labels = { text: '文本', tree: '树形', 'Expand all': '全部展开', 'Collapse all': '全部折叠', 'Search (Ctrl+F)': '搜索' };
  return items.filter((item) => item.text !== 'table' && item.className !== 'jse-copy').map((item) => {
    const label = labels[item.text] || labels[item.title];
    const translated = label ? {
      ...item, icon: undefined, text: label,
      className: `${item.className || ''} lis-menu-label${item.text === 'tree' ? ' jse-last' : ''}`,
      title: label === '搜索' ? '搜索 (Ctrl / ⌘ + F)' : label
    } : item;
    if (mode === Mode.tree && largeResult && ['Expand all', 'Collapse all'].includes(item.title)) {
      return { ...translated, onClick: async () => {
        const currentEditor = editor;
        currentEditor.updateProps({ mode: Mode.text });
        await currentEditor.refresh();
        if (editor !== currentEditor || !resultText) return;
        if (item.title === 'Expand all') currentEditor.expand([], () => true);
        else currentEditor.collapse([], true);
        notify('大 JSON 的批量展开/折叠使用文本视图，树形视图可按分支浏览。');
      } };
    }
    return translated;
  });
}

function render(state) {
  resultText = '';
  errorPosition = undefined;
  for (const button of resultButtons) button.disabled = true;
  $('editor').hidden = true;
  $('placeholder').hidden = false;
  $('error-detail').hidden = true;
  $('locate-error').hidden = true;
  $('result-info').textContent = '保留大整数与小数精度';
  $('result-state').textContent = state.status === 'pending' ? '处理中…' : '就绪';
  $('placeholder').classList.toggle('is-error', state.status === 'error');
  $('placeholder').setAttribute('aria-busy', String(state.status === 'pending'));

  if (state.status === 'ready') {
    try {
      largeResult = state.nodeCount > 2000 || state.text.length > 1000000;
      $('placeholder').hidden = true;
      $('editor').hidden = false;
      if (!editor) {
        editor = createJSONEditor({
          target: $('editor'),
          props: {
            content: { text: state.text }, mode: Mode.text, readOnly: true,
            parser, validationParser: parser, askToFormat: false,
            indentation: Number($('indent').value), tabSize: Number($('indent').value),
            maxDocumentSizeTextMode: 50 * 1024 * 1024,
            queryLanguages: [jsonQueryLanguage],
            ariaLabel: 'JSON 解析结果', onRenderMenu: renderMenu,
            onError: (error) => notify(`编辑器：${error.message}`)
          }
        });
      } else {
        editor.updateProps({ indentation: Number($('indent').value), tabSize: Number($('indent').value) });
        editor.set({ text: state.text });
      }
      resultText = state.text;
      for (const button of resultButtons) button.disabled = false;
      $('input-info').textContent = size(state.inputBytes);
      $('result-info').textContent = `${size(state.outputBytes)} · ${state.text.length.toLocaleString()} 字符`;
      $('result-state').textContent = '解析成功';
    } catch (error) {
      render({ status: 'error', message: `结果展示失败：${error.message}` });
    }
    return;
  }

  if (state.status === 'error') {
    $('placeholder-title').textContent = 'JSON 解析失败';
    $('placeholder-description').textContent = state.line ? `第 ${state.line} 行，第 ${state.column} 列` : '请检查输入内容，或重新尝试。';
    $('error-detail').textContent = state.message;
    $('error-detail').hidden = false;
    $('result-state').textContent = '输入有误';
    errorPosition = state.position;
    $('locate-error').hidden = errorPosition === undefined;
  } else {
    $('placeholder-title').textContent = state.status === 'pending' ? '正在解析 JSON…' : state.status === 'idle' ? '输入已更新' : '等待输入 JSON';
    $('placeholder-description').textContent = state.status === 'pending' ? '大文件需要一些时间，仍可编辑或清空输入。' : state.status === 'idle' ? '点击「美化」或「压缩」查看结果。' : '美化后可切换文本或树形视图，展开或折叠节点。';
  }
  if (state.status !== 'pending' && editor) {
    void editor.destroy();
    editor = undefined;
  }
}

const controller = createJsonController({
  createWorker: () => new Worker(new URL('./tools/json/worker.js', import.meta.url), { type: 'module' }),
  onState: render
});

function process(action = 'format', wait = 0) {
  controller.process(source.value, { action, indent: Number($('indent').value), wait });
}

function inputChanged() {
  inputVersion += 1;
  $('input-info').textContent = source.value ? `${source.value.length.toLocaleString()} 字符` : '原始 JSON';
  if ($('auto-format').checked || !source.value.trim()) process('format', 350);
  else {
    controller.cancel();
    render({ status: 'idle' });
  }
}

source.addEventListener('input', inputChanged);
$('format').addEventListener('click', () => process());
$('compact').addEventListener('click', () => process('compact'));
$('indent').addEventListener('change', () => process());
$('auto-format').addEventListener('change', () => {
  controller.cancel();
  if ($('auto-format').checked) process();
  else if (!resultText) render({ status: source.value.trim() ? 'idle' : 'empty' });
});
$('clear').addEventListener('click', () => {
  source.value = '';
  $('file').value = '';
  $('file-name').textContent = '支持对象、数组及 JSON 原始值';
  filename = 'formatted.json';
  inputChanged();
  source.focus();
});
$('import').addEventListener('click', () => $('file').click());
async function loadFile(file) {
  if (!file) return;
  const current = ++inputVersion;
  controller.cancel();
  render({ status: 'pending' });
  try {
    const text = await file.text();
    if (current !== inputVersion) return;
    source.value = text;
    filename = `${file.name.replace(/\.[^.]+$/, '')}.formatted.json`;
    $('file-name').textContent = file.name;
    $('input-info').textContent = `${text.length.toLocaleString()} 字符`;
    process();
  } catch (error) {
    if (current === inputVersion) render({ status: 'error', message: `文件读取失败：${error.message}` });
  } finally {
    $('file').value = '';
  }
}
$('file').addEventListener('change', () => loadFile($('file').files[0]));
bindFileDrop(document, {
  onFile: loadFile,
  onActive: (active) => { $('file-drop-overlay').hidden = !active; },
  onError: notify
});
$('locate-error').addEventListener('click', () => {
  source.focus();
  source.setSelectionRange(errorPosition, errorPosition + 1);
  const line = source.value.slice(0, errorPosition).split('\n').length;
  source.scrollTop = Math.max(0, (line - 3) * parseFloat(getComputedStyle(source).lineHeight));
});
$('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(resultText);
    notify('已复制完整结果');
  } catch (error) {
    console.warn('Clipboard write failed:', error.name, error.message);
    notify('剪贴板不可用，请使用下载保存完整结果。');
  }
});
$('download').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([resultText], { type: 'application/json;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
    event.preventDefault();
    process();
  }
});
window.addEventListener('pagehide', () => controller.cancel());
