import {registerContentCheck} from './tools/shared/content-state.js';
import { version } from '../package.json';
import { timestampToTime, timeToTimestamp, getDeviceTimeZone } from './tools/timestamp/core.js';
import { t, language, onLanguageChange, errorText, createNotifier } from './i18n.js';
import { mountTimeZoneSelector } from './timezone-selector.js';
import './style.css';
import './timestamp-style.css';

const $ = id => document.getElementById(id);
$('app-version').textContent = `v${version}`;
const notify = createNotifier();
let clockTimer, device, clockResult;
const results = {};
const timeZones = new Set(['UTC', ...Intl.supportedValuesOf('timeZone')]);
const zonePicker = mountTimeZoneSelector($('time-zone'),{t,language});
function deviceLabel() {
  $('device-time-zone').textContent = device.fallback ? t('timestamp.fallback') : t('timestamp.device', { zone:device.timeZone });
}
function useDeviceTimeZone() {
  device = getDeviceTimeZone();
  timeZones.add(device.timeZone);
  zonePicker.setZones(timeZones,device.timeZone);
  deviceLabel();
}
function fillResults(panel, result) {
  const ready = result.status === 'ready';
  for (const field of panel.querySelectorAll('[data-field]')) {field.value = ready ? result[field.dataset.field] : '';fitResult(field);}
  for (const button of panel.querySelectorAll('[data-copy], [data-copy-all]')) button.disabled = !ready;
  panel.dataset.status = result.status;
  const values=panel.querySelector('.conversion-results');if(values)values.hidden=!ready;
  for(const field of panel.querySelectorAll('[data-field]'))fitResult(field);
}
function labels(prefix, result) {
  const ready = result.status === 'ready';
  $(`${prefix}-context`).textContent = ready ? `${result.timeZone} · UTC${result.offset}` : t('common.result');
  const message = $(`${prefix}-message`);
  message.classList.toggle('is-error', result.status === 'error');
  $(`${prefix}-source`).setAttribute('aria-invalid', String(result.status === 'error'));
  if (result.status === 'error') message.textContent = errorText(result);
  else if (!ready) message.textContent = t(prefix === 'timestamp' ? 'timestamp.stampHelp' : 'timestamp.dateHelp');
  else if (prefix === 'timestamp') message.textContent = t('timestamp.parsedUnit', { unit:t(result.unit === 'seconds' ? 'timestamp.secondUnit' : 'timestamp.millisecondUnit') });
  else message.textContent = result.hasOffset ? t('timestamp.parsedOffset') : t('timestamp.parsedZone', { zone:result.timeZone });
}
function convert(prefix) {
  const zone = $('time-zone').value;
  const value = $(`${prefix}-source`).value;
  const result = results[prefix] = prefix === 'timestamp' ? timestampToTime(value, $('timestamp-unit').value, zone) : timeToTimestamp(value, zone);
  fillResults($(`${prefix}-panel`), result);
  labels(prefix, result);
}
function renderClock() {
  clockResult = timestampToTime(String(Date.now()), 'milliseconds', $('time-zone').value);
  fillResults(document.querySelector('.clock-panel'), clockResult);
  $('clock-summary').textContent = clockResult.status === 'ready' ? clockResult.localTime.slice(0,19) : '';
  $('clock-context').textContent = clockResult.status === 'ready' ? `${clockResult.timeZone} · UTC${clockResult.offset}` : '';
  $('time-zone').setAttribute('aria-invalid', String(clockResult.status === 'error'));
  $('timezone-error').hidden = clockResult.status !== 'error';
  $('timezone-error').textContent = clockResult.status === 'error' ? errorText(clockResult) : '';
}
function updateTimeZone() { renderClock(); convert('timestamp'); convert('datetime'); }
for (const prefix of ['timestamp', 'datetime']) {
  $(`${prefix}-source`).addEventListener('input', () => convert(prefix));
  $(`${prefix}-clear`).addEventListener('click', () => {
    $(`${prefix}-source`).value = ''; convert(prefix); $(`${prefix}-source`).focus();
  });
  $(`${prefix}-now`).addEventListener('click', () => {
    const now = timestampToTime(String(Date.now()), 'milliseconds', $('time-zone').value);
    if (now.status !== 'ready') return notify(now.code || 'timestamp.range');
    if (prefix === 'timestamp') $('timestamp-unit').value = 'milliseconds';
    $(`${prefix}-source`).value = prefix === 'timestamp' ? now.milliseconds : now.isoTime;
    convert(prefix);
  });
}
$('timestamp-unit').addEventListener('change', () => convert('timestamp'));
$('time-zone').addEventListener('change', updateTimeZone);
$('restore-time-zone').addEventListener('click', () => { useDeviceTimeZone(); updateTimeZone(); });
document.addEventListener('click', async event => {
  const button = event.target.closest('[data-copy], [data-copy-all]');
  if (!button || button.disabled) return;
  const source = button.dataset.copy ? $(button.dataset.copy) : undefined;
  const prefix = button.dataset.copyAll;
  const text = source ? source.value : [
    `${t('timestamp.zone')}: ${$(`${prefix}-context`).textContent}`,
    ...[...$(`${prefix}-panel`).querySelectorAll('[data-field]')].map(field => `${t(field.dataset.labelKey)}: ${field.value}`)
  ].join('\n');
  try { await navigator.clipboard.writeText(text); notify(source ? 'common.copied' : 'common.copiedAll'); }
  catch {
    if (source) { source.focus(); source.select(); }
    notify('common.copyFailed');
  }
});
onLanguageChange(() => {
  zonePicker.refresh();
  deviceLabel();
  for (const prefix of ['timestamp','datetime']) labels(prefix, results[prefix]);
  if (clockResult?.status === 'error') $('timezone-error').textContent = errorText(clockResult);
});
useDeviceTimeZone(); updateTimeZone();
function startClock() { clearInterval(clockTimer); renderClock(); clockTimer = setInterval(renderClock, 1000); }
startClock();
window.addEventListener('pageshow', startClock);
window.addEventListener('pagehide', () => clearInterval(clockTimer));

registerContentCheck(()=>Boolean($('timestamp-source').value||$('datetime-source').value));

function fitResult(field){if(!field.checkVisibility())return;field.style.height='auto';field.style.height=`${Math.max(44,field.scrollHeight+2)}px`;}
function fitResults(){document.querySelectorAll('[data-field]').forEach(fitResult);}
for(const details of document.querySelectorAll('details'))details.addEventListener('toggle',fitResults);
addEventListener('resize',fitResults);
onLanguageChange(fitResults);
