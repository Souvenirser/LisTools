import {onLanguageChange, t} from '../../i18n-runtime.js';
import {checkGitHubUpdate, githubReleasePage, isNewerVersion} from './releases.js';
import {readPendingStoreUpdate, storeUpdateChannel, storeWorkerPath} from './store-state.js';

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
  slot.setAttribute('aria-live', 'polite');
  label.replaceWith(slot);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'tool-menu-update';
  button.hidden = true;
  slot.append(label, button);

  const store = manifest.background?.service_worker === storeWorkerPath;
  let available;
  function render() {
    button.hidden = !available;
    label.classList.toggle('tool-menu-version-replaced', Boolean(available));
    if (available) {
      const text = t('common.updateVersion', {version: `v${available}`});
      button.textContent = text;
      button.title = text;
    }
  }
  function show(candidate) {
    available = isNewerVersion(candidate, installed) ? candidate : undefined;
    render();
  }
  onLanguageChange(render);
  button.addEventListener('click', () => {
    if (!available) return;
    const url = store ? `chrome://extensions/?id=${api.runtime.id}` : githubReleasePage(available);
    void api.tabs.create({url}).catch(() => {});
  });

  if (store) {
    const channel = new BroadcastChannel(storeUpdateChannel);
    let received = false;
    channel.addEventListener('message', ({data}) => {
      if (data?.installed !== installed) return;
      received = true;
      show(data.version);
    });
    void readPendingStoreUpdate().then(update => {
      if (!received && update?.installed === installed) show(update.version);
    }).catch(() => {});
    window.addEventListener('pagehide', () => channel.close(), {once: true});
    return;
  }

  window.addEventListener('offline', () => show());
  void (async () => {
    const info = await api.management.getSelf();
    if (info.installType !== 'development' || !navigator.onLine) return;
    const check = () => checkGitHubUpdate(installed);
    const candidate = await navigator.locks.request('listools-release-check', check);
    if (navigator.onLine) show(candidate);
  })().catch(() => {});
}
