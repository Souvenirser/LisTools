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
  assert.ok(fs.existsSync(new URL(`../pages/${manifest.action.default_popup}`,import.meta.url)));
  assert.equal(manifest.background,undefined);
  assert.equal(pageConnectPolicy(manifest.action.default_popup),"connect-src 'none'");
});

test('通用扩展清单声明 Firefox 和 Safari 的最低版本与稳定身份', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../public/manifest.json', import.meta.url)));
  assert.equal(manifest.minimum_chrome_version,'120');
  assert.equal(manifest.browser_specific_settings?.gecko?.id,'listools@souvenirser.github.io');
  assert.equal(manifest.browser_specific_settings?.gecko?.strict_min_version,'140.0');
  assert.deepEqual(manifest.browser_specific_settings?.gecko?.data_collection_permissions,{required:['none']});
  assert.equal(manifest.browser_specific_settings?.safari?.strict_min_version,'18.0');
});
