/**
 * Zooniverse Subject Viewer & SPHEREx Multi-Epoch Blinker Engine.
 * Supports:
 * - Multi-epoch blinking & stepping (Normal, Inverted, False-Color RGB, Difference, Coadd)
 * - Interactive Zoom (1x to 8x) & Drag Pan
 * - Brightness / Contrast / Stretch adjustment
 * - Interactive Citizen Science Candidate Markers (#1, #2...) + Spectrum Click Extraction
 * - Celestial WCS Grid, Gaia DR3 Proper Motion Vectors, & Level-2 Contamination Flags Overlays
 * - Synchronized 2-Up Split Compare Rendering
 */

class SkyBlinker {
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');

    this.splitCanvasA = options.splitCanvasA || null;
    this.splitCanvasB = options.splitCanvasB || null;

    this.epochs = [];
    this.currentIndex = 0;
    this.isPlaying = true;
    this.fps = 2.0;
    this.timerId = null;

    this.displayMode = 'normal'; // 'normal', 'inverted', 'rgb', 'difference', 'coadd'
    this.activeTool = 'inspect'; // 'inspect', 'mark', 'pan'

    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };

    this.brightness = 100; // %
    this.contrast = 100;   // %

    this.showGrid = true;
    this.showFlags = true;
    this.showGaia = false;

    this.markers = []; // { id, dataX, dataY, ra, dec, epochLabel }
    this.selectedPixel = null; // { dataX, dataY }

    this.loadedImages = {
      normal: [],
      inverted: [],
      rgb: [],
      difference: null,
      coadd: null
    };

    this.cubeData = null;
    this.differenceData = null;
    this.coaddData = null;
    this.raCenter = 0;
    this.decCenter = 0;
    this.npix = 77;
    this.pixelScale = 6.2;

    this.mousePos = { x: -1, y: -1, inCanvas: false };
    this.onEpochChange = options.onEpochChange || null;
    this.onPixelHover = options.onPixelHover || null;
    this.onPixelClick = options.onPixelClick || null;
    this.onMarkersChange = options.onMarkersChange || null;

    this._setupListeners();
  }

  loadData(cubeData, diffData = null, coaddData = null, resetView = true) {
    this.stop();
    this.cubeData = cubeData;
    this.epochs = cubeData.epochs || [];
    this.raCenter = cubeData.ra;
    this.decCenter = cubeData.dec;
    this.npix = cubeData.npix || 77;
    this.pixelScale = cubeData.pixel_scale || 6.2;
    this.differenceData = diffData;
    this.coaddData = coaddData;

    if (resetView) {
      this.zoom = 1.0;
      this.panX = 0;
      this.panY = 0;
      this.markers = [];
      this.selectedPixel = null;
      if (this.onMarkersChange) this.onMarkersChange(this.markers);
    }

    this.loadedImages = {
      normal: [],
      inverted: [],
      rgb: [],
      difference: null,
      coadd: null
    };

    let pending = 0;
    const onImgDone = () => {
      pending--;
      if (pending <= 0) {
        this.currentIndex = Math.min(this.currentIndex, Math.max(0, this.epochs.length - 1));
        this.render();
        if (this.onEpochChange && this.epochs[this.currentIndex]) {
          this.onEpochChange(this.epochs[this.currentIndex], this.currentIndex);
        }
        this.start();
      }
    };

    const loadB64 = (b64, assignFn) => {
      if (!b64) return;
      pending++;
      const img = new Image();
      img.onload = onImgDone;
      img.onerror = onImgDone;
      img.src = 'data:image/png;base64,' + b64;
      assignFn(img);
    };

    this.epochs.forEach((ep, i) => {
      loadB64(ep.image_b64, (img) => { this.loadedImages.normal[i] = img; });
      loadB64(ep.invert_b64, (img) => { this.loadedImages.inverted[i] = img; });
      loadB64(ep.rgb_b64 || ep.image_b64, (img) => { this.loadedImages.rgb[i] = img; });
    });

    if (diffData && diffData.difference_b64) {
      loadB64(diffData.difference_b64, (img) => { this.loadedImages.difference = img; });
    }
    if (coaddData && coaddData.coadd_b64) {
      loadB64(coaddData.coadd_b64, (img) => { this.loadedImages.coadd = img; });
    }

    if (pending === 0) {
      this.render();
    }
  }

  updateDifferenceImage(diffData) {
    this.differenceData = diffData;
    if (diffData && diffData.difference_b64) {
      const img = new Image();
      img.onload = () => {
        this.loadedImages.difference = img;
        this.render();
      };
      img.src = 'data:image/png;base64,' + diffData.difference_b64;
    }
  }

  start() {
    this.stop();
    if (this.epochs.length <= 1) return;
    this.isPlaying = true;
    const interval = Math.max(110, Math.round(1000 / this.fps));
    this.timerId = setInterval(() => {
      if (this.displayMode !== 'difference' && this.displayMode !== 'coadd') {
        this.currentIndex = (this.currentIndex + 1) % this.epochs.length;
        this.render();
        if (this.onEpochChange) {
          this.onEpochChange(this.epochs[this.currentIndex], this.currentIndex);
        }
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
    this.fps = Math.max(0.25, Math.min(fps, 10.0));
    if (this.isPlaying) this.start();
  }

  setDisplayMode(mode) {
    this.displayMode = mode;
    this.render();
  }

  setActiveTool(tool) {
    this.activeTool = tool;
    if (tool === 'pan') this.canvas.style.cursor = 'grab';
    else if (tool === 'mark') this.canvas.style.cursor = 'cell';
    else this.canvas.style.cursor = 'crosshair';
  }

  zoomBy(factor) {
    this.zoom = Math.max(1.0, Math.min(8.0, this.zoom * factor));
    if (this.zoom === 1.0) {
      this.panX = 0;
      this.panY = 0;
    }
    this.render();
  }

  resetView() {
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.brightness = 100;
    this.contrast = 100;
    this.render();
  }

  stepForward() {
    this.stop();
    if (!this.epochs.length) return;
    this.currentIndex = (this.currentIndex + 1) % this.epochs.length;
    this.render();
    if (this.onEpochChange) this.onEpochChange(this.epochs[this.currentIndex], this.currentIndex);
  }

  stepBackward() {
    this.stop();
    if (!this.epochs.length) return;
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

  removeMarker(id) {
    this.markers = this.markers.filter(m => m.id !== id);
    if (this.onMarkersChange) this.onMarkersChange(this.markers);
    this.render();
  }

  /** Converts canvas (x, y) to data-grid pixel coordinates (0..npix) */
  canvasToDataCoords(cx, cy) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const normX = ((cx - w / 2 - this.panX) / this.zoom + w / 2) / w;
    const normY = ((cy - h / 2 - this.panY) / this.zoom + h / 2) / h;
    return {
      dataX: normX * this.npix,
      dataY: normY * this.npix
    };
  }

  /** Converts data-grid pixel (0..npix) to canvas (x, y) */
  dataToCanvasCoords(dataX, dataY) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const baseX = (dataX / this.npix) * w;
    const baseY = (dataY / this.npix) * h;
    return {
      cx: (baseX - w / 2) * this.zoom + w / 2 + this.panX,
      cy: (baseY - h / 2) * this.zoom + h / 2 + this.panY
    };
  }

  /** Converts data-grid pixel to sky (RA, Dec) in degrees */
  dataToWorldCoords(dataX, dataY) {
    const dx = dataX - this.npix / 2;
    const dy = this.npix / 2 - dataY;
    const cosDec = Math.max(0.08, Math.cos((this.decCenter * Math.PI) / 180.0));
    const ra = this.raCenter - (dx * this.pixelScale) / 3600.0 / cosDec;
    const dec = this.decCenter + (dy * this.pixelScale) / 3600.0;
    return { ra, dec };
  }

  render() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.ctx.clearRect(0, 0, w, h);

    let activeImg = null;
    if (this.displayMode === 'difference' && this.loadedImages.difference) {
      activeImg = this.loadedImages.difference;
    } else if (this.displayMode === 'coadd' && this.loadedImages.coadd) {
      activeImg = this.loadedImages.coadd;
    } else if (this.displayMode === 'inverted') {
      activeImg = this.loadedImages.inverted[this.currentIndex];
    } else if (this.displayMode === 'rgb') {
      activeImg = this.loadedImages.rgb[this.currentIndex];
    } else {
      activeImg = this.loadedImages.normal[this.currentIndex];
    }

    if (!activeImg || !activeImg.complete || activeImg.naturalWidth === 0) {
      this.ctx.fillStyle = '#05080d';
      this.ctx.fillRect(0, 0, w, h);
      return;
    }

    this.ctx.save();
    this.ctx.filter = `brightness(${this.brightness}%) contrast(${this.contrast}%)`;
    this.ctx.translate(w / 2 + this.panX, h / 2 + this.panY);
    this.ctx.scale(this.zoom, this.zoom);
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(activeImg, -w / 2, -h / 2, w, h);
    this.ctx.restore();

    if (this.showGrid) {
      this._drawWcsGrid(w, h);
    }

    if (this.showGaia && this.cubeData && this.cubeData.gaia_sources) {
      this._drawGaiaOverlay();
    }

    if (this.showFlags && this.epochs[this.currentIndex] && this.epochs[this.currentIndex].flags) {
      this._drawFlagsOverlay(this.epochs[this.currentIndex].flags);
    }

    // Selected spectrum aperture ring
    if (this.selectedPixel) {
      const pt = this.dataToCanvasCoords(this.selectedPixel.dataX, this.selectedPixel.dataY);
      this.ctx.save();
      this.ctx.strokeStyle = '#00e1ee';
      this.ctx.lineWidth = 1.6;
      this.ctx.setLineDash([3, 3]);
      this.ctx.beginPath();
      this.ctx.arc(pt.cx, pt.cy, 13, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();
    }

    // User placed candidate markers (#1, #2...)
    this.markers.forEach((m, idx) => {
      const pt = this.dataToCanvasCoords(m.dataX, m.dataY);
      this.ctx.save();
      this.ctx.strokeStyle = '#f0b200';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(pt.cx, pt.cy, 14, 0, Math.PI * 2);
      this.ctx.stroke();

      // Cross ticks
      this.ctx.beginPath();
      this.ctx.moveTo(pt.cx - 19, pt.cy); this.ctx.lineTo(pt.cx - 10, pt.cy);
      this.ctx.moveTo(pt.cx + 10, pt.cy); this.ctx.lineTo(pt.cx + 19, pt.cy);
      this.ctx.moveTo(pt.cx, pt.cy - 19); this.ctx.lineTo(pt.cx, pt.cy - 10);
      this.ctx.moveTo(pt.cx, pt.cy + 10); this.ctx.lineTo(pt.cx, pt.cy + 19);
      this.ctx.stroke();

      this.ctx.fillStyle = '#f0b200';
      this.ctx.font = 'bold 11px "IBM Plex Mono", monospace';
      this.ctx.fillText(`#${idx + 1}`, pt.cx + 14, pt.cy - 12);
      this.ctx.restore();
    });

    // Hover crosshair
    if (this.mousePos.inCanvas && !this.isDragging) {
      this._drawCursorCrosshair(w, h);
    }

    // Sync Split-Compare canvases if attached
    this._renderSplitCanvases();
  }

  _drawWcsGrid(w, h) {
    const inverted = this.displayMode === 'inverted';
    this.ctx.save();
    this.ctx.strokeStyle = inverted ? 'rgba(0, 105, 120, 0.25)' : 'rgba(0, 180, 191, 0.18)';
    this.ctx.lineWidth = 1;

    const divisions = 4;
    for (let i = 1; i < divisions; i++) {
      const pos = (w / divisions) * i;
      this.ctx.beginPath();
      this.ctx.moveTo(pos, 0); this.ctx.lineTo(pos, h);
      this.ctx.moveTo(0, pos); this.ctx.lineTo(w, pos);
      this.ctx.stroke();
    }

    // Center nominal target reticle
    const center = this.dataToCanvasCoords(this.npix / 2, this.npix / 2);
    this.ctx.strokeStyle = inverted ? 'rgba(210, 40, 45, 0.78)' : 'rgba(0, 195, 205, 0.78)';
    this.ctx.lineWidth = 1.3;
    const r = 16;
    this.ctx.beginPath();
    this.ctx.arc(center.cx, center.cy, r, 0, Math.PI * 2);
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.moveTo(center.cx - r - 7, center.cy); this.ctx.lineTo(center.cx - r + 3, center.cy);
    this.ctx.moveTo(center.cx + r - 3, center.cy); this.ctx.lineTo(center.cx + r + 7, center.cy);
    this.ctx.moveTo(center.cx, center.cy - r - 7); this.ctx.lineTo(center.cx, center.cy - r + 3);
    this.ctx.moveTo(center.cx, center.cy + r - 3); this.ctx.lineTo(center.cx, center.cy + r + 7);
    this.ctx.stroke();

    // Compass N / E indicator (Astronomical North up, East left)
    this.ctx.strokeStyle = inverted ? '#111' : '#f0b200';
    this.ctx.fillStyle = inverted ? '#111' : '#f0b200';
    this.ctx.font = 'bold 10px "IBM Plex Mono", monospace';
    const ox = w - 26, oy = h - 24;
    this.ctx.beginPath();
    this.ctx.moveTo(ox, oy); this.ctx.lineTo(ox, oy - 18);
    this.ctx.moveTo(ox, oy); this.ctx.lineTo(ox - 18, oy);
    this.ctx.stroke();
    this.ctx.fillText('N', ox - 3, oy - 21);
    this.ctx.fillText('E', ox - 27, oy + 3);

    this.ctx.restore();
  }

  _drawGaiaOverlay() {
    this.ctx.save();
    this.cubeData.gaia_sources.forEach(src => {
      const pt = this.dataToCanvasCoords(src.x + 0.5, src.y + 0.5);
      this.ctx.strokeStyle = 'rgba(46, 213, 115, 0.85)';
      this.ctx.lineWidth = 1.2;
      this.ctx.strokeRect(pt.cx - 6, pt.cy - 6, 12, 12);

      // Proper motion arrow scaled for visibility
      const vx = -src.pm_ra * 0.45;
      const vy = -src.pm_dec * 0.45;
      this.ctx.beginPath();
      this.ctx.moveTo(pt.cx, pt.cy);
      this.ctx.lineTo(pt.cx + vx, pt.cy + vy);
      this.ctx.stroke();
    });
    this.ctx.restore();
  }

  _drawFlagsOverlay(flags) {
    if (!flags || !flags.length) return;
    this.ctx.save();
    flags.forEach(f => {
      const pt = this.dataToCanvasCoords(f.x + 0.5, f.y + 0.5);
      this.ctx.strokeStyle = '#ff5a5f';
      this.ctx.fillStyle = 'rgba(255, 90, 95, 0.22)';
      this.ctx.lineWidth = 1.5;
      this.ctx.beginPath();
      this.ctx.moveTo(pt.cx, pt.cy - 10);
      this.ctx.lineTo(pt.cx + 10, pt.cy + 8);
      this.ctx.lineTo(pt.cx - 10, pt.cy + 8);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.fillStyle = '#ff7b7f';
      this.ctx.font = 'bold 9px "IBM Plex Mono", monospace';
      this.ctx.fillText(f.flag, pt.cx + 11, pt.cy + 3);
    });
    this.ctx.restore();
  }

  _drawCursorCrosshair(w, h) {
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(240, 178, 0, 0.42)';
    this.ctx.lineWidth = 0.9;
    this.ctx.setLineDash([4, 4]);
    this.ctx.beginPath();
    this.ctx.moveTo(this.mousePos.x, 0);
    this.ctx.lineTo(this.mousePos.x, h);
    this.ctx.moveTo(0, this.mousePos.y);
    this.ctx.lineTo(w, this.mousePos.y);
    this.ctx.stroke();
    this.ctx.restore();
  }

  _renderSplitCanvases() {
    if (!this.splitCanvasA || !this.splitCanvasB) return;
    const ctxA = this.splitCanvasA.getContext('2d');
    const ctxB = this.splitCanvasB.getContext('2d');
    const imgA = this.loadedImages.normal[0];
    const imgB = this.displayMode === 'difference' && this.loadedImages.difference
      ? this.loadedImages.difference
      : (this.loadedImages.normal[1] || this.loadedImages.normal[0]);

    [ [ctxA, this.splitCanvasA, imgA], [ctxB, this.splitCanvasB, imgB] ].forEach(([c, cv, im]) => {
      c.clearRect(0, 0, cv.width, cv.height);
      if (im && im.complete && im.naturalWidth > 0) {
        c.imageSmoothingEnabled = false;
        c.drawImage(im, 0, 0, cv.width, cv.height);
      }
    });
  }

  _setupListeners() {
    this.canvas.addEventListener('mousedown', (e) => {
      if (this.activeTool === 'pan' || (this.zoom > 1.0 && e.shiftKey)) {
        this.isDragging = true;
        this.dragStart = { x: e.clientX - this.panX, y: e.clientY - this.panY };
        this.canvas.style.cursor = 'grabbing';
      }
    });

    window.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.setActiveTool(this.activeTool);
      }
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      this.mousePos.x = (e.clientX - rect.left) * scaleX;
      this.mousePos.y = (e.clientY - rect.top) * scaleY;
      this.mousePos.inCanvas = true;

      if (this.isDragging) {
        this.panX = (e.clientX - this.dragStart.x);
        this.panY = (e.clientY - this.dragStart.y);
        this.render();
        return;
      }

      const { dataX, dataY } = this.canvasToDataCoords(this.mousePos.x, this.mousePos.y);
      const { ra, dec } = this.dataToWorldCoords(dataX, dataY);

      let fluxVal = null;
      const ep = this.epochs[this.currentIndex];
      if (ep && ep.raw_matrix) {
        const ix = Math.floor(dataX);
        const iy = Math.floor(dataY);
        if (iy >= 0 && iy < ep.raw_matrix.length && ix >= 0 && ix < ep.raw_matrix[0].length) {
          fluxVal = ep.raw_matrix[iy][ix];
        }
      }

      if (this.onPixelHover) {
        this.onPixelHover({
          dataX,
          dataY,
          ra,
          dec,
          flux: fluxVal
        });
      }
      this.render();
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.mousePos.inCanvas = false;
      this.render();
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoomBy(e.deltaY < 0 ? 1.2 : 1 / 1.2);
    }, { passive: false });

    this.canvas.addEventListener('click', (e) => {
      if (this.activeTool === 'pan') return;
      const rect = this.canvas.getBoundingClientRect();
      const cx = (e.clientX - rect.left) * (this.canvas.width / rect.width);
      const cy = (e.clientY - rect.top) * (this.canvas.height / rect.height);
      const { dataX, dataY } = this.canvasToDataCoords(cx, cy);
      const { ra, dec } = this.dataToWorldCoords(dataX, dataY);

      if (this.activeTool === 'mark') {
        const epLabel = this.epochs[this.currentIndex]?.label || 'Epoch 1';
        this.markers.push({
          id: 'mk_' + Date.now() + '_' + Math.floor(Math.random() * 999),
          dataX,
          dataY,
          ra,
          dec,
          epochLabel: epLabel
        });
        if (this.onMarkersChange) this.onMarkersChange(this.markers);
      }

      this.selectedPixel = { dataX, dataY };
      if (this.onPixelClick) {
        const ep = this.epochs[this.currentIndex] || {};
        this.onPixelClick({
          dataX,
          dataY,
          ra,
          dec,
          targetX: ep.target_x ?? this.npix / 2,
          targetY: ep.target_y ?? this.npix / 2
        });
      }
      this.render();
    });
  }
}

window.SkyBlinker = SkyBlinker;
