import { DiscordSDK } from '@discord/embedded-app-sdk';

const CLIENT_ID: string = import.meta.env.VITE_DISCORD_CLIENT_ID ?? '';
const DISCORD_API = 'https://discord.com/api/v10';

/** Discord launches activities with ?frame_id=…&instance_id=… in the URL. */
export const inDiscord = new URLSearchParams(location.search).has('frame_id');

export interface DiscordUser { id: string; username: string; global_name?: string | null; avatar?: string | null }

let sdk: DiscordSDK | null = null;
let accessToken: string | null = null;
export let user: DiscordUser | null = null;

export async function initDiscord(): Promise<boolean> {
  if (!inDiscord) return false;
  if (!CLIENT_ID) throw new Error('VITE_DISCORD_CLIENT_ID fehlt im Build');
  sdk = new DiscordSDK(CLIENT_ID);
  await sdk.ready();
  return true;
}

/** OAuth: Discord consent → code → our Worker swaps it for a token (needs the client secret). */
export async function login(): Promise<DiscordUser> {
  if (!sdk) throw new Error('Nicht in Discord');
  if (user && accessToken) return user;
  const { code } = await sdk.commands.authorize({
    client_id: CLIENT_ID,
    response_type: 'code',
    state: '',
    prompt: 'none',
    scope: ['identify'],
  });
  // "/.proxy/api/token" reaches the Worker as /api/token via the Activity URL mapping "/" → Worker
  const res = await fetch('/.proxy/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) throw new Error(`Token-Tausch fehlgeschlagen (${res.status})`);
  const { access_token } = await res.json();
  const auth = await sdk.commands.authenticate({ access_token });
  accessToken = access_token;
  user = auth.user as DiscordUser;
  return user;
}

/** Upload the PNG to Discord's CDN, then open the native "share to channel / DM" dialog. */
export async function shareImage(png: Blob): Promise<void> {
  if (!sdk) throw new Error('Nicht in Discord');
  await login();
  const body = new FormData();
  body.append('file', new File([png], 'wordart.png', { type: 'image/png' }));
  const res = await fetch(`${DISCORD_API}/applications/${CLIENT_ID}/attachment`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body,
  });
  if (!res.ok) throw new Error(`Upload fehlgeschlagen (${res.status})`);
  const { attachment } = await res.json();
  await sdk.commands.openShareMomentDialog({ mediaUrl: attachment.url });
}

