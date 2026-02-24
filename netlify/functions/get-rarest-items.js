import { getProfile, refreshAccessToken } from './lib/bungie-api.js';
import { decrypt, COOKIE_NAME } from './lib/cookie.js';
import { matchRarestItems, getMatcherData } from './lib/matcher.js';

export const handler = async (event) => {
  const cookies = event.headers.cookie || '';
  const match = cookies.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  const cookieValue = match ? match[1].trim() : null;

  if (!cookieValue) {
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
