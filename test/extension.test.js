import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('扩展图标在本地打开工作台，不需要网页访问权限', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../public/manifest.json', import.meta.url)));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.name, 'LisTools - 开发者工具箱');
  assert.ok(!manifest.permissions?.length && !manifest.host_permissions?.length);
  assert.ok(!manifest.content_security_policy.extension_pages.includes('unsafe-eval'));
  let click;
  let opened;
  vm.runInNewContext(fs.readFileSync(new URL('../public/background.js', import.meta.url), 'utf8'), {
    chrome: {
      action: { onClicked: { addListener(callback) { click = callback; } } },
      runtime: { getURL: (file) => `chrome-extension://listools-test/${file}` },
      tabs: { create(options) { opened = options.url; } }
    }
  });
  click();
  assert.equal(opened, 'chrome-extension://listools-test/index.html');
});
