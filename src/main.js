function minDelay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Runs first so loader timing is not delayed by the rest of this module (~1000 lines). */
async function initAppShell() {
  const body = document.body;
  const appMain = document.getElementById('app-main');
  const loading = document.getElementById('app-loading');
  const flowersImg = document.querySelector('.flowers-bottom__img');

  const decodeFlowers =
    flowersImg && typeof flowersImg.decode === 'function'
      ? flowersImg.decode().catch(() => { })
      : Promise.resolve();

  const fontsReady =
    document.fonts && typeof document.fonts.ready !== 'undefined'
      ? document.fonts.ready
      : Promise.resolve();

  const tBoot = performance.now();
  const MIN_VISIBLE_MS = 500;
  const MAX_LOAD_WAIT_MS = 3200;

  await Promise.race([
    Promise.all([fontsReady.catch(() => { }), decodeFlowers]),
    minDelay(MAX_LOAD_WAIT_MS)
  ]);

  await minDelay(Math.max(0, MIN_VISIBLE_MS - (performance.now() - tBoot)));

  body.classList.remove('app--booting');
  body.classList.add('app--ready');
  body.setAttribute('aria-busy', 'false');
  if (appMain) {
    appMain.removeAttribute('inert');
    appMain.setAttribute('aria-hidden', 'false');
  }

  window.__FLAGOJI_LOADER_UNLOCKED = true;

  requestAnimationFrame(() => {
    if (typeof window.FlagojiHideLoader === 'function') {
      window.FlagojiHideLoader({ instant: false });
    } else if (loading) {
      loading.remove();
      document.documentElement.style.overflow = '';
    }
  });
}

initAppShell();

// Initialize Lenis for smooth scrolling
const lenis = new Lenis({
  duration: 0.8,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  orientation: "vertical",
  gestureOrientation: "vertical",
  smoothWheel: true
});

function raf(time) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}

requestAnimationFrame(raf);

let currentImg = null;
let isAnimated = false;
let animationPhaseOffset = 0;
let lastAnimTime = 0;
const ANIM_SPEED = 1.5; // radians per second

function toggleAnimation() {
  isAnimated = !isAnimated;
  const btn = document.getElementById('gifToggle');
  const label = btn.querySelector('.gif-toggle__label');

  // Trigger spin animation once
  btn.classList.remove('gif-toggle--spin-once');
  void btn.offsetWidth; // force reflow
  btn.classList.add('gif-toggle--spin-once');

  btn.setAttribute('aria-pressed', String(isAnimated));
  if (isAnimated) {
    label.textContent = 'Still';
    lastAnimTime = performance.now();
    requestAnimationFrame(animateLoop);
  } else {
    label.textContent = 'Motion';
    animationPhaseOffset = 0;
    if (currentImg) generateVariants();
  }
}
window.toggleAnimation = toggleAnimation;

function animateLoop(now) {
  if (!isAnimated) return;
  const dt = (now - lastAnimTime) / 1000;
  lastAnimTime = now;
  animationPhaseOffset += ANIM_SPEED * dt;
  if (currentImg) generateVariants();
  requestAnimationFrame(animateLoop);
}

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const errorMsg = document.getElementById('errorMsg');
const previewsContainer = document.getElementById('previewsContainer');
const tuningPanel = document.getElementById('tuningPanel');
const outputPlaceholder = document.getElementById('outputPlaceholder');
const previewDownloadButtons = document.querySelectorAll('.preview-header, .preview-canvas');
const hapticsState = {
  instance: null,
  ready: false,
  enabled: false,
  lastSliderTickAt: 0,
  sliderValues: new Map()
};

const HAPTIC_PRESETS = {
  uploadPick: [{ duration: 16, intensity: 0.18 }],
  sliderTick: [{ duration: 10, intensity: 0.12 }],
  sliderSettle: [{ duration: 18, intensity: 0.22 }],
  download: [{ duration: 18, intensity: 0.28 }, { delay: 26, duration: 34, intensity: 0.44 }]
};

function deviceHapticsSupported() {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

function patternToVibrateInput(input) {
  if (typeof input === 'number') return input;
  if (Array.isArray(input)) {
    if (typeof input[0] === 'number') return input;
    const pattern = [];
    input.forEach((step, index) => {
      if (step && typeof step.delay === 'number' && step.delay > 0) {
        pattern.push(step.delay);
      } else if (index > 0) {
        pattern.push(24);
      }
      pattern.push(Math.max(8, Math.round(step.duration ?? 16)));
    });
    return pattern;
  }
  switch (input) {
    case 'success':
      return [40, 40, 40];
    case 'nudge':
      return [50, 60, 28];
    case 'error':
      return [40, 36, 40, 36, 40];
    default:
      return [16];
  }
}

function triggerHaptic(input, options) {
  if (!hapticsState.enabled) return;

  if (hapticsState.instance) {
    hapticsState.instance.trigger(input, options).catch(() => { });
    return;
  }

  const fallback = patternToVibrateInput(input);
  if (fallback && deviceHapticsSupported()) {
    navigator.vibrate(fallback);
  }
}

async function initHaptics() {
  try {
    const { WebHaptics } = await import('https://esm.sh/web-haptics');
    hapticsState.instance = new WebHaptics({
      debug: false,
      showSwitch: false
    });
    hapticsState.enabled = Boolean(WebHaptics.isSupported || deviceHapticsSupported());
  } catch (error) {
    hapticsState.enabled = deviceHapticsSupported();
  } finally {
    hapticsState.ready = true;
  }
}

function maybeTriggerSliderTick(id, value) {
  const previousValue = hapticsState.sliderValues.get(id);
  const now = performance.now();
  hapticsState.sliderValues.set(id, value);

  if (previousValue === value) return;
  if (now - hapticsState.lastSliderTickAt < 70) return;

  hapticsState.lastSliderTickAt = now;
  triggerHaptic(HAPTIC_PRESETS.sliderTick, { intensity: 0.12 });
}

// Presets configuration for Canvas pixel warp
const STYLE_PRESETS = {
  apple: {
    waveAmplitude: 12,
    waveFrequency: 1, // 1 full wave
    wavePhase: 0,
    lightIntensity: 45, // Increased for stronger contrast
    cornerRadius: 16,
    strokeWidth: 2,
    innerStrokeOpacity: 0.15,
    shadowBlur: 8,
    shadowY: 4,
    shadowOpacity: 0.2
  },
  twitter: {
    cornerRadius: 32,
    strokeWidth: 4,
    strokeOpacity: 0.15,
    shadowBlur: 4,
    shadowY: 2,
    shadowOpacity: 0.1,
    glossOpacity: 0.15
  },
  google: {
    waveAmplitude: 15,
    waveFrequency: 1, // Full wave
    wavePhase: 3.14, // Starts by going up to a peak
    lightIntensity: 10,
    cornerRadius: 4,
    strokeWidth: 2,
    strokeOpacity: 0.2,
    innerStrokeOpacity: 0,
    shadowBlur: 0,
    shadowY: 0,
    shadowOpacity: 0,
    glossOpacity: 0
  },
  huawei: {
    waveAmplitude: 0,
    waveFrequency: 2.0,
    wavePhase: -1.57,
    lightIntensity: 60,
    cornerRadius: 2,
    strokeWidth: 2,
    strokeOpacity: 0.2,
    innerStrokeOpacity: 0,
    shadowBlur: 0,
    shadowY: 0,
    shadowOpacity: 0,
    glossOpacity: 0
  },
  whatsapp: {
    waveAmplitude: 10,
    waveFrequency: 1,
    wavePhase: 3.06,
    lightIntensity: 60,
    cornerRadius: 10,
    strokeWidth: 4,
    strokeOpacity: 0.4,
    innerStrokeOpacity: 0.21,
    shadowBlur: 4,
    shadowY: 4,
    shadowOpacity: 0.18,
    glossOpacity: 5.03
  },
  samsung: {
    waveAmplitude: 14,
    waveFrequency: 1, // Full wave
    wavePhase: 0,
    lightIntensity: 25, // Reduced for a softer highlight
    cornerRadius: 12,
    strokeWidth: 4,
    innerStrokeOpacity: 0.25,
    shadowBlur: 10,
    shadowY: 6,
    shadowOpacity: 0.3,
    glossOpacity: 0.3 // Softer top highlight
  }
};

const PARAM_VARIANT_ORDER = ['apple', 'twitter', 'samsung', 'google', 'huawei', 'whatsapp'];
const PARAM_VARIANT_LABEL = {
  apple: 'Apple',
  twitter: 'Twitter',
  samsung: 'Samsung',
  google: 'Google',
  huawei: 'Huawei',
  whatsapp: 'WhatsApp'
};

/** UI labels for preset keys (camelCase → sentence case). */
const PARAM_KEY_LABEL = {
  waveAmplitude: 'Wave amplitude',
  waveFrequency: 'Wave frequency',
  wavePhase: 'Wave phase',
  lightIntensity: 'Light intensity',
  cornerRadius: 'Corner radius',
  strokeWidth: 'Stroke width',
  innerStrokeOpacity: 'Inner stroke opacity',
  strokeOpacity: 'Stroke opacity',
  shadowBlur: 'Shadow blur',
  shadowY: 'Shadow offset Y',
  shadowOpacity: 'Shadow opacity',
  glossOpacity: 'Gloss opacity'
};

initHaptics();

dropZone.addEventListener('pointerdown', () => {
  triggerHaptic(HAPTIC_PRESETS.uploadPick, { intensity: 0.18 });
});
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  triggerHaptic(HAPTIC_PRESETS.uploadPick, { intensity: 0.18 });
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', (e) => {
  if (e.target.files.length) handleFile(e.target.files[0]);
});
previewDownloadButtons.forEach((button) => {
  button.addEventListener('pointerdown', () => {
    triggerHaptic(HAPTIC_PRESETS.download, { intensity: 0.38 });
  });
});

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.style.display = 'block';
  previewsContainer.style.display = 'none';
  if (outputPlaceholder) outputPlaceholder.style.display = 'block';
  tuningPanel.style.display = 'none';
  triggerHaptic('error', { intensity: 0.5 });
}

function setSeekPercent(seekEl, value, min, max) {
  const pct = max === min ? 0 : ((Number(value) - min) / (max - min)) * 100;
  seekEl.style.setProperty('--value', String(Math.min(100, Math.max(0, pct))));
}

// Initialize UI
initSliders();

// Load default SVG
const defaultSvg = `<svg width="200" height="132" viewBox="0 0 200 132" fill="none" xmlns="http://www.w3.org/2000/svg">
<path fill-rule="evenodd" clip-rule="evenodd" d="M200 0H0V44H83.9675L81.4104 38.7341L86.2646 44H91.7419L90.2731 34.4661L94.8262 44H98.3786L100 33L101.621 44H105.174L109.727 34.4661L108.258 44H113.735L118.59 38.7341L116.032 44H200V0Z" fill="#ED2024"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M83.9675 44H0V88H79.0584L87.0998 76.2876L71.4212 82.5L84.6406 72.0281L67.8274 73.3432L83.5461 67.233L67.0923 63.5339L83.9137 62.3284L69.2812 53.9437L85.7106 57.75L74.1996 45.4248L88.7771 53.9046L83.9675 44ZM80.2831 88H88.0944L90.7052 79.6329L80.2831 88ZM90.9166 88H95.1162L95.1365 81.767L90.9166 88ZM98.3231 88H101.677L100 82.5L98.3231 88ZM104.884 88H109.083L104.863 81.767L104.884 88ZM111.906 88H119.717L109.295 79.6329L111.906 88ZM120.942 88H200V44H116.032L111.223 53.9046L125.8 45.4248L114.289 57.75L130.719 53.9437L116.086 62.3284L132.908 63.5339L116.454 67.233L132.173 73.3432L115.359 72.0281L128.579 82.5L112.9 76.2876L120.942 88ZM113.735 44H108.258L107.159 51.134L113.735 44ZM105.174 44H101.621L102.459 49.6843L105.174 44ZM98.3786 44H94.8262L97.5408 49.6843L98.3786 44ZM91.7419 44H86.2646L92.8409 51.134L91.7419 44Z" fill="white"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M77.5543 90.1907L79.0584 88H0V132H200V88H120.942L122.446 90.1907L119.717 88H111.906L114.318 95.732L109.083 88H104.884L104.918 98.6314L101.677 88H98.3231L95.0816 98.6314L95.1162 88H90.9166L85.6818 95.732L88.0944 88H80.2831L77.5543 90.1907Z" fill="#278E43"/>
<path d="M113.735 44L107.159 51.134L108.258 44L109.727 34.4661L105.174 44L102.459 49.6843L101.621 44L100 33L98.3786 44L97.5408 49.6843L94.8262 44L90.2731 34.4661L91.7419 44L92.8409 51.134L86.2646 44L81.4104 38.7341L83.9675 44L88.7771 53.9046L74.1996 45.4248L85.7106 57.75L69.2812 53.9437L83.9137 62.3284L67.0923 63.5339L83.5461 67.233L67.8274 73.3432L84.6406 72.0281L71.4212 82.5L87.0998 76.2876L79.0584 88L77.5543 90.1907L80.2831 88L90.7052 79.6329L88.0944 88L85.6818 95.732L90.9166 88L95.1365 81.767L95.1162 88L95.0816 98.6314L98.3231 88L100 82.5L101.677 88L104.918 98.6314L104.884 88L104.863 81.767L109.083 88L114.318 95.732L111.906 88L109.295 79.6329L119.717 88L122.446 90.1907L120.942 88L112.9 76.2876L128.579 82.5L115.359 72.0281L132.173 73.3432L116.454 67.233L132.908 63.5339L116.086 62.3284L130.719 53.9437L114.289 57.75L125.8 45.4248L111.223 53.9046L116.032 44L118.59 38.7341L113.735 44Z" fill="#FEBD11"/>
</svg>`;
processSvg(defaultSvg);

/** Normalized flag bitmap size (must match renderVariant FLAG_W / FLAG_H at scale 1). */
const SOURCE_FLAG_W = 420;
const SOURCE_FLAG_H = 280;

const RASTER_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

function isSvgFile(file) {
  const t = (file.type || '').toLowerCase();
  if (t === 'image/svg+xml') return true;
  return /\.svg$/i.test(file.name || '');
}

function isRasterFile(file) {
  const t = (file.type || '').toLowerCase();
  if (RASTER_MIME.includes(t)) return true;
  return /\.(jpe?g|png|webp)$/i.test(file.name || '');
}

function handleFile(file) {
  errorMsg.style.display = 'none';
  if (isSvgFile(file)) {
    const reader = new FileReader();
    reader.onload = (e) => processSvg(e.target.result);
    reader.readAsText(file);
    return;
  }
  if (isRasterFile(file)) {
    processRasterFile(file);
    return;
  }
  showError('Please upload SVG, PNG, JPG, or WebP.');
}

/**
 * Raster images are scaled with object-fit: cover into SOURCE_FLAG_W×SOURCE_FLAG_H,
 * then the existing warp path treats the result like SVG output.
 */
function processRasterFile(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    if (!nw || !nh) {
      return showError('Could not read image dimensions.');
    }
    const canvas = document.createElement('canvas');
    canvas.width = SOURCE_FLAG_W;
    canvas.height = SOURCE_FLAG_H;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = isAntiAliased;
    const scale = Math.max(SOURCE_FLAG_W / nw, SOURCE_FLAG_H / nh);
    const dw = nw * scale;
    const dh = nh * scale;
    const dx = (SOURCE_FLAG_W - dw) / 2;
    const dy = (SOURCE_FLAG_H - dh) / 2;
    ctx.drawImage(img, 0, 0, nw, nh, dx, dy, dw, dh);
    currentImg = canvas;
    clearCaches();
    generateVariants();
    triggerHaptic('success', { intensity: 0.36 });
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    showError('Failed to load image.');
  };
  img.src = url;
}

function processSvg(svgString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const root = doc.documentElement;

  if (root.tagName.toLowerCase() !== 'svg') {
    return showError('Invalid SVG format.');
  }

  // Sanitize: remove scripts and foreignObjects
  const dangerous = root.querySelectorAll('script, foreignObject');
  dangerous.forEach(el => el.remove());

  // Force 3:2 aspect ratio for consistent rendering
  root.setAttribute('width', '420');
  root.setAttribute('height', '280');
  if (!root.hasAttribute('preserveAspectRatio')) {
    root.setAttribute('preserveAspectRatio', 'none');
  }

  const serializer = new XMLSerializer();
  const str = serializer.serializeToString(root);
  const blob = new Blob([str], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const img = new Image();
  img.onload = () => {
    currentImg = img;
    clearCaches();
    generateVariants();
    triggerHaptic('success', { intensity: 0.36 });
    URL.revokeObjectURL(url);
  };
  img.onerror = () => {
    showError('Failed to load SVG into Canvas.');
  };
  img.src = url;
}

function initSliders() {
  const slidersContainer = document.getElementById('sliders');
  slidersContainer.innerHTML = '';

  PARAM_VARIANT_ORDER.forEach((variant, sectionIndex) => {
    const preset = STYLE_PRESETS[variant];
    const details = document.createElement('div');
    details.className = 'param-section accordion';

    const summary = document.createElement('button');
    summary.type = 'button';
    summary.className = 'param-section__summary accordion__title';
    summary.textContent = PARAM_VARIANT_LABEL[variant];
    summary.setAttribute('aria-expanded', 'false');
    summary.addEventListener('click', () => {
      const open = details.classList.toggle('accordion--visible');
      summary.setAttribute('aria-expanded', String(open));
    });

    const dropdown = document.createElement('div');
    dropdown.className = 'accordion__dropdown';

    const dropdownInner = document.createElement('div');
    dropdownInner.className = 'accordion__dropdown-inner';

    const body = document.createElement('div');
    body.className = 'param-section__body';

    Object.keys(preset).forEach(key => {
      const id = `${variant}-${key}`;
      const value = preset[key];

      let min = 0;
      let max = value * 2;
      let step = 0.1;

      if (key === 'wavePhase') {
        min = value - Math.PI;
        max = value + Math.PI;
        step = 0.1;
      } else if (key.includes('Opacity')) {
        step = 0.01;
        if (value === 0) {
          min = -1;
          max = 1;
        }
      } else if (['cornerRadius', 'waveAmplitude', 'lightIntensity', 'shadowBlur', 'shadowY', 'strokeWidth'].includes(key)) {
        step = 1;
        if (value === 0) {
          min = -20;
          max = 20;
        }
      } else {
        if (value === 0) {
          min = -10;
          max = 10;
        }
      }

      const group = document.createElement('div');
      group.className = 'control-group';
      const keyLabel = PARAM_KEY_LABEL[key] ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
      group.innerHTML = `
            <label for="${id}">${keyLabel} <span class="val" id="${id}-val">${Number(value).toFixed(2)}</span></label>
            <div class="seek-control" id="${id}-seek">
              <input type="range" class="interactable" data-type="slider" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}">
              <div class="control__track" aria-hidden="true">
                <div class="control__track-slide">
                  <div class="control__fill"></div>
                  <div class="control__indicator"></div>
                  <div class="control__fill"></div>
                </div>
              </div>
            </div>
          `;

      const input = group.querySelector('input');
      const valSpan = group.querySelector('.val');
      const seek = group.querySelector('.seek-control');

      const syncSeek = () => {
        setSeekPercent(seek, parseFloat(input.value), min, max);
      };

      input.addEventListener('input', (e) => {
        const newVal = parseFloat(e.target.value);
        STYLE_PRESETS[variant][key] = newVal;
        valSpan.textContent = newVal.toFixed(2);
        syncSeek();
        maybeTriggerSliderTick(id, newVal);
        delete variantCaches[variant];
        scheduleVariantRender(variant);
      });
      input.addEventListener('pointerdown', () => {
        syncSeek();
        triggerHaptic(HAPTIC_PRESETS.sliderTick, { intensity: 0.16 });
      });
      input.addEventListener('change', () => {
        triggerHaptic(HAPTIC_PRESETS.sliderSettle, { intensity: 0.24 });
      });
      input.addEventListener('pointerup', () => {
        triggerHaptic(HAPTIC_PRESETS.sliderSettle, { intensity: 0.24 });
      });

      syncSeek();
      body.appendChild(group);
    });

    dropdownInner.appendChild(body);
    dropdown.appendChild(dropdownInner);
    details.appendChild(summary);
    details.appendChild(dropdown);
    slidersContainer.appendChild(details);
  });
}

// Global caches for the animation engine
const variantCaches = {};
let currentScale = 1;
let isAntiAliased = true;

// rAF-based render scheduler: batches slider input into one frame, renders only the changed variant
let _pendingVariant = null;
let _renderRafId = 0;

function scheduleVariantRender(variant) {
  _pendingVariant = variant;
  if (!_renderRafId) {
    _renderRafId = requestAnimationFrame(() => {
      _renderRafId = 0;
      const v = _pendingVariant;
      _pendingVariant = null;
      if (v && currentImg) {
        renderVariant(v, currentImg);
      }
    });
  }
}

function clearCaches() {
  Object.keys(variantCaches).forEach(k => delete variantCaches[k]);
}

// Initialize scale and AA controls
document.querySelectorAll('.scale-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.scale-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    currentScale = parseFloat(e.target.dataset.scale);
    clearCaches();
    if (currentImg) generateVariants();
  });
});

const aaToggle = document.getElementById('aaToggle');
if (aaToggle) {
  aaToggle.addEventListener('click', () => {
    isAntiAliased = !isAntiAliased;
    aaToggle.classList.toggle('active', isAntiAliased);
    aaToggle.setAttribute('aria-pressed', String(isAntiAliased));
    clearCaches();
    if (currentImg) generateVariants();

    // Update trailer text immediately if currently hovering
    if (currentHoverType === 'aa') {
      trailerIcon.innerHTML = getTrailerIcon('aa');
    }
  });
}

function generateVariants() {
  if (!currentImg) return;

  PARAM_VARIANT_ORDER.forEach(variant => {
    renderVariant(variant, currentImg);
  });

  const outputControls = document.getElementById('outputControls');
  if (outputControls) outputControls.style.display = 'flex';
  previewsContainer.style.display = 'grid';
  if (outputPlaceholder) outputPlaceholder.style.display = 'none';
  tuningPanel.style.display = 'block';
}

function renderVariant(variant, img, opts = {}) {
  const W = 512 * currentScale;
  const H = 512 * currentScale;
  const FLAG_W = 420 * currentScale;
  const FLAG_H = 280 * currentScale;
  const FLAG_X = (W - FLAG_W) / 2;
  const FLAG_Y = (H - FLAG_H) / 2;

  const preset = STYLE_PRESETS[variant];
  const pRadius = preset.cornerRadius * currentScale;
  const pStroke = preset.strokeWidth * currentScale;
  const pShadowBlur = preset.shadowBlur * currentScale;
  const pShadowY = preset.shadowY * currentScale;
  const pWaveAmp = preset.waveAmplitude * currentScale;

  // 1. Static Cache Generation (run once per image/slider change)
  if (!variantCaches[variant]) {
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = W;
    srcCanvas.height = H;
    const sCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
    sCtx.imageSmoothingEnabled = isAntiAliased;

    // Draw rounded rect path
    sCtx.beginPath();
    sCtx.roundRect(FLAG_X, FLAG_Y, FLAG_W, FLAG_H, pRadius);
    sCtx.closePath();

    // Clip and draw image
    sCtx.save();
    sCtx.clip();
    sCtx.drawImage(img, FLAG_X, FLAG_Y, FLAG_W, FLAG_H);
    sCtx.restore();

    // Pre-warp Overlays (Gloss, Bevel, Inner Stroke)
    if (variant === 'samsung') {
      sCtx.save();
      sCtx.globalCompositeOperation = 'source-atop';
      const grad = sCtx.createLinearGradient(0, FLAG_Y, 0, FLAG_Y + FLAG_H);
      grad.addColorStop(0, `rgba(255,255,255,${preset.glossOpacity})`);
      grad.addColorStop(0.3, `rgba(255,255,255,0)`);
      grad.addColorStop(0.7, `rgba(0,0,0,0)`);
      grad.addColorStop(1, `rgba(0,0,0,0.15)`);
      sCtx.fillStyle = grad;
      sCtx.fillRect(FLAG_X, FLAG_Y, FLAG_W, FLAG_H);
      sCtx.restore();
    } else if (variant === 'google') {
      sCtx.save();
      sCtx.globalCompositeOperation = 'source-atop';
      const grad = sCtx.createLinearGradient(0, FLAG_Y, 0, FLAG_Y + FLAG_H);
      grad.addColorStop(0, `rgba(255,255,255,${preset.glossOpacity})`);
      grad.addColorStop(1, `rgba(0,0,0,${preset.glossOpacity * 0.6})`);
      sCtx.fillStyle = grad;
      sCtx.fillRect(FLAG_X, FLAG_Y, FLAG_W, FLAG_H);
      sCtx.restore();
    }

    // Draw inner stroke directly on source so it warps perfectly
    if (variant === 'samsung') {
      sCtx.save();
      sCtx.beginPath();
      sCtx.roundRect(FLAG_X, FLAG_Y, FLAG_W, FLAG_H, pRadius);
      sCtx.lineWidth = pStroke * 2;
      const strokeGrad = sCtx.createLinearGradient(0, FLAG_Y, 0, FLAG_Y + FLAG_H);
      strokeGrad.addColorStop(0, `rgba(255,255,255,0.4)`);
      strokeGrad.addColorStop(0.1, `rgba(255,255,255,0.05)`);
      strokeGrad.addColorStop(0.9, `rgba(0,0,0,0.1)`);
      strokeGrad.addColorStop(1, `rgba(0,0,0,0.5)`);
      sCtx.strokeStyle = strokeGrad;
      sCtx.clip();
      sCtx.stroke();
      sCtx.restore();
    } else if (variant === 'whatsapp') {
      sCtx.save();
      sCtx.beginPath();
      sCtx.roundRect(FLAG_X, FLAG_Y, FLAG_W, FLAG_H, pRadius);
      sCtx.lineWidth = pStroke * 2;
      sCtx.clip();

      const strokeGrad = sCtx.createLinearGradient(0, FLAG_Y, 0, FLAG_Y + FLAG_H);
      strokeGrad.addColorStop(0, `rgba(255,255,255,0.8)`);
      strokeGrad.addColorStop(0.05, `rgba(0,0,0,0.1)`);
      strokeGrad.addColorStop(1, `rgba(0,0,0,${preset.innerStrokeOpacity})`);
      sCtx.strokeStyle = strokeGrad;
      sCtx.stroke();
      sCtx.restore();
    } else if (preset.innerStrokeOpacity > 0 || preset.strokeOpacity > 0) {
      const opacity = preset.innerStrokeOpacity || preset.strokeOpacity;
      sCtx.save();
      sCtx.beginPath();
      sCtx.roundRect(FLAG_X, FLAG_Y, FLAG_W, FLAG_H, pRadius);
      sCtx.lineWidth = pStroke * 2;
      sCtx.strokeStyle = `rgba(0,0,0,${opacity})`;
      sCtx.clip();
      sCtx.stroke();
      sCtx.restore();
    }

    const warpCanvas = document.createElement('canvas');
    warpCanvas.width = W;
    warpCanvas.height = H;
    const wCtx = warpCanvas.getContext('2d', { willReadFrequently: true });

    variantCaches[variant] = {
      srcCanvas,
      srcData: sCtx.getImageData(0, 0, W, H).data,
      warpCanvas,
      wCtx,
      destImgData: wCtx.createImageData(W, H),
      xMath: new Float32Array(W * 2),
      destU32: null
    };
    variantCaches[variant].destU32 = new Uint32Array(variantCaches[variant].destImgData.data.buffer);
  }

  const cache = variantCaches[variant];
  const { srcCanvas, srcData, warpCanvas, wCtx, destImgData, xMath, destU32 } = cache;
  const destData = destImgData.data;

  // 2. Warp Canvas
  if (variant === 'twitter') {
    wCtx.drawImage(srcCanvas, 0, 0);
  } else {
    const isHuawei = variant === 'huawei';
    const twoPiFreq = Math.PI * 2 * preset.waveFrequency;
    const phaseTotal = preset.wavePhase + animationPhaseOffset;
    const lightI = preset.lightIntensity;
    const invFlagW = 1 / FLAG_W;
    const Hm1 = H - 1;
    const W4 = W * 4;

    for (let x = 0; x < W; x++) {
      const nx = (x - FLAG_X) * invFlagW;
      let dy = 0;
      let light = 0;

      if (nx >= 0 && nx <= 1) {
        const angle = nx * twoPiFreq + phaseTotal;
        const sinA = Math.sin(angle);
        const cosA = Math.cos(angle);

        if (variant === 'apple') {
          dy = sinA * pWaveAmp;
          light = (-cosA * 0.7 - sinA * 0.3 - Math.pow(nx, 20) * 1.2) * lightI;
        } else if (variant === 'samsung') {
          dy = -sinA * pWaveAmp;
          light = Math.sin(angle - 0.7853981633974483) * lightI;
        } else if (variant === 'google') {
          dy = sinA * pWaveAmp;
          light = -cosA * lightI;
        } else if (variant === 'whatsapp') {
          dy = sinA * pWaveAmp;
          light = -sinA * lightI;
        }
      }
      const off = x << 1;
      xMath[off] = dy;
      xMath[off | 1] = light;
    }

    // Zero the entire dest buffer via the Uint32 view (faster than per-byte)
    destU32.fill(0);

    const invFlagH = 1 / FLAG_H;

    for (let y = 0; y < H; y++) {
      const rowOff = y * W4;
      const ny = (y - FLAG_Y) * invFlagH;

      for (let x = 0; x < W; x++) {
        const off = x << 1;
        let dy = xMath[off];
        let light = xMath[off | 1];

        if (isHuawei) {
          const nx = (x - FLAG_X) * invFlagW;
          if (nx >= 0 && nx <= 1) {
            const huaweiAngle = (nx + ny * 0.15) * twoPiFreq + phaseTotal;
            const sinH = Math.sin(huaweiAngle);
            dy = 0;
            light = sinH * lightI * (0.375 - 0.125 * sinH);
          }
        }

        const srcY = y - dy;

        if (srcY >= 0 && srcY < Hm1) {
          const y1 = srcY | 0;
          const fy = srcY - y1;
          const ify = 1 - fy;

          const idx1 = (y1 * W + x) << 2;
          const idx2 = idx1 + W4;
          const destIdx = rowOff + (x << 2);

          const a1 = srcData[idx1 + 3];
          const a2 = srcData[idx2 + 3];
          const outAlpha = a1 * ify + a2 * fy;

          if (outAlpha > 0) {
            let v;
            v = srcData[idx1] * ify + srcData[idx2] * fy + light;
            destData[destIdx] = v > 255 ? 255 : v < 0 ? 0 : v;
            v = srcData[idx1 + 1] * ify + srcData[idx2 + 1] * fy + light;
            destData[destIdx + 1] = v > 255 ? 255 : v < 0 ? 0 : v;
            v = srcData[idx1 + 2] * ify + srcData[idx2 + 2] * fy + light;
            destData[destIdx + 2] = v > 255 ? 255 : v < 0 ? 0 : v;
            destData[destIdx + 3] = outAlpha;
          }
        }
      }
    }
    wCtx.putImageData(destImgData, 0, 0);
  }

  // 3. Final Canvas (Shadows, Downscale)
  const finalCanvas = opts.targetCanvas ?? document.getElementById(`preview-${variant}`);
  finalCanvas.width = 256 * currentScale;
  finalCanvas.height = 256 * currentScale;
  const fCtx = finalCanvas.getContext('2d');
  fCtx.imageSmoothingEnabled = isAntiAliased;
  fCtx.clearRect(0, 0, finalCanvas.width, finalCanvas.height);

  const drawWarp = () => {
    fCtx.drawImage(warpCanvas, 0, 0, W, H, 0, 0, finalCanvas.width, finalCanvas.height);
  };

  if (!opts.omitShadow && preset.shadowOpacity > 0) {
    fCtx.save();
    fCtx.shadowColor = `rgba(0,0,0,${preset.shadowOpacity})`;
    fCtx.shadowBlur = pShadowBlur;
    fCtx.shadowOffsetY = pShadowY;
    drawWarp();
    fCtx.restore();
  } else {
    drawWarp();
  }
}

let gifencModule = null;

async function loadGifenc() {
  if (!gifencModule) {
    gifencModule = await import('https://unpkg.com/gifenc@1.0.3/dist/gifenc.esm.js');
  }
  return gifencModule;
}

function downloadPng(variant) {
  if (isAnimated) {
    downloadGif(variant);
    return;
  }
  const canvas = document.getElementById(`preview-${variant}`);
  if (!canvas) return;
  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = `flag-${variant}-style.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
window.downloadPng = downloadPng;

let gifFrameWorker = null;
let gifFrameWorkerBroken = false;

function getGifFrameWorker() {
  if (gifFrameWorkerBroken) return null;
  if (gifFrameWorker) return gifFrameWorker;
  try {
    gifFrameWorker = new Worker(new URL('./gif-export-worker.js', import.meta.url), { type: 'module' });
    return gifFrameWorker;
  } catch {
    gifFrameWorkerBroken = true;
    return null;
  }
}

function runGifFrameWorker(buffer, width, height, quantizeOpts) {
  const w = getGifFrameWorker();
  if (!w) return Promise.reject(new Error('Worker unavailable'));
  return new Promise((resolve, reject) => {
    const onMessage = (e) => {
      w.removeEventListener('message', onMessage);
      w.removeEventListener('error', onError);
      if (!e.data.ok) reject(new Error(e.data.error));
      else resolve(e.data);
    };
    const onError = (err) => {
      w.removeEventListener('message', onMessage);
      w.removeEventListener('error', onError);
      reject(err);
    };
    w.addEventListener('message', onMessage);
    w.addEventListener('error', onError);
    const transferable = buffer.slice(0);
    w.postMessage({ buffer: transferable, width, height, quantizeOpts }, [transferable]);
  });
}

async function processGifFrameForExport(imageData, width, height, quantizeOpts) {
  const pixels = new Uint8ClampedArray(imageData.data);
  const w = getGifFrameWorker();
  if (w) {
    try {
      return await runGifFrameWorker(pixels.buffer, width, height, quantizeOpts);
    } catch {
      gifFrameWorkerBroken = true;
      if (gifFrameWorker) {
        gifFrameWorker.terminate();
        gifFrameWorker = null;
      }
    }
  }
  const { processGifFramePixels } = await import('./gif-export-frame.js');
  return processGifFramePixels(pixels, width, height, quantizeOpts);
}

async function downloadGif(variant) {
  const card = document.getElementById(`card-${variant}`);
  const header = card.querySelector('h3');
  const originalText = header.textContent;
  header.textContent = 'Exporting…';

  try {
    const { GIFEncoder } = await loadGifenc();

    const GIF_SIZE = 256 * currentScale;
    const TOTAL_FRAMES = 30;
    const FRAME_DELAY = Math.round(1000 / 30);

    const savedOffset = animationPhaseOffset;
    const wasAnimated = isAnimated;
    isAnimated = false;

    const gif = GIFEncoder();

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = GIF_SIZE;
    exportCanvas.height = GIF_SIZE;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = GIF_SIZE;
    tempCanvas.height = GIF_SIZE;
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    tempCtx.imageSmoothingEnabled = isAntiAliased;

    const quantizeOpts = {
      format: 'rgba4444',
      oneBitAlpha: 127,
      clearAlpha: true,
      clearAlphaThreshold: 127,
      clearAlphaColor: 0,
      useSqrt: true
    };

    for (let i = 0; i < TOTAL_FRAMES; i++) {
      animationPhaseOffset = (i / TOTAL_FRAMES) * Math.PI * 2;
      renderVariant(variant, currentImg, { targetCanvas: exportCanvas, omitShadow: true });

      tempCtx.clearRect(0, 0, GIF_SIZE, GIF_SIZE);
      tempCtx.drawImage(exportCanvas, 0, 0);

      const imageData = tempCtx.getImageData(0, 0, GIF_SIZE, GIF_SIZE);
      const { index, palette, transparentIndex } = await processGifFrameForExport(
        imageData,
        GIF_SIZE,
        GIF_SIZE,
        quantizeOpts
      );

      const frameOpts = {
        palette,
        delay: FRAME_DELAY,
        ...(i === 0 ? { repeat: 0 } : {})
      };
      if (transparentIndex >= 0) {
        frameOpts.transparent = true;
        frameOpts.transparentIndex = transparentIndex;
      }
      gif.writeFrame(index, GIF_SIZE, GIF_SIZE, frameOpts);

      if (i % 5 === 0) {
        await new Promise(r => setTimeout(r, 0));
      }
    }

    gif.finish();
    const output = gif.bytes();
    const blob = new Blob([output], { type: 'image/gif' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flag-${variant}-style.gif`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    animationPhaseOffset = savedOffset;
    isAnimated = wasAnimated;
    if (isAnimated) {
      lastAnimTime = performance.now();
      requestAnimationFrame(animateLoop);
    } else {
      generateVariants();
    }
  } catch (err) {
    console.error('GIF export failed:', err);
  } finally {
    header.textContent = originalText;
  }
}

// Custom Cursor Logic
const trailer = document.getElementById("trailer");
const trailerIcon = document.getElementById("trailer-icon");
let currentHoverType = "";

const animateTrailer = (e, interacting) => {
  // Offset by 12px so it acts like a "petal" to the bottom-right of the real cursor
  const x = e.clientX + 12;
  const y = e.clientY + 12;
  const scale = interacting ? 3.5 : 1;

  trailer.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
};

const getTrailerIcon = type => {
  switch (type) {
    case "slider":
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3L4 7l4 4"/><path d="M4 7h16"/><path d="M16 21l4-4-4-4"/><path d="M20 17H4"/></svg>`;
    case "download":
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
    case "upload":
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`;
    case "refresh":
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`;
    case "aa":
      return `<span style="font-family: var(--font-display); font-weight: bold; font-size: 5px; text-transform: uppercase; letter-spacing: 0.05em;">${isAntiAliased ? 'on' : 'off'}</span>`;
    default:
      return "";
  }
};

window.addEventListener("mousemove", e => {
  const interactable = e.target.closest(".interactable");
  const interacting = interactable !== null;
  animateTrailer(e, interacting);

  const newType = interacting ? interactable.dataset.type : "";

  if (newType !== currentHoverType) {
    currentHoverType = newType;
    trailer.dataset.type = newType;
    if (interacting) {
      trailerIcon.innerHTML = getTrailerIcon(newType);
    }
  }
});

