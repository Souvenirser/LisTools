import { parentPort, workerData } from 'node:worker_threads';
if (workerData?.legacyBase64) {
  Uint8Array.prototype.toBase64=undefined;
  Uint8Array.fromBase64=undefined;
}
globalThis.self={postMessage:data=>parentPort.postMessage(data)};
await import('../../src/tools/convert/worker.js');
parentPort.on('message',data=>void self.onmessage({data}));
