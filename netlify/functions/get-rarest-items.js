import { getProfile, refreshAccessToken } from './lib/bungie-api.js';
import { decrypt, COOKIE_NAME } from './lib/cookie.js';
import { matchRarestItems, getMatcherData } from './lib/matcher.js';
import { appendFileSync } from 'fs';
import { join } from 'path';

function debugLog(payload) {
  try {
    appendFileSync(join(process.cwd(), 'debug-5ae389.log'), JSON.stringify({ ...payload, timestamp: Date.now(), sessionId: '5ae389' }) + '\n');
  } catch (_) {}
}

export const handler = async (event) => {
  const cookies = event.headers.cookie || '';
  const match = cookies.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  const cookieValue = match ? match[1].trim() : null;

  if (!cookieValue) {
    // #region agent log
    debugLog({ hypothesisId: 'H3,H5', location: 'get-rarest-items.js:no-cookie', message: '401 no bungie_auth cookie', data: { hasAnyCookies: !!cookies } });
    // #endregion
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Not authenticated' }),
    };
  }

  let auth;
  try {
    auth = decrypt(cookieValue);
  } catch (err) {
    // #region agent log
    debugLog({ hypothesisId: 'H5', location: 'get-rarest-items.js:decrypt-fail', message: '401 decrypt failed Invalid session', data: { errMessage: err.message } });
    // #endregion
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid session' }),
    };
  }

  let accessToken = auth.accessToken;
  if (Date.now() >= auth.expiresAt - 60000) {
    try {
      const refreshed = await refreshAccessToken(auth.refreshToken);
      accessToken = refreshed.accessToken;
    } catch (err) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Session expired' }),
      };
    }
  }

  try {
    const profileData = await getProfile(
      accessToken,
      auth.membershipType,
      auth.membershipId
    );

    const { manifest, rarity } = getMatcherData();
    const results = matchRarestItems(profileData, manifest, rarity);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categories: results }),
    };
  } catch (err) {
    console.error('get-rarest-items error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || 'Failed to fetch data' }),
    };
  }
};
