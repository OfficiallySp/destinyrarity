/** Resolve public site URL from the incoming request, with env fallback for local dev. */
export function getSiteUrl(event) {
  const headers = event.headers || {};
  const host = (headers['x-forwarded-host'] || headers.host || headers.Host || '')
    .split(',')[0]
    .trim();
  let proto = headers['x-forwarded-proto'];
  if (!proto && host) {
    proto = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';
  }
  if (proto && host) {
    return `${proto}://${host}`.replace(/\/$/, '');
  }
  if (process.env.SITE_URL) {
    return process.env.SITE_URL.replace(/\/$/, '');
  }
  return 'http://localhost:8888';
}
