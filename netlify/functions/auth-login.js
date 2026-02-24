import { randomBytes } from 'crypto';

const BUNGIE_AUTH_URL = 'https://www.bungie.net/en/oauth/authorize';

export const handler = async (event) => {
  const clientId = process.env.BUNGIE_CLIENT_ID;
  const siteUrl = process.env.SITE_URL || (event.headers['x-forwarded-proto'] && event.headers['x-forwarded-host']
    ? `${event.headers['x-forwarded-proto']}://${event.headers['x-forwarded-host']}`
    : 'http://localhost:8888');

  if (!clientId) {
    return { statusCode: 500, body: 'BUNGIE_CLIENT_ID not configured' };
  }

  const state = randomBytes(16).toString('hex');
  const redirectUri = `${siteUrl}/api/auth-callback`;
  const isSecure = siteUrl && siteUrl.startsWith('https:');
  const oauthCookieOpts = `HttpOnly; SameSite=Lax; Path=/; Max-Age=600${isSecure ? '; Secure' : ''}`;

  const authUrl = new URL(BUNGIE_AUTH_URL);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('redirect_uri', redirectUri);

  return {
    statusCode: 302,
    headers: {
      Location: authUrl.toString(),
      'Set-Cookie': `oauth_state=${state}; ${oauthCookieOpts}`,
    },
    body: '',
  };
};
