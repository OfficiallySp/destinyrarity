/**
 * Bungie API helpers: token exchange, profile fetch.
 */

const BUNGIE_BASE = 'https://www.bungie.net';

function getApiKey() {
  const key = process.env.BUNGIE_API_KEY;
  if (!key) throw new Error('BUNGIE_API_KEY not configured');
  return key;
}

export async function exchangeCodeForToken(code) {
  const res = await fetch(`${BUNGIE_BASE}/Platform/App/OAuth/Token/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-API-Key': getApiKey(),
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: process.env.BUNGIE_CLIENT_ID,
      client_secret: process.env.BUNGIE_CLIENT_SECRET,
    }),
  });

  const data = await res.json();
  if (data.error) {
    throw new Error(data.error_description || data.error);
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    membershipId: data.membership_id,
  };
}

export async function getMembershipData(accessToken) {
  const res = await fetch(`${BUNGIE_BASE}/Platform/User/GetMembershipsForCurrentUser/`, {
    headers: {
      'X-API-Key': getApiKey(),
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await res.json();
  if (data.ErrorCode !== 1) {
    throw new Error(data.Message || 'Failed to get membership');
  }

  const primary = data.Response?.destinyMemberships?.[0];
  if (!primary) {
    throw new Error('No Destiny membership found');
  }

  return {
    membershipType: primary.membershipType,
    membershipId: primary.membershipId,
  };
}

export async function getProfile(accessToken, membershipType, membershipId) {
  const url = `${BUNGIE_BASE}/Platform/Destiny2/${membershipType}/Profile/${membershipId}/?components=100,800,900`;
  const res = await fetch(url, {
    headers: {
      'X-API-Key': getApiKey(),
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await res.json();
  if (data.ErrorCode !== 1) {
    throw new Error(data.Message || 'Failed to fetch profile');
  }

  return data.Response;
}

export async function refreshAccessToken(refreshToken) {
  const res = await fetch(`${BUNGIE_BASE}/Platform/App/OAuth/Token/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-API-Key': getApiKey(),
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.BUNGIE_CLIENT_ID,
      client_secret: process.env.BUNGIE_CLIENT_SECRET,
    }),
  });

  const data = await res.json();
  if (data.error) {
    throw new Error(data.error_description || data.error);
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}
