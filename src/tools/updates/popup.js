import {onLanguageChange, t} from '../../i18n-runtime.js';
import {checkGitHubUpdate, githubReleasePage, isNewerVersion} from './releases.js';
import {readPendingStoreUpdate, storeUpdateChannel, storeWorkerPath} from './store-state.js';

const idle = {status: 'idle'};
const failed = {status: 'failed'};
const statusKeys = {
  checking: 'common.updateChecking',
  current: 'common.updateCurrent',
  available: 'common.updateFound',
  failed: 'common.updateFailed',
  limited: 'common.updateLimited'
};

export function mountPopupUpdates(footer) {
  const api = globalThis.chrome;
  if (location.protocol !== 'chrome-extension:' || !api?.runtime?.id) return;

  const manifest = api.runtime.getManifest();
  const installed = manifest.version;
  const version = footer.querySelector('#app-version');
  const label = version.parentElement;
  version.textContent = `v${installed}`;

  const slot = document.createElement('span');
  slot.className = 'tool-menu-version';
  label.replaceWith(slot);

  const check = document.createElement('button');
  check.type = 'button';
  check.className = 'tool-menu-check-updates';
  check.setAttribute('aria-controls', 'popup-update-result');
  slot.append(label, check);

  const resultRow = document.createElement('div');
  resultRow.id = 'popup-update-result';
  resultRow.className = 'tool-menu-update-result';
  const status = document.createElement('span');
  status.className = 'tool-menu-update-status';
  status.setAttribute('role', 'status');
  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'tool-menu-update';
  resultRow.append(status, open);
  footer.append(resultRow);

  const store = manifest.background?.service_worker === storeWorkerPath;
  let result = idle;
  let checking = false;
  let manualStarted = false;
  let pendingStoreVersion;

  function render() {
    const state = checking ? 'checking' : result.status;
    check.textContent = t('common.checkUpdates');
    check.setAttribute('aria-disabled', String(checking));
    resultRow.dataset.status = state;
    status.textContent = statusKeys[state] ? t(statusKeys[state], {version: `v${result.version}`}) : '';
    open.hidden = state !== 'available';
    open.textContent = t(store ? 'common.updateOpenManager' : 'common.updateOpenRelease');
  }
  function show(next) {
    result = next;
    render();
  }

  function receiveStoreUpdate(update) {
    if (update?.installed !== installed || !isNewerVersion(update.version, pendingStoreVersion ?? installed)) return;
    pendingStoreVersion = update.version;
    if (!checking) show({status: 'available', version: pendingStoreVersion});
  }
  async function checkStore() {
    if (!navigator.onLine) return failed;
    const {status, version} = await api.runtime.requestUpdateCheck();
    if (status === 'throttled') return {status: 'limited'};
    if (status === 'update_available') receiveStoreUpdate({installed, version});
    if (status === 'update_available' || status === 'no_update') {
      if (pendingStoreVersion) return {status: 'available', version: pendingStoreVersion};
      if (status === 'no_update') return {status: 'current'};
    }
    return failed;
  }
  async function checkGitHub(manual) {
    const unavailable = manual ? failed : idle;
    if (!navigator.onLine) return unavailable;
    const info = await api.management.getSelf();
    if (info.installType !== 'development') return unavailable;
    const next = await navigator.locks.request('listools-release-check', () => checkGitHubUpdate(installed, {manual}));
    return navigator.onLine ? next : unavailable;
  }

  render();
  onLanguageChange(render);
  check.addEventListener('click', async () => {
    if (checking) return;
    manualStarted = checking = true;
    render();
    let next;
    try { next = await (store ? checkStore() : checkGitHub(true)); }
    catch { next = failed; }
    checking = false;
    show(next);
  });
  open.addEventListener('click', () => {
    if (result.status !== 'available') return;
    const url = store ? `chrome://extensions/?id=${api.runtime.id}` : githubReleasePage(result.version);
    void api.tabs.create({url}).catch(() => {});
  });

  if (store) {
    const channel = new BroadcastChannel(storeUpdateChannel);
    channel.addEventListener('message', ({data}) => receiveStoreUpdate(data));
    void readPendingStoreUpdate().then(receiveStoreUpdate).catch(() => {});
    window.addEventListener('pagehide', () => channel.close(), {once: true});
  } else {
    window.addEventListener('offline', () => { if (!manualStarted) show(idle); });
    void checkGitHub(false).catch(() => failed).then(next => { if (!manualStarted) show(next); });
  }
}
