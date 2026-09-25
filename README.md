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

```
Discord client ──iframe──▶ https://<APP_ID>.discordsays.com   (Discord's proxy)
                               │  /        → blackmath88.github.io/MakeWorardGreatAgain   (GitHub Pages, static)
                               │  /api/*   → wordart-token.<you>.workers.dev              (Cloudflare Worker)
```

- `src/`: Vite plus plain TypeScript, no framework
  - `render.ts`: lays out each glyph along the chosen shape, then builds the SVG
  - `main.ts`: the editor
  - `discord.ts`: talks to the Discord SDK
- `worker/`: about 40 lines. It swaps the OAuth `code` for an access token. This part needs the client secret, which is why it can't live on GitHub Pages.
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
   | `/` | `blackmath88.github.io/MakeWorardGreatAgain` |
   | `/api` | `wordart-token.<your-subdomain>.workers.dev` |

5. **Installation:** tick *Guild Install*, open the install link, and add the app to your test server.

### 2. Token Worker (Cloudflare)
```bash
cd worker
# put your Client ID into wrangler.jsonc → vars.DISCORD_CLIENT_ID
npx wrangler deploy
npx wrangler secret put DISCORD_CLIENT_SECRET   # paste the secret
```
The first `deploy` prints the `*.workers.dev` URL. That URL goes into the `/api` mapping above.

### 3. GitHub Pages
1. In the repo, go to **Settings → Pages → Source** and choose **GitHub Actions**.
2. Go to **Settings → Secrets and variables → Actions → Variables** and add `DISCORD_CLIENT_ID` = your Client ID. It is public, so a variable is fine; it does not need to be a secret.
3. Push to `main`. The workflow builds and deploys the site.

### 4. Launch it
In Discord, turn on **User Settings → Advanced → Developer Mode**. Then join a voice channel in your test server, click the 🚀 Activities button and pick **WordArt Studio**.
The first time you share, Discord asks you to authorise the app once.

## Local development
```bash
npm install
npm run dev          # runs as a normal web page; the Discord code switches itself off
```
To test inside Discord while developing, open a tunnel to your machine (`cloudflared tunnel --url http://localhost:5173`). Then point the `/` mapping at the tunnel's address for the time being.

## Troubleshooting
- **Blank page in Discord:** check the `/` mapping. If Discord refuses a target that includes a path, use a custom domain for Pages or the Worker's static-assets feature, so the app sits at the root of a host.
- **"Token-Tausch fehlgeschlagen":** check the `/api` mapping and the Worker secret. `npx wrangler tail` shows the Worker's live logs.
- **"Upload fehlgeschlagen (401)":** the token has expired. Close the Activity and open it again.
