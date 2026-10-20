const $ = id => document.getElementById(id);
let frame, source;

function data() {
  if (source) return source;
  const value = { rows:Array.from({ length:100000 }, (_, id) => ({ id, text:'x'.repeat(480), active:true })), last:'DIFF_LARGE_END' };
  const left = JSON.stringify(value);
  value.rows[0].active = false;
  value.rows[50000].text = 'CHANGED_MIDDLE';
  value.rows[99999].id = -1;
  return source = [left, JSON.stringify(value)];
}

function waitReady(doc) {
  return new Promise((resolve, reject) => {
    const end = performance.now() + 10000;
    function check() {
      if (doc.querySelectorAll('.validation-badge').length === 4) return resolve();
      if (performance.now() > end) return reject(Error('初始化超时'));
      requestAnimationFrame(check);
    }
    check();
  });
}

async function fresh() {
  frame?.remove();
  frame = document.createElement('iframe');
  frame.title = 'LisTools 生产页面';
  const loaded = new Promise(resolve => frame.addEventListener('load', resolve, { once:true }));
  frame.src = './diff.html';
  $('app').append(frame);
  await loaded;
  await waitReady(frame.contentDocument);
  return frame.contentDocument;
}

function result(doc) {
  return new Promise((resolve, reject) => {
    const node = doc.getElementById('diff-duration');
    const timer = setTimeout(() => { observer.disconnect(); reject(Error('对比超过 15 秒')); }, 15000);
    const observer = new MutationObserver(() => {
      if (!node.dataset.totalMs) return;
      clearTimeout(timer);
      observer.disconnect();
      if (doc.getElementById('diff-length').textContent !== '3') return reject(Error('差异数量不正确'));
      resolve(Object.fromEntries(Object.entries(node.dataset).map(([key, value]) => [key, Number(value)])));
    });
    observer.observe(node, { attributes:true, attributeFilter:['data-total-ms'] });
  });
}

async function compare(doc, files) {
  const values = data(), win = frame.contentWindow, done = result(doc);
  if (files || !doc.querySelector('.cm-mergeView')) {
    for (const [i, side] of ['left', 'right'].entries()) {
      const input = doc.getElementById(side + '-file-input'), transfer = new win.DataTransfer();
      transfer.items.add(new win.File([values[i]], side + '.json', { type:'application/json' }));
      input.files = transfer.files;
      input.dispatchEvent(new win.Event('change', { bubbles:true }));
    }
  } else doc.getElementById('compare').click();
  return await done;
}

async function run(kind, count) {
  for (const button of document.querySelectorAll('button')) button.disabled = true;
  const samples = [];
  $('samples').textContent = '';
  try {
    data();
    if (kind === 'warm' && !frame?.contentDocument.querySelector('.cm-mergeView')) await compare(await fresh(), false);
    for (let i = 0; i < count; i++) {
      const doc = kind === 'warm' ? frame.contentDocument : await fresh();
      samples.push(await compare(doc, kind === 'files'));
      $('summary').textContent = `${kind} ${i + 1} / ${count}`;
      $('samples').textContent = JSON.stringify(samples);
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    const sorted = samples.map(x => x.totalMs).sort((a, b) => a - b), p95 = sorted[Math.ceil(sorted.length * .95) - 1];
    $('summary').textContent = `${kind} 完成：中位数 ${sorted[Math.floor(sorted.length / 2)]} ms，P95 ${p95} ms，最大 ${sorted.at(-1)} ms`;
    $('summary').dataset.done = kind;
    $('summary').dataset.p95 = p95;
  } catch (error) {
    $('summary').textContent = '验收失败：' + error.message;
  } finally {
    for (const button of document.querySelectorAll('button')) button.disabled = false;
  }
}

$('cold').onclick = () => run('cold', 20);
$('warm').onclick = () => run('warm', 20);
$('files').onclick = () => run('files', 5);
