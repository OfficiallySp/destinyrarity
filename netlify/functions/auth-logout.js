export const handler = async (event) => {
  const siteUrl = process.env.SITE_URL || (event.headers['x-forwarded-proto'] && event.headers['x-forwarded-host']
    ? `${event.headers['x-forwarded-proto']}://${event.headers['x-forwarded-host']}`
    : 'http://localhost:8888');
  return {
    statusCode: 302,
    headers: {
      Location: `${siteUrl}/`,
      'Set-Cookie': 'bungie_auth=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0',
    },
    body: '',
  };
};
