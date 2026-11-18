import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pageConnectPolicy, storeExtensionPolicy} from '../src/tools/shared/policy.js';
import {githubReleaseEndpoint} from '../src/tools/updates/releases.js';

test('通用包只允许工具栏弹窗连接指定的更新接口，无后台脚本或网页访问权限', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../public/manifest.json', import.meta.url)));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.name, 'LisTools - 实用工具箱');
  assert.ok(!manifest.permissions?.length && !manifest.host_permissions?.length);
  assert.ok(!manifest.content_security_policy.extension_pages.includes('unsafe-eval'));
  assert.equal(manifest.action.default_popup,'popup.html');
  assert.ok(fs.existsSync(new URL(`../pages/${manifest.action.default_popup}`,import.meta.url)));
  assert.equal(manifest.background,undefined);
  assert.equal(pageConnectPolicy(manifest.action.default_popup), `connect-src ${githubReleaseEndpoint}`);
  assert.equal(pageConnectPolicy('tax.html'), "connect-src 'none'");
  assert.ok(!pageConnectPolicy('speedtest.html').includes(githubReleaseEndpoint));
  assert.ok(!storeExtensionPolicy.includes(githubReleaseEndpoint));
});

test('通用扩展清单声明 Firefox 和 Safari 的最低版本与稳定身份', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../public/manifest.json', import.meta.url)));
  assert.equal(manifest.minimum_chrome_version,'120');
  assert.equal(manifest.browser_specific_settings?.gecko?.id,'listools@souvenirser.github.io');
  assert.equal(manifest.browser_specific_settings?.gecko?.strict_min_version,'140.0');
  assert.deepEqual(manifest.browser_specific_settings?.gecko?.data_collection_permissions,{required:['none']});
  assert.equal(manifest.browser_specific_settings?.safari?.strict_min_version,'18.0');
});
