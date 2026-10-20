import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pageConnectPolicy} from '../src/tools/shared/policy.js';

test('扩展图标打开离线工具菜单，不需要后台或网页访问权限', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../public/manifest.json', import.meta.url)));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.name, 'LisTools - 实用工具箱');
  assert.ok(!manifest.permissions?.length && !manifest.host_permissions?.length);
  assert.ok(!manifest.content_security_policy.extension_pages.includes('unsafe-eval'));
  assert.equal(manifest.action.default_popup,'popup.html');
  assert.ok(fs.existsSync(new URL(`../${manifest.action.default_popup}`,import.meta.url)));
  assert.equal(manifest.background,undefined);
  assert.equal(pageConnectPolicy(manifest.action.default_popup),"connect-src 'none'");
});
