import { exchangeCodeForToken, getMembershipData } from './lib/bungie-api.js';
import { encrypt, COOKIE_NAME, getCookieOpts } from './lib/cookie.js';
import { appendFileSync } from 'fs';
import { join } from 'path';

function debugLog(payload) {
  try {
    appendFileSync(join(process.cwd(), 'debug-5ae389.log'), JSON.stringify({ ...payload, timestamp: Date.now(), sessionId: '5ae389' }) + '\n');
  } catch (_) {}
}

export const handler = async (event) => {
  const siteUrl = process.env.SITE_URL || (event.headers['x-forwarded-proto'] && event.headers['x-forwarded-host']
    ? `${event.headers['x-forwarded-proto']}://${event.headers['x-forwarded-host']}`
    : 'http://localhost:8888');

  const params = event.queryStringParameters || {};
  const code = params.code;
  const state = params.state;
  const error = params.error;
  const cookies = event.headers.cookie || '';
  const stateMatch = cookies.match(/oauth_state=([^;]+)/);
  const storedState = stateMatch ? stateMatch[1].trim() : null;

  // #region agent log
  debugLog({ hypothesisId: 'H1,H2', location: 'auth-callback.js:entry', message: 'auth-callback invoked', data: { hasError: !!error, hasCode: !!code, hasState: !!state, hasOauthStateCookie: !!storedState, stateMatch: storedState === state, cookieCount: (cookies.match(/;/g) || []).length + (cookies ? 1 : 0) } });
  // #endregion

  if (error) {
    // #region agent log
    debugLog({ hypothesisId: 'H1', location: 'auth-callback.js:error-branch', message: 'redirecting to home with error param', data: { error } });
    // #endregion
    return {
      statusCode: 302,
      headers: { Location: `${siteUrl}/?error=${encodeURIComponent(error)}` },
      body: '',
    };
  }

  if (!code || !state) {
    // #region agent log
    debugLog({ hypothesisId: 'H1', location: 'auth-callback.js:missing-params', message: 'redirecting to home missing code/state', data: {} });
    // #endregion
    return {
      statusCode: 302,
      headers: { Location: `${siteUrl}/?error=missing_params` },
      body: '',
    };
  }

  if (!storedState || storedState !== state) {
    // #region agent log
    debugLog({ hypothesisId: 'H1,H2', location: 'auth-callback.js:invalid-state', message: 'redirecting to home invalid_state', data: { hasStoredState: !!storedState, stateLengths: { stored: (storedState || '').length, param: (state || '').length } } });
    // #endregion
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

    const cookieOpts = getCookieOpts(siteUrl);
    // #region agent log
    debugLog({ hypothesisId: 'H3', location: 'auth-callback.js:success', message: 'auth success redirecting to dashboard', data: { siteUrl } });
    // #endregion
    return {
      statusCode: 302,
      headers: { Location: `${siteUrl}/dashboard.html` },
      multiValueHeaders: {
        'Set-Cookie': [
          `${COOKIE_NAME}=${cookieValue}; ${cookieOpts}`,
          'oauth_state=; Max-Age=0; Path=/',
        ],
      },
      body: '',
    };
  } catch (err) {
    console.error('Auth callback error:', err);
    // #region agent log
    debugLog({ hypothesisId: 'H1,H4', location: 'auth-callback.js:catch', message: 'auth-callback error redirecting to home', data: { errMessage: err.message } });
    // #endregion
    return {
      statusCode: 302,
      headers: { Location: `${siteUrl}/?error=${encodeURIComponent(err.message)}` },
      body: '',
    };
  }
};
