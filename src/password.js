import {registerContentCheck} from './tools/shared/content-state.js';
import { mountTool, tr, copyText, downloadText, localize } from './tools/shared/page.js';
import { onLanguageChange } from './i18n.js';
import { parseWordlist } from './tools/password/core.js';
import { createPasswordController } from './tools/password/controller.js';
import wordlistText from './tools/password/data/eff_large_wordlist.txt?raw';
import './tools/password/style.css';

const root = document.getElementById('tool-root');
root.innerHTML = `
  <div class="page-heading"><div><h1 data-zh="随机密码与口令" data-en="Random passwords & passphrases"></h1><p class="page-subtitle" data-zh="手动生成，使用浏览器安全随机源，在本地完成。" data-en="Generate on demand with your browser’s secure random source, entirely locally."></p></div></div>
  <section class="tool-card" aria-labelledby="password-settings-heading">
    <h2 id="password-settings-heading" data-zh="生成选项" data-en="Generation options"></h2>
    <div class="tool-fields">
      <div class="field"><label for="password-mode" data-zh="模式" data-en="Mode"></label><select id="password-mode"><option value="characters" data-zh="随机字符密码" data-en="Random character password"></option><option value="passphrase" data-zh="随机单词口令" data-en="Random word passphrase"></option></select></div>
      <div class="field"><label for="password-batch" data-zh="生成数量（1–100）" data-en="Quantity (1–100)"></label><input id="password-batch" type="number" min="1" max="100" step="1" value="1" autocomplete="off"></div>
    </div>
    <div id="password-character-options">
      <div class="tool-fields password-length"><div class="field"><label for="password-length" data-zh="字符长度（4–256）" data-en="Character length (4–256)"></label><input id="password-length" type="number" min="4" max="256" step="1" value="20" autocomplete="off"></div></div>
      <fieldset id="password-classes"><legend data-zh="字符类别" data-en="Character classes"></legend>
        <label class="check-label"><input id="password-uppercase" type="checkbox" checked><span data-zh="大写字母 A–Z" data-en="Uppercase A–Z"></span></label>
        <label class="check-label"><input id="password-lowercase" type="checkbox" checked><span data-zh="小写字母 a–z" data-en="Lowercase a–z"></span></label>
        <label class="check-label"><input id="password-digits" type="checkbox" checked><span data-zh="数字 0–9" data-en="Digits 0–9"></span></label>
        <label class="check-label"><input id="password-symbols" type="checkbox" checked><span data-zh="符号" data-en="Symbols"></span></label>
        <p class="tool-note password-symbol-list" data-zh="可用符号：!@#$%^&*()_+-=[]{};:,.?" data-en="Available symbols: !@#$%^&*()_+-=[]{};:,.?"></p>
        <label class="check-label"><input id="password-require-each" type="checkbox" checked><span data-zh="每个所选类别至少包含一个字符" data-en="Include at least one character from each selected class"></span></label>
      </fieldset>
      <label class="check-label"><input id="password-custom-mode" type="checkbox"><span data-zh="使用自定义字符集（覆盖上述类别要求）" data-en="Use a custom alphabet (overrides the class requirements)"></span></label>
      <div class="field" id="password-custom-field" hidden><label for="password-custom" data-zh="自定义字符集" data-en="Custom alphabet"></label><input id="password-custom" type="text" autocomplete="off" spellcheck="false"><p class="tool-note" data-zh="仅允许可打印 ASCII 字符（含空格），去重和排除后至少保留两个不同字符。" data-en="Printable ASCII only (including spaces). At least two distinct characters must remain after exclusions."></p></div>
      <label class="check-label"><input id="password-ambiguous" type="checkbox"><span data-zh="排除易混字符 0 O 1 l I" data-en="Exclude ambiguous characters 0 O 1 l I"></span></label>
      <div class="field"><label for="password-exclusions" data-zh="额外排除字符" data-en="Additional excluded characters"></label><input id="password-exclusions" type="text" autocomplete="off" spellcheck="false"></div>
    </div>
    <div id="password-passphrase-options" hidden>
      <div class="tool-fields">
        <div class="field"><label for="password-words" data-zh="单词数（4–12）" data-en="Word count (4–12)"></label><input id="password-words" type="number" min="4" max="12" step="1" value="6" autocomplete="off"></div>
        <div class="field"><label for="password-separator" data-zh="分隔符" data-en="Separator"></label><select id="password-separator"><option value=" " data-zh="空格" data-en="Space"></option><option value="-" data-zh="连字符 -" data-en="Hyphen -"></option><option value="_" data-zh="下划线 _" data-en="Underscore _"></option></select></div>
      </div>
      <p class="tool-note" data-zh="从本地 EFF 7776 词表独立抽取，允许重复单词；默认六词。少数原词含连字符。" data-en="Independent draws from the local EFF 7776-word list, with repeated words allowed. Six words by default. A few original words contain hyphens."></p>
      <p class="tool-note"><a href="https://www.eff.org/dice" target="_blank" rel="noopener noreferrer">EFF Large Wordlist · Joseph Bonneau</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a></p>
    </div>
    <div class="tool-actions"><button id="password-generate" class="primary" type="button" data-zh="生成" data-en="Generate"></button><button id="password-clear" class="btn" type="button" data-zh="清空结果" data-en="Clear results"></button></div>
    <p class="tool-note" data-zh="仅点击“生成”时抽取，不自动复制；修改参数会清空旧结果。离开页面时清空当前结果，不保存历史。" data-en="Runs only when you click Generate, with no automatic copying. Parameter changes clear old results. Leaving the page clears current results; no history is saved."></p>
  </section>
  <section class="tool-card" aria-labelledby="password-results-heading">
    <h2 id="password-results-heading" data-zh="生成结果" data-en="Generated results"></h2>
    <div id="password-error" class="tool-error" role="alert" hidden></div>
    <p id="password-status" class="tool-status" aria-live="polite"></p>
    <div class="tool-actions"><button id="password-show" class="btn" type="button" disabled></button><button id="password-copy-all" class="btn" type="button" data-zh="复制全部" data-en="Copy all" disabled></button><button id="password-download" class="btn" type="button" data-zh="下载 TXT" data-en="Download TXT" disabled></button></div>
    <div id="password-results" class="password-results"></div>
  </section>`;

const $ = id => document.getElementById(id);
const errors = {
  length:['字符长度必须为 4–256 的整数。','Character length must be an integer from 4 to 256.'],
  batch:['生成数量必须为 1–100 的整数。','Quantity must be an integer from 1 to 100.'],
  classes:['请至少选择一个字符类别。','Select at least one character class.'],
  'empty-class':['排除后有已选类别不含可用字符，请调整排除条件或取消该类别。','A selected class is empty after exclusions. Adjust exclusions or deselect that class.'],
  short:['长度不足以包含每个所选类别。','Length is too short to include every selected class.'],
  alphabet:['自定义字符集仅允许可打印 ASCII，去重和排除后至少需要两个不同字符。','Use printable ASCII only, with at least two distinct characters remaining after exclusions.'],
  random:['浏览器安全随机源不可用，无法生成。','Your browser’s secure random source is unavailable.'],
  attempts:['未能在 10000 次抽取内满足条件，请调整字符类别或排除条件后重试。','Could not satisfy the constraints within 10000 draws. Adjust classes or exclusions and retry.'],
  words:['单词数必须为 4–12 的整数。','Word count must be an integer from 4 to 12.'],
  separator:['请选择空格、连字符或下划线作为分隔符。','Choose a space, hyphen, or underscore separator.'],
  wordlist:['本地词表校验失败，无法生成口令。','Local word list validation failed. Passphrase generation is unavailable.'],
  generation:['生成失败，请检查选项后重试。','Generation failed. Check the options and retry.']
};
let state = {values:[], visible:false};
function render(next) {
  state = next;
  const ready = next.values.length > 0;
  $('password-error').hidden = !next.error;
  $('password-error').textContent = next.error ? tr(...(errors[next.error] || errors.generation)) : '';
  $('password-status').textContent = ready ? tr(`已生成 ${next.values.length} 条，手动复制或下载。`, `${next.values.length} generated. Copy or download manually.`) : tr('点击“生成”后显示结果。', 'Click Generate to create results.');
  for (const id of ['password-show', 'password-copy-all', 'password-download']) $(id).disabled = !ready;
  $('password-show').textContent = next.visible ? tr('隐藏结果', 'Hide results') : tr('显示结果', 'Show results');
  $('password-show').setAttribute('aria-pressed', String(next.visible));
  $('password-results').replaceChildren(...next.values.map((value, index) => {
    const row = document.createElement('div'); row.className = 'password-result';
    const input = document.createElement('input'); input.type = next.visible ? 'text' : 'password'; input.value = value; input.readOnly = true;
    input.autocomplete = 'off'; input.spellcheck = false; input.dir = 'ltr'; input.setAttribute('aria-label', tr(`结果 ${index + 1}`, `Result ${index + 1}`));
    const button = document.createElement('button'); button.type = 'button'; button.className = 'btn'; button.dataset.passwordCopy = String(index); button.textContent = tr('复制', 'Copy');
    button.setAttribute('aria-label', tr(`复制结果 ${index + 1}`, `Copy result ${index + 1}`));
    row.append(input, button); return row;
  }));
}
let wordlist;
try { wordlist = parseWordlist(wordlistText); } catch { /* A corrupt local list fails closed during generation. */ }
const controller = createPasswordController({wordlist, onChange:render});
function options() {
  if ($('password-mode').value === 'passphrase') return {words:$('password-words').value, separator:$('password-separator').value, batch:$('password-batch').value};
  return {
    length:$('password-length').value, batch:$('password-batch').value,
    uppercase:$('password-uppercase').checked, lowercase:$('password-lowercase').checked, digits:$('password-digits').checked, symbols:$('password-symbols').checked,
    requireEach:$('password-require-each').checked, excludeAmbiguous:$('password-ambiguous').checked, exclude:$('password-exclusions').value,
    ...($('password-custom-mode').checked ? {customAlphabet:$('password-custom').value} : {})
  };
}
function updateOptions() {
  const phrase = $('password-mode').value === 'passphrase', custom = $('password-custom-mode').checked;
  $('password-character-options').hidden = phrase; $('password-passphrase-options').hidden = !phrase;
  $('password-custom-field').hidden = !custom; $('password-classes').disabled = custom;
  controller.invalidate();
}
for (const field of root.querySelectorAll('input, select')) {
  field.addEventListener('input', updateOptions);
  field.addEventListener('change', updateOptions);
}
$('password-generate').addEventListener('click', () => {
  if ($('password-mode').value === 'passphrase' && !wordlist) return render({values:[], visible:false, error:'wordlist'});
  controller.generate($('password-mode').value, options());
});
$('password-clear').addEventListener('click', () => controller.clear());
$('password-show').addEventListener('click', () => controller.toggleVisibility());
$('password-copy-all').addEventListener('click', () => { const text = controller.text(); if (text) void copyText(text); });
$('password-download').addEventListener('click', () => { const text = controller.text(); if (text) downloadText(text, 'listools-passwords.txt'); });
$('password-results').addEventListener('click', event => {
  const button = event.target.closest('[data-password-copy]');
  if (button) { const text = controller.text(Number(button.dataset.passwordCopy)); if (text) void copyText(text); }
});
window.addEventListener('pagehide', () => controller.clear());
onLanguageChange(() => { localize(root); render(state); });
mountTool('password'); render(state);

registerContentCheck(()=>state.values.length>0||Boolean($('password-custom').value));
