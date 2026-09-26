# Make WordArt Great Again

A WordArt editor that runs as a **Discord Activity** (an app embedded inside a Discord voice channel) and as a normal web page on GitHub Pages.
It grew out of *Lumpesammlig 008 — WordArt*: text is treated as an object that people can grab, bend, fill and extrude.

**Live (browser):** https://blackmath88.github.io/MakeWorardGreatAgain/

## What it can do

- Several WordArt objects on one canvas
- Handles that really work: move, resize (corners keep proportions, Shift = free), rotate (Shift = 15° steps), and a yellow diamond that changes the **bend**
- 10 shapes: Gerade, Bogen, Welle, Flagge, Steigung, Kreis, Wölbung, Taille, Perspektive, Spitze
- 12 gallery presets, each drawn as a live preview with the same renderer
- Fills: gradient (any angle), chrome, rainbow or a single colour; outline; 3D depth with direction and colour; drop shadow
- 10 system fonts. Web fonts are avoided on purpose: Discord's security rules (CSP) block font servers, and the PNG export could not embed them anyway.
- Backgrounds: paper, grid, "Himmel 2001", a single colour, or transparent
- Undo/redo (150 steps), and an autosave in the browser (localStorage)
- Output depends on where it runs:
  - **Inside Discord:** "In Discord teilen" uploads a PNG and opens Discord's own share dialog
  - **In a browser:** saves a PNG (2000 × 1200) or an SVG

**Shortcuts:**

| Key | Action |
|---|---|
| `N` | New object |
| `R` | Surprise me (random style) |
| `Ctrl+D` | Duplicate |
| `Del` | Delete |
| `Ctrl+Z` / `Ctrl+Y` | Undo / redo |
| `Tab` | Next object |
| Arrow keys | Nudge (Shift = 10 units) |
| `[` / `]` | Send backward / bring forward |
| `Enter` or double-click | Edit text |
| `Esc` | Deselect |

## How it fits together

One Cloudflare Worker serves the whole Activity, so everything sits at the root of a single host:

```
Discord client ──iframe──▶ https://<APP_ID>.discordsays.com   (Discord's proxy)
                               │
                               ▼
                      wordart-studio.<you>.workers.dev
                               ├── /api/*  → worker/index.js   (OAuth code → access token)
                               └── /*      → dist/             (the built site, Workers static assets)
```

- `src/`: Vite plus plain TypeScript, no framework
  - `render.ts`: lays out each glyph along the chosen shape, then builds the SVG
  - `main.ts`: the editor
  - `discord.ts`: talks to the Discord SDK
- `worker/index.js`: about 40 lines. It swaps the OAuth `code` for an access token. This part needs the client secret, which is why it can't be done in the browser.
- `wrangler.jsonc`: `run_worker_first` sends `/api/*` to the Worker; every other path is served from `dist/`.
- Discord's proxy strips the `/.proxy` prefix, so the client's `/.proxy/api/token` arrives at the Worker as `/api/token`.
- Sharing works like this: the app asks you to log in once (`authorize`), the Worker returns a token, the PNG goes to `POST /applications/{id}/attachment`, and then `openShareMomentDialog` opens.

## Setup (one time, about 15 minutes)

### 1. Discord app
1. Go to https://discord.com/developers/applications and click **New Application**. Name it "WordArt Studio".
2. **OAuth2** page:
   - Copy the **Client ID** (this app uses `1553104669105193090`; it lives in `.env` and `wrangler.jsonc`).
   - Click **Reset Secret** and copy the **Client Secret**. Keep it private — it only ever goes into the Worker.
   - Add a redirect of `https://127.0.0.1`. It is only a placeholder that the portal requires.
3. **Activities → Settings:** turn on **Enable Activities**. Under supported platforms, pick Web (and mobile if you want it).
4. **Activities → URL Mappings:** a single root mapping is enough.

   | PREFIX | TARGET |
   |---|---|
   | `/` | `wordart-studio.<your-subdomain>.workers.dev` |

5. **Installation:** tick *Guild Install*, open the install link, and add the app to your test server.

### 2. Deploy the Worker (Cloudflare)
```bash
npm install
npx wrangler login              # once per machine
npm run deploy                  # builds dist/ and deploys site + /api together
npx wrangler secret put DISCORD_CLIENT_SECRET   # paste the secret, once
```
The first `deploy` prints the `*.workers.dev` URL. That URL goes into the `/` mapping above.

Re-deploy after any change with `npm run deploy`. The secret survives deploys; you only set it once.

### 3. Launch it
In Discord, turn on **User Settings → Advanced → Developer Mode**. Then join a voice channel in your test server, click the 🚀 Activities button and pick **WordArt Studio**.
The first time you share, Discord asks you to authorise the app once.

## Local development
```bash
npm install
npm run dev          # plain web page on :5173; the Discord code switches itself off
```

To exercise the Worker and the token endpoint together:
```bash
npm run build
npx wrangler dev     # serves dist/ and /api/token on :8787
```
`wrangler dev` reads the client secret from `.dev.vars` (git-ignored). Put your real secret there
if you want the token exchange to succeed locally:
```
DISCORD_CLIENT_SECRET=<your secret>
```

To test inside Discord while developing, open a tunnel to your machine
(`cloudflared tunnel --url http://localhost:8787`) and point the `/` mapping at the tunnel's
address for the time being.

## Troubleshooting
- **Blank page in Discord:** check the `/` URL mapping points at the Worker's `*.workers.dev` host with no path after it.
- **"VITE_DISCORD_CLIENT_ID fehlt im Build":** `.env` was missing when `npm run build` ran. The ID is compiled into the bundle, so rebuild and redeploy.
- **"Token-Tausch fehlgeschlagen":** the Worker is reachable but the exchange failed. `npm run tail` shows live logs. `invalid_client` means `DISCORD_CLIENT_SECRET` is unset or stale — set it again with `npx wrangler secret put DISCORD_CLIENT_SECRET`.
- **"Upload fehlgeschlagen (401)":** the token has expired. Close the Activity and open it again.

## A note on GitHub Pages
The README previously described a split deployment (Pages for the site, a Worker for `/api`) and
referred to a build workflow that does not exist in this repo. The Worker now serves both, so Pages
is not needed. If you still want the standalone browser build at `blackmath88.github.io`, add a
GitHub Actions Pages workflow — it would need `VITE_DISCORD_CLIENT_ID` set as an Actions variable.
