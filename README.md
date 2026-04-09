# Flagoji

Static site: **HTML + CSS + JavaScript (ES modules)**. There is **no build step** — that matches how the web has worked for years. Upload the folder to any host; use **HTTPS** and a normal document root.

**Local preview:** Browsers block `type="module"` from `file://`, so use any static server from the project folder, for example:
- **Python:** `python3 -m http.server 8080` → **http://localhost:8080**
- **One-off (Node not required in the repo):** `npx --yes serve . -l 4173` → **http://localhost:4173**

There is **no `package.json`** — nothing to install for production or for Hostinger.

## Deploy to Hostinger

**Manual:** Upload **`index.html`**, **`.htaccess`**, **`src/`**, **`assets/`** into **`public_html/flagoji/`**.  
If you previously used **`dist/`**, **delete that folder on the server** so the browser doesn’t load old bundles.

**GitHub Actions:** [`.github/workflows/deploy-hostinger.yml`](.github/workflows/deploy-hostinger.yml) FTP-uploads the repo **without** Node (no `npm run build`). Set secrets: `HOSTINGER_FTP_HOST`, `HOSTINGER_FTP_USER`, `HOSTINGER_FTP_PASSWORD`.

Live URL (typical): **https://flagoji.armanic.studio/** when the subdomain points at that folder.

## Layout

| Path | Role |
|------|------|
| `index.html` | App shell |
| `assets/styles.css` | All styles |
| `src/main.js` | App entry (`type="module"`) |
| `src/gif-export-frame.js` | GIF quantization (loads `gifenc` from CDN when needed) |
| `src/gif-export-worker.js` | Web Worker for GIF frames |
| `assets/fonts/` | Fonts |
| `assets/vendor/lenis.min.js` | Lenis |
| `assets/images/` | Images |
| `.htaccess` | Cache + compression hints (Apache/LiteSpeed) |

## About “0/100” performance scores

Cheap **shared hosting** often has slow **TTFB**; Lighthouse **mobile + throttling** punishes that. **Minifying** or a **`dist/`** folder does not fix server latency. Your stack can be fine and still score low on Hostinger’s tool — compare with [PageSpeed Insights](https://pagespeed.web.dev/) for another data point.

## Dependencies

- **Browser** loads [gifenc](https://github.com/mattdesl/gifenc) from a CDN when you export a GIF.  
- Optional: **web-haptics** (dynamic import) with `navigator.vibrate` fallback.

## What it does

- Normalizes SVG to a 3:2 frame; rasters use **cover** into the same frame, then platform-specific canvas styling.
- **Motion** / **GIF export**, **smoothing**, per-platform sliders.
