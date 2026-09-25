// Token exchange for the Discord Activity.
// The browser gets a one-time `code` from discordSdk.commands.authorize();
// only a server holding the client secret may swap it for an access token.
//
// The same Worker also serves the Vite build (dist/) as static assets.
// Discord's proxy maps  /.proxy/*  →  this Worker, so the app's /.proxy/api/token arrives as /api/token.

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    const { pathname } = new URL(request.url);
    if (request.method === 'OPTIONS' && pathname.endsWith('/token')) return new Response(null, { headers: cors });
    if (request.method !== 'POST' || !pathname.endsWith('/token')) return env.ASSETS.fetch(request);

    let code;
    try { ({ code } = await request.json()); } catch { /* fall through */ }
    if (!code) return Response.json({ error: 'missing code' }, { status: 400, headers: cors });

    const res = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
      }),
    });
    const data = await res.json();
    if (!res.ok) return Response.json({ error: data.error ?? 'token exchange failed' }, { status: res.status, headers: cors });

    return Response.json({ access_token: data.access_token }, { headers: cors });
  },
};
