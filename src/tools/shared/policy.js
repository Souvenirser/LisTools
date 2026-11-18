import {githubReleaseEndpoint} from '../updates/releases.js';

export const speedConnect = 'https://speed.cloudflare.com/__down https://speed.cloudflare.com/__up';
export const storeExtensionPolicy = `script-src 'self'; object-src 'self'; style-src 'self' 'unsafe-inline'; worker-src 'self'; connect-src ${speedConnect}`;
export const extensionPolicy = `${storeExtensionPolicy} ${githubReleaseEndpoint}`;
export function pageConnectPolicy(file) {
  const name = file.split('/').pop();
  if (name === 'speedtest.html') return `connect-src ${speedConnect}`;
  if (name === 'popup.html') return `connect-src ${githubReleaseEndpoint}`;
  return "connect-src 'none'";
}
