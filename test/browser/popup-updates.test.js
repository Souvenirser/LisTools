import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir, mkdtemp, readFile, realpath, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {chromium, expect} from '@playwright/test';
import {unzipSync} from 'fflate';
import {githubReleaseEndpoint} from '../../src/tools/updates/releases.js';

const {version: installed} = JSON.parse(await readFile('package.json', 'utf8'));
const newer = `${Number(installed.split('.')[0]) + 1}.0.0`;
const releasePage = `https://github.com/Souvenirser/LisTools/releases/tag/v${newer}`;
const release = version => ({
  tag_name: `v${version}`, draft: false, prerelease: false,
  assets: [{name: `LisTools-${version}.zip`, state: 'uploaded'}]
});

async function withExtension(store, run) {
  const archive = resolve('releases', `LisTools-${store ? 'Chrome-Store-' : ''}${installed}.zip`);
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'listools-popup-update-')));
  const extension = join(directory, 'extension');
  const profile = join(directory, 'profile');
  const id = createHash('sha256').update(extension).digest('hex').slice(0, 32)
    .replace(/[0-9a-f]/g, character => String.fromCharCode(97 + parseInt(character, 16)));
  const base = `chrome-extension://${id}`;
  const contexts = [];
  try {
    const files = unzipSync(await readFile(archive));
    for (const [name, content] of Object.entries(files)) {
      const file = join(extension, name);
      await mkdir(dirname(file), {recursive: true});
      await writeFile(file, content);
    }
    const manifestFile = join(extension, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
    assert.equal(manifest.permissions, undefined);
    assert.equal(manifest.host_permissions, undefined);
    assert.equal(Boolean(manifest.background), store);

    async function launch() {
      const context = await chromium.launchPersistentContext(profile, {
        channel: 'chromium', headless: true, viewport: {width: 360, height: 560},
        executablePath: process.env.LISTOOLS_EXTENSION_CHROME,
        ignoreDefaultArgs: ['--disable-extensions'],
        args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
      });
      contexts.push(context);
      return context;
    }
    await run({launch, base, id, manifest, manifestFile});
  } finally {
    await Promise.all(contexts.map(context => context.close()));
    await rm(directory, {recursive: true, force: true});
  }
}

const cache = page => page.evaluate(() => JSON.parse(localStorage.getItem('listools-release-check-v1')));
const update = page => page.locator('.tool-menu-update');
const current = page => page.locator('#app-version');
const search = page => page.locator('#tool-menu-search');
const checkUpdates = page => page.locator('.tool-menu-check-updates');
const updateStatus = page => page.locator('.tool-menu-update-status');

async function geometry(page) {
  return page.evaluate(() => {
    const shape = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
    return {
      footer: shape('.tool-menu-footer'), hint: shape('.tool-menu-hint'),
      feedback: shape('.feedback-link'), list: shape('.tool-menu-scroll'),
      scroll: document.querySelector('.tool-menu-scroll').scrollTop
    };
  });
}

test('the unpacked ZIP checks GitHub, keeps the popup stable, and opens the exact release', {timeout: 60_000}, async () => {
  await withExtension(false, async ({launch, base, manifest, manifestFile}) => {
    const context = await launch();
    const [page] = context.pages();
    const requests = [];
    const response = Promise.withResolvers();
    await context.route(githubReleaseEndpoint, async route => {
      requests.push(route.request());
      await response.promise;
      await route.fulfill({json: {...release(newer), html_url: 'https://example.invalid/override'},
        headers: {'access-control-allow-origin': '*'}});
    });
    await context.route(releasePage, route => route.fulfill({body: 'LisTools release'}));
    await page.addInitScript(() => {
      localStorage.setItem('listools-language', 'zh-Hans');
      localStorage.setItem('listools-preferences-v1', JSON.stringify({theme: 'dark'}));
      localStorage.setItem('listools-menu-expanded-v1', JSON.stringify(['daily', 'files', 'developer', 'network']));
    });
    await page.goto(`${base}/popup.html`);
    await expect(current(page)).toHaveText(`v${installed}`);
    await expect(checkUpdates(page)).toHaveText('检查更新');
    assert.equal(await page.evaluate(async () => (await chrome.management.getSelf()).installType), 'development');
    await search(page).focus();
    await expect(update(page)).toBeHidden();
    await expect.poll(() => requests.length).toBe(1);
    await page.locator('.tool-menu-scroll').evaluate(list => { list.scrollTop = 100; });
    const before = await geometry(page);
    assert.ok(before.scroll > 0);
    response.resolve();
    await expect(updateStatus(page)).toHaveText(`发现新版 v${newer}`);
    await expect(update(page)).toHaveText('查看发布页');
    await expect(update(page)).toBeVisible();
    await expect(current(page)).toBeVisible();
    await expect(search(page)).toBeFocused();
    assert.deepEqual(await geometry(page), before);
    assert.equal(requests[0].method(), 'GET');
    assert.equal(requests[0].postData(), null);
    const headers = await requests[0].allHeaders();
    for (const name of ['referer', 'authorization', 'cookie']) assert.equal(headers[name], undefined);

    await update(page).focus();
    const opening = context.waitForEvent('page');
    await update(page).press('Enter');
    const target = await opening;
    await target.waitForURL(releasePage);
    await target.close();

    await page.evaluate(() => chrome.action.openPopup());
    const nativeStatus = () => page.evaluate(async () => {
      const contexts = await chrome.runtime.getContexts({contextTypes: ['POPUP']});
      const popup = chrome.extension.getViews({type: 'popup'})[0];
      const result = popup?.document.querySelector('.tool-menu-update-status');
      return contexts.some(item => item.tabId === -1) ? result?.textContent : '';
    });
    await expect.poll(nativeStatus).toBe(`发现新版 v${newer}`);
    await page.evaluate(() => chrome.extension.getViews({type: 'popup'})[0].close());

    for (const [locale, theme, label] of [
      ['en', 'light', 'New version'], ['de', 'dark', 'New version'], ['ar', 'light', 'إصدار جديد']
    ]) {
      const popup = await context.newPage();
      await popup.setViewportSize({width: 300, height: 560});
      await popup.addInitScript(({locale, theme}) => {
        localStorage.setItem('listools-language', locale);
        localStorage.setItem('listools-preferences-v1', JSON.stringify({theme}));
      }, {locale, theme});
      await popup.goto(`${base}/popup.html`);
      await expect(updateStatus(popup)).toHaveText(`${label} v${newer}`);
      await expect(checkUpdates(popup)).toBeInViewport();
      await expect(update(popup)).toBeInViewport();
      await expect(current(popup)).toBeInViewport();
      await expect(popup.locator('.feedback-link')).toBeInViewport();
      assert.equal(await popup.evaluate(() => document.documentElement.scrollWidth), 300);
      await popup.close();
    }
    assert.equal(requests.length, 1, 'reopening the popup uses the cache');

    // Chromium's network emulation does not change navigator.onLine on this extension page.
    await page.addInitScript(() => Object.defineProperty(navigator, 'onLine', {value: false}));
    await page.reload();
    assert.equal(await page.evaluate(() => navigator.onLine), false);
    await expect(current(page)).toBeVisible();
    await expect(update(page)).toBeHidden();
    await checkUpdates(page).click();
    await expect(updateStatus(page)).toHaveText('检查更新失败');
    assert.equal(requests.length, 1, 'known offline state leaves the network idle');
    await context.close();

    await writeFile(manifestFile, JSON.stringify({...manifest, version: newer}));
    const upgraded = await launch();
    const afterUpgrade = upgraded.pages()[0];
    await upgraded.route(githubReleaseEndpoint, route => route.fulfill({json: release(newer), headers: {
      'access-control-allow-origin': '*'
    }}));
    await afterUpgrade.goto(`${base}/popup.html`);
    await expect(current(afterUpgrade)).toHaveText(`v${newer}`);
    await expect(current(afterUpgrade)).toBeVisible();
    await expect(updateStatus(afterUpgrade)).toHaveText('已是最新版');
    await expect(update(afterUpgrade)).toBeHidden();
  });
});

test('same version, prereleases, missing assets and a rate limit keep the installed version', {timeout: 60_000}, async () => {
  await withExtension(false, async ({launch, base}) => {
    const context = await launch();
    let answer;
    let checks = 0;
    await context.route(githubReleaseEndpoint, async route => {
      checks++;
      if (answer.offline) return route.abort('internetdisconnected');
      await route.fulfill({...answer, headers: {'access-control-allow-origin': '*',
        'access-control-expose-headers': 'X-RateLimit-Remaining, X-RateLimit-Reset', ...answer.headers}});
    });
    const page = context.pages()[0];
    await page.addInitScript(() => localStorage.setItem('listools-language', 'en'));
    const reset = Math.ceil(Date.now() / 1000) + 4 * 3600;
    for (const [outcome, message] of [
      [{json: release(installed)}, 'Up to date'],
      [{json: {...release(newer), prerelease: true}}, 'Update check failed'],
      [{json: {...release(newer), assets: []}}, 'Update check failed'],
      [{offline: true}, 'Update check failed'],
      [{status: 403, body: '', headers: {'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset': String(reset)}},
        'Rate limited. Try again later.']
    ]) {
      answer = outcome;
      const next = checks + 1;
      await page.goto(`${base}/popup.html`);
      await expect.poll(() => checks).toBe(next);
      await expect(updateStatus(page)).toHaveText(message);
      await expect.poll(async () => ((await cache(page))?.nextCheckAt ?? 0) - Date.now()).toBeGreaterThan(60_000);
      await expect(current(page)).toBeVisible();
      await expect(update(page)).toBeHidden();
      if (!outcome.status) await page.evaluate(() => localStorage.removeItem('listools-release-check-v1'));
    }
    assert.equal((await cache(page)).nextCheckAt, reset * 1000);
    await page.reload();
    await expect(current(page)).toBeVisible();
    await expect(updateStatus(page)).toHaveText('Rate limited. Try again later.');
    assert.equal(checks, 5);
  });
});

test('the Store ZIP only uses Chrome update state and the notice survives closing the popup', {timeout: 60_000}, async () => {
  await withExtension(true, async ({launch, base, id}) => {
    const context = await launch();
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    assert.ok(await worker.evaluate(() => chrome.runtime.onUpdateAvailable.hasListeners()));
    const [page] = context.pages();
    let checks = 0;
    await context.route(githubReleaseEndpoint, route => { checks++; return route.abort(); });
    await page.addInitScript(() => localStorage.setItem('listools-language', 'en'));
    await page.goto(`${base}/popup.html`);
    await expect(current(page)).toBeVisible();
    await expect(update(page)).toBeHidden();
    assert.equal(await page.evaluate(async url => {
      try { await fetch(url); return 'allowed'; } catch { return 'blocked'; }
    }, githubReleaseEndpoint), 'blocked');
    await page.evaluate(async version => {
      const {writePendingStoreUpdate, storeUpdateChannel} = await import(chrome.runtime.getURL('updates/store-state.js'));
      const status = {installed: chrome.runtime.getManifest().version, version};
      await writePendingStoreUpdate(status);
      const channel = new BroadcastChannel(storeUpdateChannel);
      channel.postMessage(status);
      channel.close();
    }, newer);
    await expect(update(page)).toBeVisible();
    const reopened = await context.newPage();
    await page.close();
    await reopened.goto(`${base}/popup.html`);
    await expect(updateStatus(reopened)).toHaveText(`New version v${newer}`);
    await expect(update(reopened)).toHaveText('Manage extension');
    await expect(current(reopened)).toBeVisible();
    const manager = context.waitForEvent('page');
    await update(reopened).click();
    const target = await manager;
    await target.waitForURL(`chrome://extensions/?id=${id}`);
    assert.equal(await reopened.evaluate(() => chrome.runtime.getManifest().version), installed);
    assert.equal(checks, 0);
    await reopened.evaluate(async version => {
      const {writePendingStoreUpdate} = await import(chrome.runtime.getURL('updates/store-state.js'));
      await writePendingStoreUpdate({installed: '0.1', version});
    }, newer);
    await reopened.reload();
    await expect(current(reopened)).toBeVisible();
    await expect(update(reopened)).toBeHidden();
  });
});

test('manual GitHub checks bypass the old cache, show failures and respect limits', {timeout: 30_000}, async () => {
  await withExtension(false, async ({launch, base}) => {
    const context = await launch();
    const [page] = context.pages();
    let reply = {json: release(installed)};
    let requests = 0;
    await context.route(githubReleaseEndpoint, route => {
      requests++;
      return route.fulfill({...reply, headers: {
        'access-control-allow-origin': '*',
        'access-control-expose-headers': 'Retry-After',
        ...reply.headers
      }});
    });
    await page.addInitScript(version => {
      localStorage.setItem('listools-language', 'zh-Hans');
      localStorage.setItem('listools-release-check-v1', JSON.stringify({
        version, nextCheckAt: Date.now() + 24 * 60 * 60 * 1000
      }));
    }, installed);
    await page.goto(`${base}/popup.html`);
    await expect(checkUpdates(page)).toHaveText('检查更新', {timeout: 2500});
    assert.equal(requests, 0);

    await checkUpdates(page).click();
    await expect(updateStatus(page)).toHaveText('已是最新版');
    await expect.poll(() => requests).toBe(1);
    await expect(checkUpdates(page)).toBeEnabled();
    const before = await geometry(page);
    reply = {json: release(newer)};
    await checkUpdates(page).click();
    await expect(updateStatus(page)).toHaveText(`发现新版 v${newer}`);
    await expect(update(page)).toBeVisible();
    await expect(current(page)).toBeVisible();
    assert.deepEqual(await geometry(page), before);

    reply = {status: 503};
    await checkUpdates(page).click();
    await expect(updateStatus(page)).toHaveText('检查更新失败');
    await expect(update(page)).toBeHidden();
    reply = {status: 429, headers: {'Retry-After': '120'}};
    await checkUpdates(page).click();
    await expect(updateStatus(page)).toContainText('限流');
    await expect(checkUpdates(page)).toBeEnabled();
    await checkUpdates(page).click();
    await expect(updateStatus(page)).toContainText('限流');
    await expect(checkUpdates(page)).toBeEnabled();
    assert.equal(requests, 4);
    await expect(current(page)).toBeVisible();
  });
});

test('manual Store checks show Chrome results without contacting GitHub', {timeout: 30_000}, async () => {
  await withExtension(true, async ({launch, base}) => {
    const context = await launch();
    const [page] = context.pages();
    let githubRequests = 0;
    await context.route(githubReleaseEndpoint, route => { githubRequests++; return route.abort(); });
    await page.addInitScript(() => {
      localStorage.setItem('listools-language', 'zh-Hans');
      window.chromeUpdateChecks = 0;
      chrome.runtime.requestUpdateCheck = async () => {
        window.chromeUpdateChecks++;
        if (window.chromeUpdateResult === 'error') throw new Error('simulated update error');
        return window.chromeUpdateResult;
      };
    });
    await page.goto(`${base}/popup.html`);
    await expect(checkUpdates(page)).toHaveText('检查更新', {timeout: 2500});
    assert.equal(await page.evaluate(() => window.chromeUpdateChecks), 0);
    for (const [result, expected] of [
      [{status: 'no_update', version: ''}, '已是最新版'],
      [{status: 'throttled', version: ''}, '检查限流，请稍后重试'],
      ['error', '检查更新失败'],
      [{status: 'update_available', version: newer}, `发现新版 v${newer}`]
    ]) {
      await page.evaluate(value => { window.chromeUpdateResult = value; }, result);
      await checkUpdates(page).click();
      await expect(updateStatus(page)).toHaveText(expected);
      await expect(current(page)).toBeVisible();
    }
    await expect(update(page)).toBeVisible();
    assert.equal(await page.evaluate(() => window.chromeUpdateChecks), 4);
    assert.equal(githubRequests, 0);
  });
});
