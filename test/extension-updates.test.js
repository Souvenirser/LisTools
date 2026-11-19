import test from 'node:test';
import assert from 'node:assert/strict';

const releases = () => import('../src/tools/updates/releases.js');
const hour = 60 * 60 * 1000;
const stable = version => ({
  tag_name: `v${version}`,
  draft: false,
  prerelease: false,
  assets: [{name: `LisTools-${version}.zip`, state: 'uploaded'}]
});

function client(answer) {
  const values = new Map();
  const calls = [];
  let time = Date.UTC(2026, 10, 18);
  const options = {
    storage: {getItem: key => values.get(key), setItem: (key, value) => values.set(key, value)},
    now: () => time,
    fetcher: async (url, config) => {
      calls.push({url, config});
      return answer();
    }
  };
  return {options, calls, advance: milliseconds => { time += milliseconds; }};
}

test('release versions follow Chrome numeric ordering and reject invalid versions', async () => {
  const {isNewerVersion} = await releases();
  assert.ok(isNewerVersion('1.3.10', '1.3.9'));
  assert.ok(isNewerVersion('1.3.9.1', '1.3.9'));
  assert.equal(isNewerVersion('1.3.9.0', '1.3.9'), false);
  for (const bad of ['1.3.10-beta.1', '1.3.010', '1.3.65536', '0', '1.3.2.3.4', '1.3.10\n', '../1.3.10']) {
    assert.equal(isNewerVersion(bad, '1.3.9'), false, bad);
  }
});

test('the GitHub update needs a published stable release with its actual ZIP', async () => {
  const {publishedZipVersion, githubReleasePage} = await releases();
  const release = stable('1.3.10');
  assert.equal(publishedZipVersion(release), '1.3.10');
  for (const entry of [
    null, {...release, draft: true}, {...release, prerelease: true},
    {...release, tag_name: 'latest'}, {...release, tag_name: 'v1.3.10-rc1'},
    {...release, assets: []},
    {...release, assets: [{name: 'LisTools-Chrome-Store-1.3.10.zip', state: 'uploaded'}]},
    {...release, assets: [{name: 'LisTools-1.3.10.zip', state: 'new'}]}
  ]) assert.equal(publishedZipVersion(entry), null);
  assert.equal(githubReleasePage('1.3.10'), 'https://github.com/Souvenirser/LisTools/releases/tag/v1.3.10');
  assert.equal(githubReleasePage('../../other'), null);
});

test('GitHub makes a private, bounded request and reuses the successful check for 24 hours', async () => {
  const {checkGitHubUpdate, githubReleaseEndpoint} = await releases();
  const {options, calls, advance} = client(() => Response.json(stable('1.3.10')));
  assert.equal(await checkGitHubUpdate('1.3.9', options), '1.3.10');
  assert.equal(await checkGitHubUpdate('1.3.10', options), null);
  assert.equal(calls.length, 1);
  const [{url, config}] = calls;
  assert.equal(url, githubReleaseEndpoint);
  assert.equal(config.credentials, 'omit');
  assert.equal(config.referrerPolicy, 'no-referrer');
  assert.equal(config.redirect, 'error');
  assert.ok(config.signal instanceof AbortSignal);
  advance(24 * hour - 1);
  assert.equal(await checkGitHubUpdate('1.3.9', options), '1.3.10');
  assert.equal(calls.length, 1);
  advance(1);
  assert.equal(await checkGitHubUpdate('1.3.9', options), '1.3.10');
  assert.equal(calls.length, 2);
});

test('offline refresh clears stale notices and waits an hour before retrying', async () => {
  const {checkGitHubUpdate} = await releases();
  let online = true;
  const {options, calls, advance} = client(() => {
    if (!online) throw new TypeError('offline');
    return Response.json(stable('1.3.10'));
  });
  assert.equal(await checkGitHubUpdate('1.3.9', options), '1.3.10');
  advance(24 * hour);
  online = false;
  assert.equal(await checkGitHubUpdate('1.3.9', options), null);
  advance(hour - 1);
  online = true;
  assert.equal(await checkGitHubUpdate('1.3.9', options), null);
  assert.equal(calls.length, 2);
  advance(1);
  assert.equal(await checkGitHubUpdate('1.3.9', options), '1.3.10');
  assert.equal(calls.length, 3);
});

test('GitHub limit takes precedence over the local cooldown', async () => {
  const {checkGitHubUpdate} = await releases();
  const {options, calls, advance} = client(() => new Response('', {status: 429, headers: {
    'Retry-After': '7200',
    'X-RateLimit-Remaining': '0',
    'X-RateLimit-Reset': String((options.now() + 3 * hour) / 1000)
  }}));
  assert.equal(await checkGitHubUpdate('1.3.9', options), null);
  advance(3 * hour - 1);
  assert.equal(await checkGitHubUpdate('1.3.9', options), null);
  assert.equal(calls.length, 1);
  advance(1);
  await checkGitHubUpdate('1.3.9', options);
  assert.equal(calls.length, 2);
});

test('an unreadable or unwritable cache never suppresses a valid GitHub update', async () => {
 const {checkGitHubUpdate} = await releases();
 for(const failAt of [1,2]){
  const {options,calls}=client(()=>Response.json(stable('1.3.10')));
  const {setItem}=options.storage;
  let writes=0;
  options.storage.setItem=(key,value)=>{
   if(++writes===failAt)throw new DOMException('test quota','QuotaExceededError');
   setItem(key,value);
  };
  if(failAt===1)options.storage.getItem=()=>{throw new DOMException('test policy','SecurityError');};
  assert.equal(await checkGitHubUpdate('1.3.9',options),'1.3.10');
  assert.equal(await checkGitHubUpdate('1.3.9',options),'1.3.10');
  assert.equal(calls.length,1);
 }
});
