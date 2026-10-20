import { MergeView, Change } from '@codemirror/merge';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, lineNumbers, keymap, drawSelection, highlightActiveLine, placeholder } from '@codemirror/view';
import { json } from '@codemirror/lang-json';
import { syntaxHighlighting, defaultHighlightStyle, foldGutter } from '@codemirror/language';
import { searchKeymap, searchPanelOpen, closeSearchPanel, openSearchPanel, getSearchQuery, setSearchQuery } from '@codemirror/search';
import { defaultKeymap, historyKeymap } from '@codemirror/commands';
import { version } from '../package.json';
import { bindFileDrop } from './tools/json/file-drop.js';
import { createDiffController } from './tools/json-diff/controller.js';
import { createEditorDiffConfig, historyExtensions, comparisonDocuments, sourceDocument } from './tools/json-diff/editor.js';
import { errorResult, runtimeDiagnostic, readDiffFile } from './tools/json-diff/errors.js';
import { createDiagnosticView } from './tools/json-diff/diagnostics.js';
import './style.css';
import './diff-style.css';
import { t, language, onLanguageChange, createNotifier } from './i18n.js';

const $ = id => document.getElementById(id);
$('app-version').textContent = `v${version}`;
const sources = { left: $('left-source'), right: $('right-source') };
const versions = { left: 0, right: 0 };
const reading = { left: false, right: false };
const fileFailures = { left:undefined, right:undefined };
const filenames = { left: '', right: '' };
let merge;
let renderedDocuments;
let total = 0;
let current = 0;
let lastState = { status: 'idle' };
let currentChange;
let latestImportStartedAt;
let pendingDocuments;
const localeCompartments = { left:new Compartment(), right:new Compartment() };
const mode = () => $('diff-mode').value;
const contentName = () => mode() === 'json' ? 'JSON' : t('common.text');
const inputLocales = { left:new Compartment(), right:new Compartment() };
const inputViews = Object.fromEntries(['left', 'right'].map(side => [side, new EditorView({ parent:sources[side], extensions:inputExtensions(side) })]));
const diagnostics = createDiagnosticView({ root:$('diff-error-panel'), sources:{left:inputViews.left.contentDOM, right:inputViews.right.contentDOM}, onLocate:locateError, contentName, t, language });

const notify = createNotifier();

function inputLocale(side) {
  return [placeholder(t('diff.sourceHint', { name:t(side === 'left' ? 'diff.original' : 'diff.new', { name:contentName() }) })),
    EditorView.contentAttributes.of({ 'aria-labelledby':`${side}-source-label`, spellcheck:'false', dir:'ltr' })];
}
function inputExtensions(side) {
  return [drawSelection(), historyExtensions(), keymap.of([...searchKeymap, ...defaultKeymap, ...historyKeymap]), inputLocales[side].of(inputLocale(side)),
    EditorView.updateListener.of(update => { if (update.docChanged) inputChanged(side); })];
}
function sourceText(side) { return inputViews[side].state.doc.toString(); }
function setSource(side, doc) {
  const view = inputViews[side];
  if (view.state.doc === doc) return;
  view.setState(EditorState.create({ doc:sourceDocument(doc), extensions:inputExtensions(side) }));
}
function inputChanged(side) {
  if (merge) {
    const other = side === 'left' ? 'right' : 'left';
    setSource(other, (other === 'left' ? merge.a : merge.b).state.doc);
  }
  versions[side] += 1; reading[side] = false; fileFailures[side] = undefined; filenames[side] = '';
  fileLabels(); invalidate();
}

function navigation() {
  $('previous').disabled = !total || current === 0;
  $('next').disabled = !total || current === total - 1;
  $('diff-index').disabled = !total;
  $('diff-index').value = total ? current + 1 : 1;
  $('diff-index').max = total || 1;
  $('diff-length').textContent = total || ['idle', 'ready'].includes(lastState.status) ? total.toLocaleString(language()) : '—';
}

function destroyView() {
  merge?.destroy();
  merge = undefined;
  renderedDocuments = undefined;
}

function resetSummary() {
  total = 0;
  current = 0;
  diagnostics.clear();
  $('diff-total').classList.remove('equal');
  $('diff-duration').textContent = '';
  $('diff-duration').title = '';
  for (const name of Object.keys($('diff-duration').dataset)) delete $('diff-duration').dataset[name];
  $('change-kind').textContent = '';
  $('change-kind').className = '';
  $('change-path').textContent = t(mode() === 'json' ? 'diff.pathHint' : 'diff.lineHint');
  for (const name of ['added', 'removed', 'modified']) $(`count-${name}`).textContent = '—';
  navigation();
}

function extensions(side, previousState) {
  return [
    lineNumbers(), drawSelection(), highlightActiveLine(), historyExtensions(previousState),
    ...(mode() === 'json' ? [json(), foldGutter(), syntaxHighlighting(defaultHighlightStyle)] : []),
    keymap.of([...searchKeymap, ...defaultKeymap, ...historyKeymap]),

    EditorView.updateListener.of(update => {
      if (!update.docChanged) return;
      versions[side] += 1;
      reading[side] = false;
      filenames[side] = '';
      fileLabels();
      pendingDocuments = undefined;
      controller.cancel();
      render({ status: 'dirty' });
    }),
    localeCompartments[side].of(localeExtensions(side))
  ];
}

function render(state) {
  const receivedAt = performance.now();
  lastState = state;
  currentChange = undefined;
  document.body.dataset.status = state.status;
  resetSummary();
  const pending = state.status === 'pending';
  $('compare').disabled = pending;
  $('cancel').hidden = !pending;
  $('compare').textContent = t(merge ? 'diff.recompare' : 'diff.compare');
  $('diff-view').hidden = !merge;
  $('diff-placeholder').hidden = Boolean(merge);
  if (state.status === 'ready') {
    try {
      diagnostics.status(mode() === 'json' ? state.validation : { left:'readable', right:'readable' });
      const scrollTop = merge?.dom.scrollTop || 0;
      total = state.total;
      $('diff-total').textContent = total ? t('diff.total', { count:total }) : t('diff.equal');
      $('diff-total').classList.toggle('equal', total === 0);
      for (const name of ['added', 'removed', 'modified']) $(`count-${name}`).textContent = state.counts[name].toLocaleString(language());
      $('diff-duration').textContent = t('diff.duration', { duration:state.durationMs });
      $('diff-placeholder').hidden = true;
      $('diff-view').hidden = false;
      const changes = state.textChanges.map(c => new Change(c.fromA, c.toA, c.fromB, c.toB));
      const docs = comparisonDocuments(state, pendingDocuments);
      pendingDocuments = undefined;
      if (docs.left !== renderedDocuments?.left || docs.right !== renderedDocuments?.right) {
        const previousA = merge?.a.state.doc.eq(docs.left) ? merge.a.state : undefined;
        const previousB = merge?.b.state.doc.eq(docs.right) ? merge.b.state : undefined;
        destroyView();
        merge = new MergeView({
          parent: $('diff-view'),
          a: { doc: previousA?.doc || docs.left, selection: previousA?.selection, extensions: extensions('left', previousA) },
          b: { doc: previousB?.doc || docs.right, selection: previousB?.selection, extensions: extensions('right', previousB) },
          collapseUnchanged: $('only-diff').checked ? { margin: 3, minSize: 4 } : undefined,
          diffConfig: createEditorDiffConfig(changes), highlightChanges: true, gutter: true
        });
        renderedDocuments = { left:merge.a.state.doc, right:merge.b.state.doc };
      }
      merge.dom.scrollTop = scrollTop;
      merge.a.dom.dataset.diffSide = 'left';
      merge.b.dom.dataset.diffSide = 'right';
      $('inputs').open = false;
      $('compare').textContent = t('diff.recompare');
      navigation();
      const builtAt = performance.now();
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (lastState !== state) return;
        const paintedAt = performance.now();
        const startedAt = state.startedAt ?? receivedAt, queuedAt = state.queuedAt ?? receivedAt;
        const metrics = { totalMs:Math.round(paintedAt - startedAt), computeMs:state.durationMs,
          readMs:Math.round(queuedAt - startedAt), responseMs:Math.round(receivedAt - queuedAt), renderMs:Math.round(paintedAt - receivedAt), renderBuildMs:Math.round(builtAt - receivedAt) };
        state.elapsedMs = metrics.totalMs;
        Object.assign($('diff-duration').dataset, metrics, state.phaseMs);
        $('diff-duration').textContent = t('diff.duration', { duration:state.elapsedMs });
        $('diff-duration').title = language() === 'zh-Hans'
          ? `总耗时 ${metrics.totalMs} ms；读取及准备 ${metrics.readMs} ms；Worker 计算 ${metrics.computeMs} ms；首屏渲染 ${metrics.renderMs} ms`
          : `Total ${metrics.totalMs} ms; input ${metrics.readMs} ms; worker computation ${metrics.computeMs} ms; first render ${metrics.renderMs} ms`;
      }));
    } catch (error) {
      controller.cancel();
      render(errorResult([runtimeDiagnostic(error, 'render')], state.validation));
    }
    return;
  }
  if (state.status === 'error') {
    pendingDocuments = undefined;
    errorLabels(state);
    $('diff-placeholder').hidden = true;
    if (!merge) $('inputs').open = true;
  } else {
    if (pending && !state.reading) diagnostics.status({ left:'pending', right:'pending' });
    statusLabels(state);
  }
}

function showChange(change) {
  if (!merge || !total) return;
  current = change.index;
  currentChange = change;
  navigation();
  changeLabels(change);
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
  pendingDocuments = undefined;
  controller.cancel();
  destroyView();
  render({ status: 'idle' });
}
function syncEditors() {
  if (!merge) return;
  setSource('left', merge.a.state.doc);
  setSource('right', merge.b.state.doc);
}
function compare(startedAt) {
  if (reading.left || reading.right) return;
  if (typeof startedAt !== 'number') startedAt = performance.now();
  const issues = Object.values(fileFailures).filter(Boolean);
  if (issues.length) { render(errorResult(issues)); return; }
  const left = merge ? merge.a.state.doc : inputViews.left.state.doc;
  const right = merge ? merge.b.state.doc : inputViews.right.state.doc;
  pendingDocuments = { left, right };
  controller.compare(left.toString(), right.toString(), mode(), startedAt);
}
function compareIfReady(startedAt) {
  const ready = side => mode() === 'text' ? inputViews[side].state.doc.length || filenames[side] : sourceText(side).trim();
  if (!reading.left && !reading.right && ready('left') && ready('right')) compare(startedAt);
}
function fileLabels() {
  $('left-file').textContent = filenames.left || t('diff.baseline');
  $('right-file').textContent = filenames.right || t('diff.target');
}
async function loadFile(side, file) {
  if (!file) return;
  latestImportStartedAt = performance.now();
  syncEditors();
  destroyView();
  const currentVersion = ++versions[side];
  reading[side] = true;
  fileFailures[side] = undefined;
  pendingDocuments = undefined;
  controller.cancel();
  controller.prepare();
  render({ status: 'pending', reading: true });
  try {
    const text = await readDiffFile(file, side);
    if (versions[side] !== currentVersion) return;
    const inputAt = performance.now();
    setSource(side, text);
    $(`${side}-file`).dataset.inputMs = Math.round(performance.now() - inputAt);
    filenames[side] = file.name;
    fileLabels();
  } catch (error) {
    if (versions[side] === currentVersion) {
      controller.cancel();
      fileFailures[side] = error.diagnostic || runtimeDiagnostic(error, 'read', side);
      render(errorResult(Object.values(fileFailures).filter(Boolean)));
    }
    return;
  } finally {
    if (versions[side] === currentVersion) reading[side] = false;
    $(`${side}-file-input`).value = '';
  }
  if (versions[side] !== currentVersion) return;
  if (!reading.left && !reading.right) {
    const issues = Object.values(fileFailures).filter(Boolean);
    if (issues.length) { render(errorResult(issues)); return; }
    render({ status: 'idle' });
    compareIfReady(latestImportStartedAt);
  }
}

for (const side of ['left', 'right']) {
  $(`${side}-import`).addEventListener('click', () => $(`${side}-file-input`).click());
  $(`${side}-file-input`).addEventListener('change', () => loadFile(side, $(`${side}-file-input`).files[0]));
}
bindFileDrop(document, {
  onFile: (file, event) => {
    const side = event.target.closest('[data-diff-side]')?.dataset.diffSide;
    if (side) void loadFile(side, file);
    else notify('diff.dropSide');
  },
  onActive: active => { $('file-drop-overlay').hidden = !active; }, onError: () => notify('common.oneFile')
});
$('compare').addEventListener('click', compare);
$('cancel').addEventListener('click', () => {
  pendingDocuments = undefined;
  for (const side of ['left', 'right']) { versions[side] += 1; reading[side] = false; }
  controller.cancel();
  render({ status: merge ? 'dirty' : 'idle' });
  notify('diff.cancelled');
});
$('clear').addEventListener('click', () => {
  for (const side of ['left', 'right']) { versions[side] += 1; reading[side] = false; fileFailures[side] = undefined; setSource(side, ''); filenames[side] = ''; }
  fileLabels();
  invalidate();
  $('inputs').open = true;
});
$('swap').addEventListener('click', () => {
  syncEditors();
  for (const side of ['left', 'right']) { versions[side] += 1; reading[side] = false; fileFailures[side] = undefined; }
  const left = inputViews.left.state.doc, right = inputViews.right.state.doc;
  setSource('left', right); setSource('right', left);
  [filenames.left, filenames.right] = [filenames.right, filenames.left];
  fileLabels();
  invalidate();
  if (mode() === 'text') compare();
  else compareIfReady();
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
function locateError(issue) {
  if (!merge) $('inputs').open = true;
  const view = merge ? issue.side === 'left' ? merge.a : merge.b : inputViews[issue.side];
  const anchor = Math.min(issue.position, view.state.doc.length);
  view.dispatch({ selection: { anchor, head:Math.min(anchor + (issue.length || 0), view.state.doc.length) }, effects: EditorView.scrollIntoView(anchor, { y: 'center', x:'center' }) });
  view.focus();
}
$('inputs').addEventListener('toggle', () => { if ($('inputs').open) syncEditors(); });
$('diff-mode').addEventListener('change', () => {
  syncEditors();
  invalidate();
  refreshModeLabels();
  compare();
});
document.addEventListener('keydown', event => {
  if (event.target.closest?.('.tool-menu')) return;
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
    event.preventDefault();
    event.stopPropagation();
    compare();
  }
}, true);
window.addEventListener('pagehide', () => controller.cancel());

function localeExtensions(side) {
  const phrases = { '$ unchanged lines':t('diff.unchanged'), 'unchanged lines':t('diff.unchangedLabel'), 'Find':t('common.search'), 'Replace':t('common.replace'), 'replace':t('common.replace'), 'replace all':t('common.replaceAll'), 'match case':t('common.matchCase'), 'regexp':t('common.regularExpression'), 'by word':t('common.wholeWord'), 'next':t('common.next'), 'previous':t('common.previous'), 'all':t('common.selectAll'), 'close':t('common.close'), 'by':t('common.replace') };
  return [EditorState.phrases.of(phrases), EditorView.contentAttributes.of({ 'aria-label':t(side === 'left' ? 'diff.original' : 'diff.new', { name:contentName() }), tabindex:'0', dir:'ltr' })];
}
function refreshModeLabels() {
  const text = mode() === 'text';
  $('mode-description').textContent = t(text ? 'diff.textDescription' : 'diff.jsonDescription');
  $('input-help').textContent = t('diff.inputHelp');
  $('count-rule').textContent = t(text ? 'diff.textRule' : 'diff.jsonRule');
  for (const side of ['left','right']) {
    const label = t(side === 'left' ? 'diff.original' : 'diff.new', { name:contentName() });
    $(`${side}-title`).textContent = label;
    $(`${side}-result-title`).textContent = label;
    $(`${side}-source-label`).textContent = label;
    inputViews[side].dispatch({ effects:inputLocales[side].reconfigure(inputLocale(side)) });
    sources[side].closest('[data-diff-side]').setAttribute('aria-label', label);
    $(`${side}-file-input`).accept = text ? '.txt,.log,.md,.csv,.json,text/*,application/json' : '.json,.txt,application/json,text/plain';
  }
}
function changeLabels(change) {
  const style = { CREATE:'added', REMOVE:'removed', CHANGE:'modified' }[change.kind];
  $('change-kind').textContent = t('diff.'+style);
  $('change-kind').className = style;
  $('change-path').textContent = change.lines ? t('diff.lines', change.lines) : change.pointer || t('diff.root');
  $('change-path').title = $('change-path').textContent;
}
function errorLabels(state) {
  $('diff-total').textContent = diagnostics.show(state);
}
function statusLabels(state) {
  const pending = state.status === 'pending';
  $('diff-total').textContent = t(state.status === 'dirty' ? 'diff.dirty' : pending ? state.reading ? 'diff.reading' : 'diff.comparing' : 'diff.waiting');
  $('diff-placeholder-title').textContent = t(pending ? state.reading ? 'diff.readingTitle' : 'diff.comparingTitle' : 'diff.empty', { name:contentName() });
  $('diff-placeholder-description').textContent = t(pending ? 'diff.pendingHint' : 'diff.legend');
}
onLanguageChange(() => {
  refreshModeLabels(); fileLabels(); diagnostics.refresh();
  $('compare').textContent = t(merge ? 'diff.recompare' : 'diff.compare');
  if (lastState.status === 'ready') {
    $('diff-total').textContent = total ? t('diff.total', { count:total }) : t('diff.equal');
    $('diff-duration').textContent = t('diff.duration', { duration:lastState.elapsedMs ?? lastState.durationMs });
    for (const name of ['added','removed','modified']) $(`count-${name}`).textContent = lastState.counts[name].toLocaleString(language());
  } else if (lastState.status === 'error') errorLabels(lastState);
  else statusLabels(lastState);
  if (currentChange) changeLabels(currentChange);
  else $('change-path').textContent = t(mode() === 'json' ? 'diff.pathHint' : 'diff.lineHint');
  if (merge) for (const side of ['left','right']) {
    const view = side === 'left' ? merge.a : merge.b;
    const open = searchPanelOpen(view.state);
    const query = getSearchQuery(view.state);
    const active = document.activeElement;
    const { scrollTop, scrollLeft } = view.scrollDOM;
    if (open) closeSearchPanel(view);
    view.dispatch({ effects:localeCompartments[side].reconfigure(localeExtensions(side)) });
    if (open) {
      openSearchPanel(view);
      view.dispatch({ effects:setSearchQuery.of(query) });
      active?.focus({ preventScroll:true });
      view.scrollDOM.scrollTop = scrollTop; view.scrollDOM.scrollLeft = scrollLeft;
    }
  }
  navigation();
});
refreshModeLabels(); fileLabels(); statusLabels(lastState); diagnostics.clear();
