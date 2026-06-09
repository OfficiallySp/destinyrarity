import { getSiteUrl } from './lib/site-url.js';

export const handler = async (event) => {
  const siteUrl = getSiteUrl(event);
  return {
    statusCode: 302,
    headers: {
      Location: `${siteUrl}/`,
      'Set-Cookie': 'bungie_auth=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0',
    },
    body: '',
  };
};
