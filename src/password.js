import { addTaskGuide } from './tools/shared/task-guide.js';
import {registerContentCheck} from './tools/shared/content-state.js';
import { mountTool, copyText, downloadText, localize } from './tools/shared/page.js';
import { textLabel as tr } from './tools/shared/labels.js';
import { t, translateDOM, onLanguageChange } from './i18n.js';
import { parseWordlist } from './tools/password/core.js';
import { createPasswordController } from './tools/password/controller.js';
import wordlistText from './tools/password/data/eff_large_wordlist.txt?raw';
import './tools/password/style.css';

const root = document.getElementById('tool-root');
root.innerHTML = `
  <div class="page-heading"><div><h1 data-i18n="uiText.s100a0613"></h1><p class="page-subtitle" data-i18n="uiText.s20bd3702"></p></div></div>
  <section class="tool-card" aria-labelledby="password-settings-heading">
    <h2 id="password-settings-heading" data-i18n="uiText.sd5b958f5"></h2>
    <div class="tool-fields">
      <div class="field"><label for="password-mode" data-i18n="uiText.s534e7732"></label><select id="password-mode"><option value="characters" data-i18n="uiText.s4b8a1772"></option><option value="passphrase" data-i18n="uiText.s2d79f6fa"></option></select></div>
      <div class="field"><label for="password-batch" data-i18n="uiText.s6e755606"></label><input id="password-batch" type="number" min="1" max="100" step="1" value="1" autocomplete="off"></div>
    </div>
    <div id="password-character-options">
      <div class="tool-fields password-length"><div class="field"><label for="password-length" data-i18n="uiText.sf3f2bee5"></label><input id="password-length" type="number" min="4" max="256" step="1" value="20" autocomplete="off"></div></div>
      <fieldset id="password-classes"><legend data-i18n="uiText.s796745cc"></legend>
        <label class="check-label"><input id="password-uppercase" type="checkbox" checked><span data-i18n="uiText.s53c8a7b9"></span></label>
        <label class="check-label"><input id="password-lowercase" type="checkbox" checked><span data-i18n="uiText.s2c84f21c"></span></label>
        <label class="check-label"><input id="password-digits" type="checkbox" checked><span data-i18n="uiText.sf3d1593f"></span></label>
        <label class="check-label"><input id="password-symbols" type="checkbox" checked><span data-i18n="uiText.se9c4c6a6"></span></label>
        <p class="tool-note password-symbol-list" data-i18n="uiText.sd42ceab"></p>
        <label class="check-label"><input id="password-require-each" type="checkbox" checked><span data-i18n="uiText.s14932c20"></span></label>
      </fieldset>
      <label class="check-label"><input id="password-custom-mode" type="checkbox"><span data-i18n="uiText.s28a4b316"></span></label>
      <div class="field" id="password-custom-field" hidden><label for="password-custom" data-i18n="uiText.s7e7ddb81"></label><input id="password-custom" type="text" autocomplete="off" spellcheck="false"><p class="tool-note" data-i18n="uiText.s7150f798"></p></div>
      <label class="check-label"><input id="password-ambiguous" type="checkbox"><span data-i18n="uiText.s9c482d76"></span></label>
      <div class="field"><label for="password-exclusions" data-i18n="uiText.s6fd2b66a"></label><input id="password-exclusions" type="text" autocomplete="off" spellcheck="false"></div>
    </div>
    <div id="password-passphrase-options" hidden>
      <div class="tool-fields">
        <div class="field"><label for="password-words" data-i18n="uiText.scd201343"></label><input id="password-words" type="number" min="4" max="12" step="1" value="6" autocomplete="off"></div>
        <div class="field"><label for="password-separator" data-i18n="uiText.s38d8725c"></label><select id="password-separator"><option value=" " data-i18n="uiText.sc1c43225"></option><option value="-" data-i18n="uiText.sf6649da"></option><option value="_" data-i18n="uiText.s6d18c4c8"></option></select></div>
      </div>
      <p class="tool-note" data-i18n="uiText.s62ada1af"></p>
      <p class="tool-note"><a href="https://www.eff.org/dice" target="_blank" rel="noopener noreferrer">EFF Large Wordlist · Joseph Bonneau</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a></p>
    </div>
    <div class="tool-actions"><button id="password-generate" class="primary" type="button" data-i18n="uiText.sc75562b2"></button><button id="password-clear" class="btn" type="button" data-i18n="uiText.sc6c3aeb4"></button></div>
    <p class="tool-note" data-i18n="uiText.s19345554"></p>
  </section>
  <section class="tool-card" aria-labelledby="password-results-heading">
    <h2 id="password-results-heading" data-i18n="uiText.sd30066d4"></h2>
    <div id="password-error" class="tool-error" role="alert" hidden></div>
    <p id="password-status" class="tool-status" aria-live="polite"></p>
    <div class="tool-actions"><button id="password-show" class="btn" type="button" disabled></button><button id="password-copy-all" class="btn" type="button" data-i18n="uiText.s6aef5c37" disabled></button><button id="password-download" class="btn" type="button" data-i18n="uiText.s2ace7d31" disabled></button></div>
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
  $('password-status').textContent = ready ? t('uiText.safc95ee5',{p0:next.values.length}) : t('uiText.s645065e7');
  for (const id of ['password-show', 'password-copy-all', 'password-download']) $(id).disabled = !ready;
  $('password-show').textContent = next.visible ? t('uiText.s3d28ab47') : t('uiText.s1a9d827a');
  $('password-show').setAttribute('aria-pressed', String(next.visible));
  $('password-results').replaceChildren(...next.values.map((value, index) => {
    const row = document.createElement('div'); row.className = 'password-result';
    const input = document.createElement('input'); input.type = next.visible ? 'text' : 'password'; input.value = value; input.readOnly = true;
    input.autocomplete = 'off'; input.spellcheck = false; input.dir = 'ltr'; input.setAttribute('aria-label', t('uiText.scfdb1f48',{p0:index + 1}));
    const button = document.createElement('button'); button.type = 'button'; button.className = 'btn'; button.dataset.passwordCopy = String(index); button.textContent = t('uiText.s658f3664');
    button.setAttribute('aria-label', t('uiText.saad47c37',{p0:index + 1}));
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
  $('password-custom-field').hidden = !custom;if($('password-advanced'))$('password-advanced').hidden=phrase;if(document.querySelector('.password-workspace'))$('password-length').closest('.field').hidden=phrase; $('password-classes').disabled = custom;const policy=$('password-policy');if(policy)policy.hidden=phrase||custom;
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

const passwordSettings=$('password-settings-heading').closest('section'),passwordResults=$('password-results-heading').closest('section'),passwordLayout=document.createElement('div');passwordLayout.className='password-workspace';passwordSettings.before(passwordLayout);passwordLayout.append(passwordSettings,passwordResults);
const passwordAdvanced=document.createElement('details');passwordAdvanced.id='password-advanced';passwordAdvanced.innerHTML='<summary data-i18n="ux.advanced"></summary>';$('password-character-options').append(passwordAdvanced);passwordAdvanced.append($('password-custom-mode').closest('label'),$('password-custom-field'),$('password-ambiguous').closest('label'),$('password-exclusions').closest('.field'));
const passwordActions=$('password-generate').closest('.tool-actions'),passwordPrivacy=passwordSettings.querySelector(':scope>p.tool-note');passwordPrivacy.before(passwordActions,passwordAdvanced);passwordAdvanced.append(document.querySelector('.password-symbol-list'));const mainFields=$('password-batch').closest('.tool-fields');mainFields.append($('password-length').closest('.field'));
$('password-mode').closest('.field').hidden=true;
const passwordGuide=addTaskGuide('password',[{id:'characters',key:'ux.passwordMode'},{id:'passphrase',key:'ux.passphraseMode'}],{choose:mode=>{$('password-mode').value=mode;updateOptions();}});
$('password-mode').addEventListener('change',()=>passwordGuide.select($('password-mode').value));translateDOM(passwordAdvanced);

const plaintextNote=document.createElement('p');plaintextNote.id='password-plaintext';plaintextNote.className='tool-note';plaintextNote.dataset.i18n='ux.plaintextExport';plaintextNote.textContent=t('ux.plaintextExport');$('password-download').closest('.tool-actions').after(plaintextNote);

const passwordPolicy=document.createElement('p');passwordPolicy.id='password-policy';passwordPolicy.className='tool-note';passwordPolicy.dataset.i18n='refinement.passwordPolicy';$('password-generate').closest('.tool-actions').after(passwordPolicy);passwordPolicy.textContent=t('refinement.passwordPolicy');passwordPolicy.hidden=$('password-mode').value==='passphrase'||$('password-custom-mode').checked;
