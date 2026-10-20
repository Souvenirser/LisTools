export const speedConnect = 'https://speed.cloudflare.com/__down https://speed.cloudflare.com/__up';
export const extensionPolicy = `script-src 'self'; object-src 'self'; style-src 'self' 'unsafe-inline'; worker-src 'self'; connect-src ${speedConnect}`;
export function pageConnectPolicy(file) {
  return `connect-src ${file.split('/').pop()==='speedtest.html' ? speedConnect : "'none'"}`;
}
