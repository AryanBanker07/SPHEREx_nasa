/**
 * High-Performance Time-Series Blink Comparator Engine.
 * Handles sub-pixel canvas rendering, frame animation loop, difference display,
 * inverted contrast mode, reticle crosshair overlay, and pixel coordinate tracking.
 */

class SkyBlinker {
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    
    this.epochs = [];
    this.currentIndex = 0;
    this.isPlaying = true;
    this.fps = 2.0;
    this.timerId = null;

    this.displayMode = 'normal'; // 'normal', 'inverted', 'difference', 'coadd'
    this.differenceData = null;
    this.coaddData = null;

    this.loadedImages = {
      normal: [],
      inverted: [],
      difference: null,
      coadd: null
    };

    this.wcsHeader = null;
    this.raCenter = 0;
    this.decCenter = 0;
    this.pixelScale = 6.2; // arcsec/pixel

    this.mousePos = { x: -1, y: -1, inCanvas: false };
    this.onEpochChange = options.onEpochChange || null;
    this.onPixelHover = options.onPixelHover || null;
    this.onPixelClick = options.onPixelClick || null;

    this._setupListeners();
  }

  loadData(cubeData, diffData = null, coaddData = null) {
    this.stop();
    this.epochs = cubeData.epochs || [];
    this.raCenter = cubeData.ra;
    this.decCenter = cubeData.dec;
    this.pixelScale = cubeData.pixel_scale || 6.2;
    this.wcsHeader = cubeData.wcs_header;
    this.differenceData = diffData;
    this.coaddData = coaddData;

    this.loadedImages.normal = [];
    this.loadedImages.inverted = [];
    this.loadedImages.difference = null;
    this.loadedImages.coadd = null;

    let loadedCount = 0;
    const totalToLoad = this.epochs.length * 2 + (diffData ? 1 : 0) + (coaddData ? 1 : 0);

    const checkComplete = () => {
      loadedCount++;
      if (loadedCount >= totalToLoad) {
        this.currentIndex = 0;
        this.render();
        this.start();
      }
    };

    // Preload all epoch frames
    this.epochs.forEach((ep, i) => {
      const imgNorm = new Image();
      imgNorm.onload = checkComplete;
      imgNorm.src = 'data:image/png;base64,' + ep.image_b64;
      this.loadedImages.normal[i] = imgNorm;

      const imgInv = new Image();
      imgInv.onload = checkComplete;
      imgInv.src = 'data:image/png;base64,' + ep.invert_b64;
      this.loadedImages.inverted[i] = imgInv;
    });

    if (diffData && diffData.difference_b64) {
      const imgDiff = new Image();
      imgDiff.onload = checkComplete;
      imgDiff.src = 'data:image/png;base64,' + diffData.difference_b64;
      this.loadedImages.difference = imgDiff;
    }

    if (coaddData && coaddData.coadd_b64) {
      const imgCoadd = new Image();
      imgCoadd.onload = checkComplete;
      imgCoadd.src = 'data:image/png;base64,' + coaddData.coadd_b64;
      this.loadedImages.coadd = imgCoadd;
    }
  }

  start() {
    this.stop();
    if (this.epochs.length <= 1 && this.displayMode === 'normal') return;
    this.isPlaying = true;
    const interval = Math.max(100, Math.round(1000 / this.fps));
    this.timerId = setInterval(() => {
      if (this.displayMode === 'normal' || this.displayMode === 'inverted') {
        this.currentIndex = (this.currentIndex + 1) % this.epochs.length;
        this.render();
        if (this.onEpochChange) this.onEpochChange(this.epochs[this.currentIndex], this.currentIndex);
      }
    }, interval);
  }

  stop() {
    this.isPlaying = false;
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  setFps(fps) {
    this.fps = Math.max(0.2, Math.min(fps, 10.0));
    if (this.isPlaying) {
      this.start();
    }
  }

  setDisplayMode(mode) {
    this.displayMode = mode;
    this.render();
  }

  stepForward() {
    this.stop();
    this.currentIndex = (this.currentIndex + 1) % this.epochs.length;
    this.render();
    if (this.onEpochChange) this.onEpochChange(this.epochs[this.currentIndex], this.currentIndex);
  }

  stepBackward() {
    this.stop();
    this.currentIndex = (this.currentIndex - 1 + this.epochs.length) % this.epochs.length;
    this.render();
    if (this.onEpochChange) this.onEpochChange(this.epochs[this.currentIndex], this.currentIndex);
  }

  goToEpoch(index) {
    if (index >= 0 && index < this.epochs.length) {
      this.currentIndex = index;
      this.render();
      if (this.onEpochChange) this.onEpochChange(this.epochs[this.currentIndex], this.currentIndex);
    }
  }

  render() {
    const width = this.canvas.width;
    const height = this.canvas.height;
    this.ctx.clearRect(0, 0, width, height);

    let activeImage = null;

    if (this.displayMode === 'difference' && this.loadedImages.difference) {
      activeImage = this.loadedImages.difference;
    } else if (this.displayMode === 'coadd' && this.loadedImages.coadd) {
      activeImage = this.loadedImages.coadd;
    } else if (this.displayMode === 'inverted') {
      activeImage = this.loadedImages.inverted[this.currentIndex];
    } else {
      activeImage = this.loadedImages.normal[this.currentIndex];
    }

    if (activeImage && activeImage.complete && activeImage.naturalWidth > 0) {
      // Draw smooth or crisp pixelated
      this.ctx.imageSmoothingEnabled = false;
      this.ctx.drawImage(activeImage, 0, 0, width, height);
    } else {
      // Placeholder while loading
      this.ctx.fillStyle = '#0a0d14';
      this.ctx.fillRect(0, 0, width, height);
      this.ctx.fillStyle = '#64748b';
      this.ctx.font = '14px Inter, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('Preparing SPHEREx Near-IR Cutout...', width / 2, height / 2);
      return;
    }

    // Draw Crosshair & Target Reticle
    this._drawReticle(width, height);

    // If mouse is inside canvas, draw hovering crosshair
    if (this.mousePos.inCanvas) {
      this._drawMouseCrosshair(width, height);
    }
  }

  _drawReticle(width, height) {
    const cx = width / 2;
    const cy = height / 2;
    const r = 18;

    this.ctx.save();
    this.ctx.strokeStyle = this.displayMode === 'inverted' ? 'rgba(220, 38, 38, 0.7)' : 'rgba(56, 189, 248, 0.7)';
    this.ctx.lineWidth = 1.2;

    // Center circular reticle
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    this.ctx.stroke();

    // 4 crosshair tics
    this.ctx.beginPath();
    this.ctx.moveTo(cx - r - 8, cy);
    this.ctx.lineTo(cx - r + 3, cy);
    this.ctx.moveTo(cx + r - 3, cy);
    this.ctx.lineTo(cx + r + 8, cy);
    this.ctx.moveTo(cx, cy - r - 8);
    this.ctx.lineTo(cx, cy - r + 3);
    this.ctx.moveTo(cx, cy + r - 3);
    this.ctx.lineTo(cx, cy + r + 8);
    this.ctx.stroke();

    this.ctx.restore();
  }

  _drawMouseCrosshair(width, height) {
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
    this.ctx.lineWidth = 0.8;
    this.ctx.setLineDash([4, 4]);

    this.ctx.beginPath();
    this.ctx.moveTo(this.mousePos.x, 0);
    this.ctx.lineTo(this.mousePos.x, height);
    this.ctx.moveTo(0, this.mousePos.y);
    this.ctx.lineTo(width, this.mousePos.y);
    this.ctx.stroke();

    this.ctx.restore();
  }

  _setupListeners() {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      this.mousePos.x = (e.clientX - rect.left) * scaleX;
      this.mousePos.y = (e.clientY - rect.top) * scaleY;
      this.mousePos.inCanvas = true;

      // Calculate approximate celestial coordinates
      const npix = this.canvas.width;
      const dx_px = this.mousePos.x - (npix / 2);
      const dy_px = (npix / 2) - this.mousePos.y; // Y is inverted

      const d_ra_deg = -(dx_px * this.pixelScale) / 3600.0 / Math.cos(this.decCenter * Math.PI / 180.0);
      const d_dec_deg = (dy_px * this.pixelScale) / 3600.0;

      const cursorRA = this.raCenter + d_ra_deg;
      const cursorDec = this.decCenter + d_dec_deg;

      if (this.onPixelHover) {
        this.onPixelHover({
          pixelX: Math.round(this.mousePos.x),
          pixelY: Math.round(this.mousePos.y),
          ra: cursorRA,
          dec: cursorDec
        });
      }
      this.render();
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.mousePos.inCanvas = false;
      this.render();
    });

    this.canvas.addEventListener('click', () => {
      if (this.onPixelClick && this.mousePos.inCanvas) {
        this.onPixelClick({
          pixelX: this.mousePos.x,
          pixelY: this.mousePos.y
        });
      }
    });
  }
}

window.SkyBlinker = SkyBlinker;

