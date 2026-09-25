# Make WordArt Great Again

A WordArt editor that runs as a **Discord Activity** (an app embedded inside a Discord voice channel) and as a normal web page. One Cloudflare Worker serves both the app and the token exchange.
It grew out of *Lumpesammlig 008 — WordArt*: text is treated as an object that people can grab, bend, fill and extrude.

**Live (browser):** https://wordart-studio.<your-subdomain>.workers.dev/

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

```
Discord client ──iframe──▶ https://<APP_ID>.discordsays.com   (Discord's proxy)
                               │  /  → wordart-studio.<you>.workers.dev   (one Cloudflare Worker)
                                        ├─ /api/token → token exchange (worker/index.js)
                                        └─ everything else → static files from dist/
```

- `src/`: Vite plus plain TypeScript, no framework
  - `render.ts`: lays out each glyph along the chosen shape, then builds the SVG
  - `main.ts`: the editor
  - `discord.ts`: talks to the Discord SDK
- `public/`: `datenschutz.html` and `nutzungsbedingungen.html` (privacy policy and terms, in German). Vite copies them into `dist/`.
- `worker/index.js`: about 40 lines. `POST /api/token` swaps the OAuth `code` for an access token (this needs the client secret). Every other request is answered from `dist/` via the `ASSETS` binding.
- `wrangler.jsonc`: the Worker config (name `wordart-studio`, static assets from `./dist`).
- Sharing works like this: the app asks you to log in once (`authorize`), the Worker returns a token, the PNG goes to `POST /applications/{id}/attachment`, and then `openShareMomentDialog` opens.

## Setup (one time, about 15 minutes)

### 1. Discord app
1. Go to https://discord.com/developers/applications and click **New Application**. Name it "WordArt Studio".
2. **OAuth2** page:
   - Copy the **Client ID**.
   - Click **Reset Secret** and copy the **Client Secret**. Keep it private.
   - Add a redirect of `https://127.0.0.1`. It is only a placeholder that the portal requires.
3. **Activities → Settings:** turn on **Enable Activities**. Under supported platforms, pick Web (and mobile if you want it).
4. **Activities → URL Mappings:**

   | PREFIX | TARGET |
   |---|---|
   | `/` | `wordart-studio.<your-subdomain>.workers.dev` |

   The app calls `/.proxy/api/token`, which reaches the Worker as `/api/token`.

5. **General Information:**
   - Terms of Service URL: `https://wordart-studio.<your-subdomain>.workers.dev/nutzungsbedingungen.html`
   - Privacy Policy URL: `https://wordart-studio.<your-subdomain>.workers.dev/datenschutz.html`
6. **Installation:** tick *Guild Install*, open the install link, and add the app to your test server.

### 2. Cloudflare Worker (app + token exchange)
Put your Client ID into `wrangler.jsonc` → `vars.DISCORD_CLIENT_ID`, and into a local `.env` file as `VITE_DISCORD_CLIENT_ID=...` (the build bakes it into the app).

Then deploy in one of two ways:

- **From your machine:**
  ```bash
  npm install
  npm run deploy                                   # vite build + wrangler deploy
  npx wrangler secret put DISCORD_CLIENT_SECRET    # paste the secret (once)
  ```
- **Auto-deploy on push:** Cloudflare dashboard → **Workers & Pages → Create → Import a repository**, pick this repo. Every push to `main` builds and deploys.
  - Build command: `npm run build`, deploy command: `npx wrangler deploy`
  - Add `VITE_DISCORD_CLIENT_ID` as a **build variable** (Settings → Build → Variables).
  - Still run `npx wrangler secret put DISCORD_CLIENT_SECRET` once (or add it as a secret in the dashboard).

The first deploy prints the `wordart-studio.<your-subdomain>.workers.dev` URL. That URL goes into the `/` mapping and the two legal URLs above.

### 3. Launch it
In Discord, turn on **User Settings → Advanced → Developer Mode**. Then join a voice channel in your test server, click the 🚀 Activities button and pick **WordArt Studio**.
The first time you share, Discord asks you to authorise the app once.

## Local development
```bash
npm install
npm run dev          # runs as a normal web page; the Discord code switches itself off
npm run cf:dev       # build + run the real Worker locally (wrangler dev, http://localhost:8787)
```
For `cf:dev`, put `DISCORD_CLIENT_SECRET=...` into a `.dev.vars` file if you want the token exchange to work locally.
To test inside Discord while developing, open a tunnel to your machine (`cloudflared tunnel --url http://localhost:5173`). Then point the `/` mapping at the tunnel's address for the time being.

## Troubleshooting
- **Blank page in Discord:** check the `/` mapping (host only, no `https://`, no path) and that `dist/` was built before deploying.
- **"Token-Tausch fehlgeschlagen":** check the `/` mapping, `DISCORD_CLIENT_ID` in `wrangler.jsonc` and the Worker secret. `npx wrangler tail` shows the Worker's live logs.
- **"Upload fehlgeschlagen (401)":** the token has expired. Close the Activity and open it again.
