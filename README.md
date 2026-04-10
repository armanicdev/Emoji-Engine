# Flagoji

Turn flag artwork (SVG, PNG, JPG, WebP) into emoji-style previews for several platforms. Upload a file, tweak sliders, download PNGs; optional motion and GIF export.

**Stack:** static HTML, CSS, and JavaScript (ES modules). No app framework.

**Run locally:** ES modules do not work from `file://`. From this folder:

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`.

**Optional build:** With Node.js installed, `node scripts/build-dist.mjs` writes a `dist/` folder (minified assets where configured). There is no `package.json` or `npm install` for the app itself.

GIF export pulls [`gifenc`](https://github.com/mattdesl/gifenc) from a CDN when you use that feature.
