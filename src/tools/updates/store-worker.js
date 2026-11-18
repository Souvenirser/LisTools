import {storeUpdateChannel, writePendingStoreUpdate} from './store-state.js';

chrome.runtime.onUpdateAvailable.addListener(async ({version}) => {
  const update = {installed: chrome.runtime.getManifest().version, version};
  try {
    await writePendingStoreUpdate(update);
  } catch { /* An open popup can still show this update. */ }
  const channel = new BroadcastChannel(storeUpdateChannel);
  channel.postMessage(update);
  channel.close();
});
