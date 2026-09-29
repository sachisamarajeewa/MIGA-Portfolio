(function () {
  'use strict';

  const TOTAL_FRAMES = 148;
  const FOLDER_PATH = 'ezgif-11519c5d414ac143-png-split';
  const LERP_FACTOR = 0.15; // Smooth Apple-like inertia

  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  const loader = document.getElementById('loader');
  const loaderBar = document.getElementById('loaderBar');
  const navbar = document.getElementById('navbar');

  const images = new Array(TOTAL_FRAMES);
  const loaded = new Uint8Array(TOTAL_FRAMES);

  let currentFrameFloat = 0;
  let targetFrameFloat = 0;
  let lastDrawnIndex = -1;
  let loadedCount = 0;
  let isInitialFrameDrawn = false;

  function getFrameUrl(index) {
    const frameNum = String(index + 1).padStart(3, '0');
    return `${FOLDER_PATH}/ezgif-frame-${frameNum}.png`;
  }

  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const displayWidth = window.innerWidth;
    const displayHeight = window.innerHeight;

    const newW = Math.round(displayWidth * dpr);
    const newH = Math.round(displayHeight * dpr);

    if (canvas.width !== newW || canvas.height !== newH) {
      canvas.width = newW;
      canvas.height = newH;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      drawFrame(Math.round(currentFrameFloat), true);
    }
  }

  function findNearestLoadedFrame(targetIdx) {
    if (loaded[targetIdx]) return targetIdx;
    for (let offset = 1; offset < TOTAL_FRAMES; offset++) {
      const prev = targetIdx - offset;
      if (prev >= 0 && loaded[prev]) return prev;
      const next = targetIdx + offset;
      if (next < TOTAL_FRAMES && loaded[next]) return next;
    }
    return -1;
  }

  function drawFrame(frameIndex, force = false) {
    const renderIndex = findNearestLoadedFrame(frameIndex);
    if (renderIndex === -1) return;
    if (!force && renderIndex === lastDrawnIndex) return;

    const img = images[renderIndex];
    if (!img) return;

    const imgW = img.naturalWidth || 3840;
    const imgH = img.naturalHeight || 2160;
    const imgAspect = imgW / imgH;
    const canvasAspect = canvas.width / canvas.height;

    let drawW, drawH, drawX, drawY;

    if (canvasAspect > imgAspect) {
      drawW = canvas.width;
      drawH = canvas.width / imgAspect;
      drawX = 0;
      drawY = (canvas.height - drawH) / 2;
    } else {
      drawH = canvas.height;
      drawW = canvas.height * imgAspect;
      drawX = (canvas.width - drawW) / 2;
      drawY = 0;
    }

    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    lastDrawnIndex = renderIndex;
  }

  function getScrollProgress() {
    const html = document.documentElement;
    const body = document.body;

    const scrollTop = window.pageYOffset || html.scrollTop || body.scrollTop || 0;
    const scrollHeight = Math.max(
      html.scrollHeight,
      body.scrollHeight,
      html.offsetHeight,
      body.offsetHeight
    );
    const clientHeight = window.innerHeight || html.clientHeight;
    const maxScroll = scrollHeight - clientHeight;

    if (maxScroll <= 0) return 0;
    return Math.min(1, Math.max(0, scrollTop / maxScroll));
  }

  function updateScrollTarget() {
    const progress = getScrollProgress();
    targetFrameFloat = progress * (TOTAL_FRAMES - 1);

    // Navbar state update
    if (navbar) {
      if (window.scrollY > 40) {
        navbar.style.background = 'rgba(2, 6, 15, 0.88)';
        navbar.style.borderBottomColor = 'rgba(255, 255, 255, 0.12)';
      } else {
        navbar.style.background = 'rgba(2, 7, 18, 0.45)';
        navbar.style.borderBottomColor = 'rgba(255, 255, 255, 0.07)';
      }
    }
  }

  function animationLoop() {
    updateScrollTarget();

    const diff = targetFrameFloat - currentFrameFloat;

    if (Math.abs(diff) > 0.005) {
      currentFrameFloat += diff * LERP_FACTOR;
      drawFrame(Math.round(currentFrameFloat));
    } else if (currentFrameFloat !== targetFrameFloat) {
      currentFrameFloat = targetFrameFloat;
      drawFrame(Math.round(currentFrameFloat));
    }

    requestAnimationFrame(animationLoop);
  }

  function updateLoader() {
    const percent = Math.round((loadedCount / TOTAL_FRAMES) * 100);
    loaderBar.style.width = `${percent}%`;

    if (loadedCount >= TOTAL_FRAMES) {
      setTimeout(() => {
        loader.classList.add('loaded');
      }, 350);
    }
  }

  function loadImage(index) {
    if (images[index]) {
      return Promise.resolve(images[index]);
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';

      const finish = () => {
        images[index] = img;
        loaded[index] = 1;
        loadedCount++;
        updateLoader();

        const currentTarget = Math.round(currentFrameFloat);
        const prevDistance = lastDrawnIndex >= 0 ? Math.abs(lastDrawnIndex - currentTarget) : 999;
        const newDistance = Math.abs(index - currentTarget);

        if (newDistance < prevDistance || !isInitialFrameDrawn) {
          isInitialFrameDrawn = true;
          drawFrame(currentTarget, true);
        }
        resolve(img);
      };

      img.onload = finish;
      img.onerror = () => {
        loadedCount++;
        updateLoader();
        resolve(null);
      };

      img.src = getFrameUrl(index);
    });
  }

  async function preloadAll() {
    // 1. Immediately load frame 0 for instant display
    await loadImage(0);

    // 2. Load keyframes (every 4th frame) to quickly cover the whole scroll range
    const keyframes = [];
    for (let i = 4; i < TOTAL_FRAMES; i += 4) {
      keyframes.push(i);
    }
    if (keyframes[keyframes.length - 1] !== TOTAL_FRAMES - 1) {
      keyframes.push(TOTAL_FRAMES - 1);
    }

    // 3. Load remaining intermediate frames
    const remaining = [];
    for (let i = 1; i < TOTAL_FRAMES; i++) {
      if (i % 4 !== 0 && i !== TOTAL_FRAMES - 1) {
        remaining.push(i);
      }
    }

    const queue = [...keyframes, ...remaining];
    const CONCURRENCY = 8;
    let queueIdx = 0;

    async function worker() {
      while (queueIdx < queue.length) {
        const nextIdx = queue[queueIdx++];
        if (!loaded[nextIdx]) {
          await loadImage(nextIdx);
        }
      }
    }

    const workers = [];
    for (let i = 0; i < CONCURRENCY; i++) {
      workers.push(worker());
    }
    await Promise.all(workers);
  }

  // Handle immediate demand when user scrolls to an unloaded area
  function requestFramesNear(targetIdx) {
    const radius = 4;
    for (let offset = 0; offset <= radius; offset++) {
      const f1 = targetIdx + offset;
      const f2 = targetIdx - offset;
      if (f1 < TOTAL_FRAMES && !loaded[f1] && !images[f1]) loadImage(f1);
      if (f2 >= 0 && !loaded[f2] && !images[f2]) loadImage(f2);
    }
  }

  function onScroll() {
    updateScrollTarget();
    requestFramesNear(Math.round(targetFrameFloat));
  }

  // Smooth navigation links
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId && targetId !== '#') {
        const targetElem = document.querySelector(targetId);
        if (targetElem) {
          e.preventDefault();
          targetElem.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  });

  // Event Listeners
  window.addEventListener('resize', resizeCanvas, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('scroll', onScroll, { passive: true });

  // Keyboard navigation support
  window.addEventListener('keydown', (e) => {
    const scrollStep = window.innerHeight * 0.45;
    if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
      window.scrollBy({ top: scrollStep, behavior: 'smooth' });
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      window.scrollBy({ top: -scrollStep, behavior: 'smooth' });
    } else if (e.key === 'Home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (e.key === 'End') {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }
  });

  // Initialize
  resizeCanvas();
  updateScrollTarget();
  preloadAll();
  requestAnimationFrame(animationLoop);
})();
