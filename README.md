# Flagoji

Client-side tool: upload flag artwork as **SVG, PNG, JPG, or WebP**, get emoji-style PNGs per platform (Apple, Google, Samsung, Twitter, WhatsApp, Huawei). Rasters are cropped to a 3:2 frame (cover). Optional motion preview and GIF export.

Run **`npm run build`** before deploy (minified JS/CSS). For local preview, use any static server (e.g. `npx serve .`) so module paths resolve.

## Deploy from GitHub → Hostinger (automatic)

The workflow [`.github/workflows/deploy-hostinger.yml`](.github/workflows/deploy-hostinger.yml) **builds on GitHub** and **uploads over FTP** whenever you **push to `main`** (including **merging a Pull Request** into `main`). You do not run `npm` on Hostinger.

1. Push this repo to GitHub (default branch should be `main` or `master`).
2. In **Hostinger hPanel** → **Files** → **FTP Accounts** (or **Advanced** → **FTP**), note the **FTP host**, **username**, and **password**. This project deploys to **`public_html/flagoji/`** (subfolder); visit `https://yourdomain.com/flagoji/`.
3. In GitHub: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:
   - `HOSTINGER_FTP_HOST` — hostname only (e.g. `ftp.yourdomain.com`, no `ftp://`)
   - `HOSTINGER_FTP_USER`
   - `HOSTINGER_FTP_PASSWORD`
4. Commit and push the workflow file; or open **Actions** → **Deploy to Hostinger** → **Run workflow** to test.

If your FTP home is already **`public_html`**, the workflow uses **`public_html/flagoji/`** as `server-dir` (path relative to FTP root). If your host nests differently, edit `server-dir` in the workflow file.

**More “platform” style (optional):** Connect the same repo to [Vercel](https://vercel.com), [Netlify](https://www.netlify.com), or [Cloudflare Pages](https://pages.cloudflare.com) — they build on every push/PR with almost no FTP setup.

## What it does

- Normalizes SVG to a 3:2 frame; rasters use **cover** (center crop) into the same frame. Then masks with rounded corners and applies platform-specific wave and lighting in canvas.
- **Motion**: animates the wave; downloads become GIF when motion is on, PNG when off.
- **Smoothing**: toggles canvas image smoothing (preview and export).
- **Per-platform sliders**: wave, stroke, shadow, gloss, and related parameters per style.

## Layout

| Path | Role |
|------|------|
| `index.html` | App shell |
| `src/main.js` | SVG load, warp engine, cache, GIF export, haptics |
| `src/gif-export-*.js` | GIF frame pipeline + worker |
| `assets/styles.css` | Source styles (edit this) |
| `assets/styles.min.css` | Built CSS (`npm run build`) |
| `assets/fonts/` | Self-hosted Ranade + Archivo |
| `assets/vendor/` | Lenis (self-hosted) |
| `assets/images/` | Footer art, logo |
| `dist/` | Bundled/minified JS (`npm run build`) |
| `scripts/build.mjs` | esbuild entry |

## Dependencies

- [Lenis](https://github.com/darkroomengineering/lenis) — vendored in `assets/vendor/` (scroll smoothing)  
- [gifenc](https://github.com/mattdesl/gifenc) — loaded from npm CDN when exporting GIFs  
- Optional: `web-haptics` (dynamic import) with `navigator.vibrate` fallback  

## Performance notes

Static flag layers are cached per variant; slider changes re-render only the touched variant. Wave math along X is hoisted into a buffer before the per-pixel Y pass.
