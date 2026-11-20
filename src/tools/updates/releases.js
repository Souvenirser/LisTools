const repository = 'Souvenirser/LisTools';
export const githubReleaseEndpoint = `https://api.github.com/repos/${repository}/releases/latest`;

const cacheKey = 'listools-release-check-v1';
const timeout = 3000;
const hour = 60 * 60 * 1000;
const cacheFallback = new WeakMap();
const unavailableStorage = {};

function versionParts(version) {
  if (typeof version !== 'string') return null;
  const parts = version.split('.');
  const numbers = parts.map(Number);
  if (parts.length > 4 || !numbers.some(Boolean)) return null;
  return numbers.every((number, index) =>
    Number.isInteger(number) && number >= 0 && number <= 65535 && String(number) === parts[index]
  ) ? numbers : null;
}

export function isNewerVersion(candidate, installed) {
  const next = versionParts(candidate);
  const current = versionParts(installed);
  if (!next || !current) return false;
  for (let index = 0; index < 4; index++) {
    const difference = (next[index] ?? 0) - (current[index] ?? 0);
    if (difference) return difference > 0;
  }
  return false;
}

export function publishedZipVersion(release) {
  if (release?.draft !== false || release.prerelease !== false) return null;
  const tag = release.tag_name;
  if (typeof tag !== 'string' || !tag.startsWith('v')) return null;
  const version = tag.slice(1);
  if (!versionParts(version) || !Array.isArray(release.assets)) return null;
  return release.assets.some(asset => asset?.name === `LisTools-${version}.zip` && asset.state === 'uploaded')
    ? version : null;
}

export function githubReleasePage(version) {
  return versionParts(version) ? `https://github.com/${repository}/releases/tag/v${version}` : null;
}

function retryTime(response, now) {
  const headers = response?.headers;
  const retryAfter = headers?.get('retry-after');
  const requested = /^\d+$/.test(retryAfter ?? '') ? now + Number(retryAfter) * 1000 : Date.parse(retryAfter ?? '');
  const reset = headers?.get('x-ratelimit-remaining') === '0' ? Number(headers.get('x-ratelimit-reset')) * 1000 : 0;
  const retryAt = Math.max(Number.isFinite(requested) ? requested : 0, Number.isFinite(reset) ? reset : 0);
  return retryAt > now ? retryAt : now + hour;
}

async function isRateLimited(response) {
  if (response.status === 429) return true;
  if (response.status !== 403) return false;
  if (response.headers.get('x-ratelimit-remaining') === '0' || response.headers.has('retry-after')) return true;
  const error = await response.json().catch(() => null);
  return /rate limit/i.test(error?.message ?? '');
}

function resultFor(record, installed) {
  if (record.status === 'limited') return {status: 'limited', retryAt: record.nextCheckAt};
  if (versionParts(record.version)) {
    return isNewerVersion(record.version, installed) ? {status: 'available', version: record.version} : {status: 'current'};
  }
  return {status: record.status === 'idle' ? 'idle' : 'failed'};
}

export async function checkGitHubUpdate(installed, {manual = false, storage, fetcher = globalThis.fetch, now = Date.now} = {}) {
  try { storage ??= globalThis.localStorage; } catch { /* The page can still check for updates. */ }
  const storageKey = storage ?? unavailableStorage;
  const saveCheck = record => {
    const saved = {...record, checkedAt: now()};
    cacheFallback.set(storageKey, saved);
    try { storage?.setItem(cacheKey, JSON.stringify(saved)); } catch { /* This popup can still use the result. */ }
  };
  let cached;
  try { cached = JSON.parse(storage.getItem(cacheKey)); } catch { /* An unreadable cache can be refreshed. */ }
  const fallback = cacheFallback.get(storageKey);
  if (fallback && !(cached?.checkedAt > fallback.checkedAt)) cached = fallback;
  const startedAt = now();
  if (Number.isFinite(cached?.nextCheckAt) && cached.nextCheckAt > startedAt && (!manual || cached.status === 'limited')) {
    return resultFor(cached, installed);
  }

  // A short lease covers popups closed before a response can be cached.
  saveCheck({status: 'idle', nextCheckAt: startedAt + timeout});
  let response;
  let version;
  let limited = false;
  try {
    response = await fetcher(githubReleaseEndpoint, {
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      redirect: 'error',
      cache: manual ? 'no-store' : 'default',
      signal: AbortSignal.timeout(timeout)
    });
    if (response.ok) version = publishedZipVersion(await response.json());
    else limited = await isRateLimited(response);
  } catch { /* A request or parsing error is reported as a failed check. */ }

  const checkedAt = now();
  const record = limited
    ? {status: 'limited', nextCheckAt: retryTime(response, checkedAt)}
    : {version, nextCheckAt: checkedAt + (version ? 24 : 1) * hour};
  saveCheck(record);
  return resultFor(record, installed);
}
