import { exchangeCodeForToken, getMembershipData } from './lib/bungie-api.js';
import { encrypt, COOKIE_NAME, COOKIE_OPTS } from './lib/cookie.js';

export const handler = async (event) => {
  const siteUrl = process.env.SITE_URL || (event.headers['x-forwarded-proto'] && event.headers['x-forwarded-host']
    ? `${event.headers['x-forwarded-proto']}://${event.headers['x-forwarded-host']}`
    : 'http://localhost:8888');

  const params = event.queryStringParameters || {};
  const code = params.code;
  const state = params.state;
  const error = params.error;

  if (error) {
    return {
      statusCode: 302,
      headers: { Location: `${siteUrl}/?error=${encodeURIComponent(error)}` },
      body: '',
    };
  }

  if (!code || !state) {
    return {
      statusCode: 302,
      headers: { Location: `${siteUrl}/?error=missing_params` },
      body: '',
    };
  }

  const cookies = event.headers.cookie || '';
  const stateMatch = cookies.match(/oauth_state=([^;]+)/);
  const storedState = stateMatch ? stateMatch[1].trim() : null;

  if (!storedState || storedState !== state) {
    return {
      statusCode: 302,
      headers: { Location: `${siteUrl}/?error=invalid_state` },
      body: '',
    };
  }

  try {
    const tokenData = await exchangeCodeForToken(code);
    const membershipData = await getMembershipData(tokenData.accessToken);
    const expiresAt = Date.now() + tokenData.expiresIn * 1000;

    const cookieValue = encrypt({
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken,
      expiresAt,
      membershipId: membershipData.membershipId,
      membershipType: membershipData.membershipType,
    });

    return {
      statusCode: 302,
      headers: {
        Location: `${siteUrl}/dashboard.html`,
        'Set-Cookie': [
          `${COOKIE_NAME}=${cookieValue}; ${COOKIE_OPTS}`,
          'oauth_state=; Max-Age=0; Path=/',
        ].join(', '),
      },
      body: '',
    };
  } catch (err) {
    console.error('Auth callback error:', err);
    return {
      statusCode: 302,
      headers: { Location: `${siteUrl}/?error=${encodeURIComponent(err.message)}` },
      body: '',
    };
  }
};
