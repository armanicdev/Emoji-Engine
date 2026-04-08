# Flagoji

Client-side tool: upload a flag SVG, get emoji-style PNGs per platform (Apple, Google, Samsung, Twitter, WhatsApp, Huawei). Optional motion preview and GIF export. No build step—open `index.html` in a modern browser.

## What it does

- Normalizes SVG to a 3:2 frame, masks with rounded corners, applies platform-specific wave and lighting in canvas.
- **Motion**: animates the wave; downloads become GIF when motion is on, PNG when off.
- **Smoothing**: toggles canvas image smoothing (preview and export).
- **Per-platform sliders**: wave, stroke, shadow, gloss, and related parameters per style.

## Files

| File | Role |
|------|------|
| `index.html` | Layout and copy |
| `styles.css` | Layout, type, controls, cursor trailer |
| `main.js` | SVG load, warp engine, cache, GIF export, haptics |
| `flowers.webp` | Footer decoration |

## Dependencies (CDN)

- [Lenis](https://github.com/darkroomengineering/lenis) — scroll smoothing  
- [gifenc](https://github.com/mattdesl/gifenc) — GIF encoding  
- Optional: `web-haptics` (dynamic import) with `navigator.vibrate` fallback  

## Performance notes

Static flag layers are cached per variant; slider changes re-render only the touched variant. Wave math along X is hoisted into a buffer before the per-pixel Y pass.
