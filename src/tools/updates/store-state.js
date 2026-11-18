export const storeWorkerPath = 'updates/store-worker.js';
export const storeUpdateChannel = 'listools-store-update-v1';

function openState() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(storeUpdateChannel, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('state');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function pendingUpdate(mode, value) {
  const db = await openState();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction('state', mode);
      const state = transaction.objectStore('state');
      const request = mode === 'readonly' ? state.get('pending') : state.put(value, 'pending');
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

export const readPendingStoreUpdate = () => pendingUpdate('readonly');
export const writePendingStoreUpdate = value => pendingUpdate('readwrite', value);
