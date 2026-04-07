# Emoji Flag Engine

A client-side web tool that converts flat SVG flags into 3D, wavy emoji-style PNGs and looping animated GIFs. It accurately replicates the design language of major tech platforms (Apple, Google, Samsung, Twitter, WhatsApp, and Huawei).

## Features

- **Live Canvas Pixel Warping**: Real-time trigonometric wave distortion and 3D lighting calculation (no backend required).
- **Multiple Platform Styles**:
  - **Apple**: Deep wave, bright center peak, thin edge shadows.
  - **Twitter (Twemoji)**: Flat, pill-shaped, soft drop shadow.
  - **Samsung**: Soft top-to-bottom gloss, 3D bevel stroke, shifted highlight.
  - **Google**: Pillowy lighting, subtle wave, crisp vector border.
  - **WhatsApp**: Vibrant "S" wave, thick 3D bevel, bright top-left highlight.
  - **Huawei**: Flat shape, high-frequency vertical lighting ripples.
- **Animated GIF Export**: Generate seamless, perfect-looping GIFs of the waving flags using the built-in `gifenc` engine.
- **Tunable Parameters**: Adjust wave amplitude, phase, frequency, lighting intensity, corner radius, and shadow blur for each style independently.
- **Smooth UX**: Features Lenis smooth scrolling, custom trailing cursor, and Web Haptics API integration for tactile feedback.

## Usage

1. Clone or download this repository.
2. Open `index.html` in any modern web browser (no build step or server required).
3. Drag and drop your own flat SVG flag onto the input area.
4. Toggle between **STATIC** and **GIF** modes using the header button.
5. Click the download buttons to export your emoji!

## Architecture

- `index.html`: The main UI structure.
- `styles.css`: All styling, including the custom cursor and smooth CSS grid accordion animations.
- `main.js`: The core logic. Contains the Canvas pixel warp engine, the static caching system (for 60 FPS performance), and the GIF rendering loop.
- `flowers.webp`: The decorative background image.

## Performance

The engine is heavily optimized to run at 60 FPS:
- **Static Caching**: The base flag and static overlays are rendered once to an off-screen canvas and cached as raw `ImageData`.
- **Math Hoisting**: Trigonometric calculations (`Math.sin`, `Math.cos`) for the X-axis wave are pre-calculated into a `Float32Array` before the massive Y-axis pixel loop, saving hundreds of thousands of operations per frame.

## Dependencies

- [Lenis](https://github.com/studio-freight/lenis) (via CDN) for smooth scrolling.
- [gifenc](https://github.com/mattdesl/gifenc) (via CDN) for fast, pure-JS GIF encoding.
