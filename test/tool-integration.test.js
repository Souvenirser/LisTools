import test from 'node:test';
import assert from 'node:assert/strict';
import { pages } from '../src/tools/shared/navigation.js';
import { pageConnectPolicy, extensionPolicy } from '../src/tools/shared/policy.js';
import { createConversionController } from '../src/tools/convert/controller.js';

test('all eighteen pages have unique stable entries and retain any existing shortcuts', () => {
  const entries=pages.filter(page=>!page.file.includes('#'));
  assert.equal(entries.length, 18);
  assert.equal(new Set(pages.map(page => page.id)).size, pages.length);
  assert.deepEqual(entries.slice(0,4).map(page => page.file), ['index.html','diff.html','timestamp.html','convert.html']);
});

test('network policy isolates the speed test from all offline pages', () => {
  for (const page of pages) {
    const policy = pageConnectPolicy(page.file);
    if (page.id !== 'speedtest') assert.equal(policy, "connect-src 'none'");
    else {
      assert.ok(policy.includes('https://speed.cloudflare.com/__down'));
      assert.ok(policy.includes('https://speed.cloudflare.com/__up'));
      assert.ok(!policy.includes('__results'));
    }
  }
  assert.ok(extensionPolicy.includes("script-src 'self'"));
  assert.ok(!extensionPolicy.includes('unsafe-eval'));
});

test('task timeout terminates a blocked worker and rejects late results', async () => {
  const states=[];
  const worker={postMessage(request){this.request=request;},terminate(){this.terminated=true;}};
  const controller=createConversionController({createWorker:()=>worker,onState:state=>states.push(state),timeoutMs:15});
  controller.process({input:'blocked'});
  await new Promise(resolve=>setTimeout(resolve,40));
  assert.equal(states.at(-1).code,'TaskTimeout');
  assert.ok(worker.terminated);
  worker.onmessage({data:{taskId:worker.request.taskId,status:'ready'}});
  assert.equal(states.at(-1).code,'TaskTimeout');
  controller.cancel();
});
