/**
 * Interactive HiDPI Vector SVG 102-Band SPHEREx Spectrophotometer (0.75 – 5.00 µm).
 * Renders at native infinite vector resolution (DirectWrite / CoreText subpixel crispness)
 * on a true physical linear wavelength scale across all 6 LVF Detector Arrays (A1–A6),
 * with ±1σ photometric uncertainty ribbons, staggered molecular absorption callouts,
 * live channel-snapping crosshair telemetry, and lossless SVG figure export.
 */

const SPHEREX_ARRAYS = [
  { id: 1, label: 'A1', wMin: 0.75, wMax: 1.11, res: 'R~41', color: '#818cf8', zoneAlpha: 0.09, desc: 'Detector Array 1 (0.75–1.11 µm, R~41, 17 bands): Short NIR stellar photospheres & Y/J-band continuum. Ultra-cool Y-dwarfs like WISE 0855 drop to near-zero flux here.' },
  { id: 2, label: 'A2', wMin: 1.11, wMax: 1.64, res: 'R~41', color: '#38bdf8', zoneAlpha: 0.08, desc: 'Detector Array 2 (1.11–1.64 µm, R~41, 17 bands): J/H-band window probing H₂O vapor and the blue wing of 1.67 µm CH₄ methane in T-dwarfs.' },
  { id: 3, label: 'A3', wMin: 1.64, wMax: 2.42, res: 'R~41', color: '#00d2df', zoneAlpha: 0.09, desc: 'Detector Array 3 (1.64–2.42 µm, R~41, 17 bands): H/K-band window capturing 1.67 µm CH₄ (brown dwarfs) and 2.32 µm CO overtone bands (M-dwarfs & AGB giants).' },
  { id: 4, label: 'A4', wMin: 2.42, wMax: 3.82, res: 'R~41', color: '#34d399', zoneAlpha: 0.08, desc: 'Detector Array 4 (2.42–3.82 µm, R~41, 17 bands): Prime astrobiology & ice band! Resolves broad 3.05 µm solid H₂O ice, 3.28 µm PAH emission, and 3.30 µm CH₄.' },
  { id: 5, label: 'A5', wMin: 3.82, wMax: 4.42, res: 'R~135', color: '#f0b200', zoneAlpha: 0.09, desc: 'Detector Array 5 (3.82–4.42 µm, High-Res R~135, 17 bands): Dedicated high-spectral-resolution filter isolating narrow 4.27 µm CO₂ ice & gas features.' },
  { id: 6, label: 'A6', wMin: 4.42, wMax: 5.00, res: 'R~41', color: '#ff5a5f', zoneAlpha: 0.09, desc: 'Detector Array 6 (4.42–5.00 µm, R~41, 17 bands): 5 µm thermal window where sub-freezing Y-dwarfs (WISE 0855, 250 K), Planet X candidates, and 4.67 µm CO shine.' }
];

const MOLECULAR_CATALOG = [
  { group: 'CH4', center_um: 1.67, shortLabel: 'CH₄ 1.67', isIce: false, row: 0 },
  { group: 'CO',  center_um: 2.32, shortLabel: 'CO 2.32',  isIce: false, row: 0 },
  { group: 'H2O Ice', center_um: 3.05, shortLabel: 'H₂O 3.05', isIce: true, row: 0 },
  { group: 'CH4', center_um: 3.30, shortLabel: 'CH₄ 3.30', isIce: false, row: 1 },
  { group: 'CO2', center_um: 4.27, shortLabel: 'CO₂ 4.27', isIce: true, row: 0 },
  { group: 'CO',  center_um: 4.67, shortLabel: 'CO 4.67',  isIce: false, row: 1 }
];

const SVG_NS = 'http://www.w3.org/2000/svg';

class SEDChart {
  constructor(canvasOrContainer) {
    this.legacyCanvas = canvasOrContainer && canvasOrContainer.tagName === 'CANVAS' ? canvasOrContainer : null;
    this.host = this.legacyCanvas ? this.legacyCanvas.parentElement : canvasOrContainer;
    if (this.legacyCanvas) {
      this.legacyCanvas.style.display = 'none';
    }

    this.currentData = null;
    this.activeMarkers = new Set(['H2O Ice', 'CO2', 'CO', 'CH4']);
    this.hoveredIndex = -1;

    this.svg = document.createElementNS(SVG_NS, 'svg');
    this.svg.setAttribute('class', 'sed-svg-plot');
    this.svg.setAttribute('role', 'img');
    this.svg.setAttribute('aria-label', 'SPHEREx 102-Band Near-Infrared Spectrum (0.75 to 5.00 micrometers)');

    this.hoverCard = document.createElement('div');
    this.hoverCard.className = 'sed-hover-card';

    if (this.host) {
      this.host.appendChild(this.svg);
      this.host.appendChild(this.hoverCard);
    }

    this._geometry = null;
    this._bindInteractions();
    this._setupResizeObserver();
  }

  _setupResizeObserver() {
    if (!this.host || typeof ResizeObserver === 'undefined') return;
    let rafId = null;
    this.resizeObserver = new ResizeObserver(() => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (this.currentData) this._drawVectorPlot(this.currentData);
      });
    });
    this.resizeObserver.observe(this.host);
  }

  renderSpectrum(spectrumData) {
    if (!spectrumData || !spectrumData.spectral_points || !spectrumData.spectral_points.length) return;
    this.currentData = spectrumData;
    this.hoveredIndex = -1;
    this.hoverCard.classList.remove('visible');
    this._drawVectorPlot(spectrumData);
    this._renderMolecularChips();
  }

  refreshTheme() {
    if (this.currentData) {
      this._drawVectorPlot(this.currentData);
    }
  }

  _arrayColor(arr) {
    const found = SPHEREX_ARRAYS.find(a => a.id === arr);
    return found ? found.color : '#00d2df';
  }

  _niceStep(maxVal, targetTicks = 5) {
    const raw = Math.max(maxVal, 1) / targetTicks;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const residual = raw / mag;
    let nice = 1;
    if (residual > 5) nice = 10;
    else if (residual > 2.5) nice = 5;
    else if (residual > 2) nice = 2.5;
    else if (residual > 1) nice = 2;
    return nice * mag;
  }

  _catmullRomPath(pts) {
    if (!pts.length) return '';
    if (pts.length === 1) return `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
    let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
    const tension = 0.28;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];

      const cp1x = p1.x + (p2.x - p0.x) * tension;
      const cp1y = p1.y + (p2.y - p0.y) * tension;
      const cp2x = p2.x - (p3.x - p1.x) * tension;
      const cp2y = p2.y - (p3.y - p1.y) * tension;

      d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    }
    return d;
  }

  _el(tag, attrs = {}, text = null) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v !== null && v !== undefined) node.setAttribute(k, String(v));
    }
    if (text !== null) node.textContent = text;
    return node;
  }

  _drawVectorPlot(spectrumData) {
    if (!this.host) return;
    const points = spectrumData.spectral_points || [];
    if (!points.length) return;

    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const rect = this.host.getBoundingClientRect();
    const width = Math.max(340, Math.round(rect.width || 440));
    const height = Math.max(230, Math.round(rect.height || 266));

    // Exact 1:1 logical viewBox so 1 SVG unit === 1 CSS pixel (crisp subpixel vector geometry)
    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    this.svg.innerHTML = '';

    // Layout margins: dedicated top bar for A1-A6 so peak flux NEVER collides with array headers
    const padLeft = 46;
    const padRight = 14;
    const arrayBarTop = 7;
    const arrayBarHeight = 19;
    const plotTop = arrayBarTop + arrayBarHeight + 8; // y = 34
    const plotBottom = height - 34;
    const plotW = Math.max(120, width - padLeft - padRight);
    const plotH = Math.max(90, plotBottom - plotTop);

    const wMin = 0.75;
    const wMax = 5.00;
    const xOfW = (w) => padLeft + ((w - wMin) / (wMax - wMin)) * plotW;

    const peakWithErr = Math.max(...points.map(p => (p.flux_mjy_sr || 0) + (p.uncertainty || 0)), 2);
    const yStep = this._niceStep(peakWithErr * 1.18, 4);
    const yMax = Math.max(yStep * 2, Math.ceil((peakWithErr * 1.18) / yStep) * yStep);
    const yOfF = (f) => plotBottom - (Math.max(0, f) / yMax) * plotH;

    // Palette tokens matching Zooniverse Dark & Light themes
    const bgPlot = isLight ? '#f8fafc' : '#11151b';
    const gridStroke = isLight ? 'rgba(30, 45, 65, 0.10)' : 'rgba(165, 185, 210, 0.11)';
    const axisStroke = isLight ? 'rgba(30, 45, 65, 0.26)' : 'rgba(165, 185, 210, 0.25)';
    const labelColor = isLight ? '#4b5563' : '#9aa6b5';
    const titleColor = isLight ? '#334155' : '#b7c3d0';
    const pointStroke = isLight ? '#ffffff' : '#0d1117';

    // 1. Definitions (ClipPath, Area Gradient, Subtle Continuum Glow)
    const defs = this._el('defs');

    const clip = this._el('clipPath', { id: 'sed-plot-clip' });
    clip.appendChild(this._el('rect', { x: padLeft, y: plotTop, width: plotW, height: plotH }));
    defs.appendChild(clip);

    const areaGrad = this._el('linearGradient', { id: 'sed-area-grad', x1: '0', y1: '0', x2: '0', y2: '1' });
    areaGrad.appendChild(this._el('stop', { offset: '0%', 'stop-color': '#00d2df', 'stop-opacity': isLight ? '0.24' : '0.28' }));
    areaGrad.appendChild(this._el('stop', { offset: '100%', 'stop-color': '#00979d', 'stop-opacity': '0.02' }));
    defs.appendChild(areaGrad);

    const lineGrad = this._el('linearGradient', { id: 'sed-line-grad', x1: '0', y1: '0', x2: '1', y2: '0' });
    SPHEREX_ARRAYS.forEach(arr => {
      const midPct = (((arr.wMin + arr.wMax) / 2 - wMin) / (wMax - wMin)) * 100;
      lineGrad.appendChild(this._el('stop', { offset: `${midPct.toFixed(1)}%`, 'stop-color': arr.color }));
    });
    defs.appendChild(lineGrad);

    this.svg.appendChild(defs);

    // 2. Plot Backdrop
    this.svg.appendChild(this._el('rect', {
      x: padLeft,
      y: plotTop,
      width: plotW,
      height: plotH,
      fill: bgPlot,
      rx: 2
    }));

    // 3. 6 SPHEREx Detector Array Zones + Dedicated Top Header Pill Bar (Zero Curve Overlap!)
    const zonesGroup = this._el('g', { class: 'sed-array-zones' });
    const headerBarGroup = this._el('g', { class: 'sed-array-headers' });

    SPHEREX_ARRAYS.forEach((arr, idx) => {
      const x1 = xOfW(arr.wMin);
      const x2 = xOfW(arr.wMax);
      const segW = Math.max(1, x2 - x1);

      // Subtle vertical zone tint inside plot area
      zonesGroup.appendChild(this._el('rect', {
        x: x1.toFixed(2),
        y: plotTop,
        width: segW.toFixed(2),
        height: plotH,
        fill: arr.color,
        'fill-opacity': isLight ? (arr.zoneAlpha * 0.75).toFixed(3) : arr.zoneAlpha.toFixed(3)
      }));

      // Vertical boundary divider between arrays
      if (idx > 0) {
        zonesGroup.appendChild(this._el('line', {
          x1: x1.toFixed(2),
          y1: plotTop,
          x2: x1.toFixed(2),
          y2: plotBottom,
          stroke: axisStroke,
          'stroke-width': 0.8,
          'stroke-dasharray': '2,3'
        }));
      }

      // Dedicated Interactive Array Header Segment above the plot
      const hdrGroup = this._el('g', {
        style: 'cursor: help;',
        'data-tip-title': `SPHEREx Detector ${arr.label} (${arr.wMin.toFixed(2)}–${arr.wMax.toFixed(2)} µm • ${arr.res})`,
        'data-tip-body': arr.desc
      });

      hdrGroup.appendChild(this._el('rect', {
        x: (x1 + 0.8).toFixed(2),
        y: arrayBarTop,
        width: Math.max(2, segW - 1.6).toFixed(2),
        height: arrayBarHeight,
        rx: 2.5,
        fill: arr.color,
        'fill-opacity': isLight ? '0.16' : '0.18',
        stroke: arr.color,
        'stroke-opacity': isLight ? '0.55' : '0.62',
        'stroke-width': 0.9
      }));

      const labelText = (arr.id === 5 && segW >= 46) ? 'A5 R135' : arr.label;
      hdrGroup.appendChild(this._el('text', {
        x: ((x1 + x2) / 2).toFixed(2),
        y: (arrayBarTop + 13).toFixed(2),
        'text-anchor': 'middle',
        fill: isLight ? '#1e293b' : '#eef4fa',
        'font-family': '"IBM Plex Mono", monospace',
        'font-size': '10px',
        'font-weight': '600',
        'letter-spacing': '0.02em'
      }, labelText));

      headerBarGroup.appendChild(hdrGroup);
    });

    this.svg.appendChild(zonesGroup);
    this.svg.appendChild(headerBarGroup);

    // 4. Horizontal Flux Gridlines & Y-Axis Ticks
    const gridGroup = this._el('g', { class: 'sed-grid' });
    for (let fVal = 0; fVal <= yMax + 0.001; fVal += yStep) {
      const py = Math.round(yOfF(fVal)) + 0.5;
      gridGroup.appendChild(this._el('line', {
        x1: padLeft,
        y1: py,
        x2: padLeft + plotW,
        y2: py,
        stroke: fVal === 0 ? axisStroke : gridStroke,
        'stroke-width': 1
      }));

      const tickStr = Number.isInteger(fVal) ? String(fVal) : fVal.toFixed(1);
      gridGroup.appendChild(this._el('text', {
        x: padLeft - 7,
        y: py + 3.5,
        'text-anchor': 'end',
        fill: labelColor,
        'font-family': '"IBM Plex Mono", monospace',
        'font-size': '10.5px',
        'font-weight': '500'
      }, tickStr));
    }

    //Rotated Y-Axis Unit Label
    const yMid = plotTop + plotH / 2;
    gridGroup.appendChild(this._el('text', {
      x: 13,
      y: yMid,
      transform: `rotate(-90 13 ${yMid})`,
      'text-anchor': 'middle',
      fill: titleColor,
      'font-family': '"IBM Plex Mono", monospace',
      'font-size': '10px',
      'font-weight': '600',
      'letter-spacing': '0.04em'
    }, 'MJy/sr'));

    // 5. True Physical Linear Wavelength X-Axis Ticks (0.75 to 5.00 µm)
    const majorWaves = [0.75, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0];
    majorWaves.forEach((wVal) => {
      if (wVal === 1.0 && plotW < 340) return; // prevent crowding on narrow mobile viewports
      const px = Math.round(xOfW(wVal)) + 0.5;

      // Vertical major gridline
      if (wVal > 0.75 && wVal < 5.0) {
        gridGroup.appendChild(this._el('line', {
          x1: px,
          y1: plotTop,
          x2: px,
          y2: plotBottom,
          stroke: gridStroke,
          'stroke-width': 1
        }));
      }

      // Tick mark
      gridGroup.appendChild(this._el('line', {
        x1: px,
        y1: plotBottom,
        x2: px,
        y2: plotBottom + 4,
        stroke: axisStroke,
        'stroke-width': 1
      }));

      const lbl = wVal === 0.75 ? '0.75' : (wVal === 5.0 ? '5.0µm' : wVal.toFixed(1));
      gridGroup.appendChild(this._el('text', {
        x: wVal === 5.0 ? px - 2 : px,
        y: plotBottom + 16,
        'text-anchor': wVal === 0.75 ? 'start' : (wVal === 5.0 ? 'end' : 'middle'),
        fill: labelColor,
        'font-family': '"IBM Plex Mono", monospace',
        'font-size': '10.5px',
        'font-weight': '500'
      }, lbl));
    });

    // Bottom X-Axis Title
    gridGroup.appendChild(this._el('text', {
      x: padLeft + plotW / 2,
      y: height - 5,
      'text-anchor': 'middle',
      fill: titleColor,
      'font-family': '"IBM Plex Mono", monospace',
      'font-size': '9.5px',
      'font-weight': '500',
      'letter-spacing': '0.04em'
    }, 'Wavelength λ (µm) — Linear Scale Across 102 LVF Channels'));

    this.svg.appendChild(gridGroup);

    // 6. Molecular Absorption Reference Lines & Staggered Callout Pills
    const molGroup = this._el('g', { class: 'sed-molecular-lines' });
    MOLECULAR_CATALOG.forEach(m => {
      if (!this.activeMarkers.has(m.group)) return;
      const mx = xOfW(m.center_um);
      const strokeCol = m.isIce
        ? (isLight ? '#0284c7' : '#38bdf8')
        : (isLight ? '#ca8a04' : '#f0b200');

      molGroup.appendChild(this._el('line', {
        x1: mx.toFixed(2),
        y1: plotTop + (m.row === 1 ? 19 : 5),
        x2: mx.toFixed(2),
        y2: plotBottom,
        stroke: strokeCol,
        'stroke-width': 1.15,
        'stroke-opacity': '0.78',
        'stroke-dasharray': '3.5,3'
      }));

      // Crisp micro-tag inside top of plot
      const tagW = m.shortLabel.length * 5.4 + 8;
      const tagX = Math.min(Math.max(padLeft + 2, mx - tagW / 2), padLeft + plotW - tagW - 2);
      const tagY = plotTop + 3 + m.row * 14;

      molGroup.appendChild(this._el('rect', {
        x: tagX.toFixed(2),
        y: tagY.toFixed(2),
        width: tagW.toFixed(2),
        height: 12.5,
        rx: 2,
        fill: isLight ? 'rgba(255,255,255,0.88)' : 'rgba(13, 17, 23, 0.86)',
        stroke: strokeCol,
        'stroke-opacity': '0.65',
        'stroke-width': 0.8
      }));

      molGroup.appendChild(this._el('text', {
        x: (tagX + tagW / 2).toFixed(2),
        y: (tagY + 9.2).toFixed(2),
        'text-anchor': 'middle',
        fill: strokeCol,
        'font-family': '"IBM Plex Mono", monospace',
        'font-size': '8.5px',
        'font-weight': '600'
      }, m.shortLabel));
    });
    this.svg.appendChild(molGroup);

    // 7. Data Series: ±1σ Uncertainty Ribbon, Area Fill, Smooth Spline Curve, & 102 Channel Nodes
    const dataGroup = this._el('g', { 'clip-path': 'url(#sed-plot-clip)' });

    const screenPts = points.map((p, idx) => ({
      idx,
      raw: p,
      x: xOfW(p.wavelength_um),
      y: yOfF(p.flux_mjy_sr),
      yHigh: yOfF((p.flux_mjy_sr || 0) + (p.uncertainty || 0)),
      yLow: yOfF(Math.max(0, (p.flux_mjy_sr || 0) - (p.uncertainty || 0))),
      color: this._arrayColor(p.detector_array)
    }));

    // ±1σ Photometric Uncertainty Envelope Polygon
    const upperStr = screenPts.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(2)} ${pt.yHigh.toFixed(2)}`).join(' ');
    const lowerStr = [...screenPts].reverse().map(pt => `L ${pt.x.toFixed(2)} ${pt.yLow.toFixed(2)}`).join(' ');
    dataGroup.appendChild(this._el('path', {
      d: `${upperStr} ${lowerStr} Z`,
      fill: isLight ? 'rgba(0, 133, 138, 0.14)' : 'rgba(0, 210, 223, 0.15)',
      stroke: 'none'
    }));

    // Subtle Area Gradient under Curve
    const curveD = this._catmullRomPath(screenPts);
    const areaD = `${curveD} L ${screenPts[screenPts.length - 1].x.toFixed(2)} ${plotBottom.toFixed(2)} L ${screenPts[0].x.toFixed(2)} ${plotBottom.toFixed(2)} Z`;
    dataGroup.appendChild(this._el('path', {
      d: areaD,
      fill: 'url(#sed-area-grad)'
    }));

    // Error Whiskers at each channel
    const whiskerGroup = this._el('g', {
      stroke: isLight ? 'rgba(51, 65, 85, 0.30)' : 'rgba(200, 215, 230, 0.26)',
      'stroke-width': 0.85
    });
    screenPts.forEach(pt => {
      if (Math.abs(pt.yLow - pt.yHigh) > 1.5) {
        whiskerGroup.appendChild(this._el('line', {
          x1: pt.x.toFixed(2),
          y1: pt.yHigh.toFixed(2),
          x2: pt.x.toFixed(2),
          y2: pt.yLow.toFixed(2)
        }));
      }
    });
    dataGroup.appendChild(whiskerGroup);

    // Crisp Multi-Array Continuum Curve
    dataGroup.appendChild(this._el('path', {
      d: curveD,
      fill: 'none',
      stroke: 'url(#sed-line-grad)',
      'stroke-width': 2.05,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round'
    }));

    this.svg.appendChild(dataGroup);

    // Plot Frame Border
    this.svg.appendChild(this._el('rect', {
      x: padLeft + 0.5,
      y: plotTop + 0.5,
      width: plotW - 1,
      height: plotH - 1,
      fill: 'none',
      stroke: axisStroke,
      'stroke-width': 1
    }));

    // 8. 102 Individual LVF Spectral Channel Nodes (Drawn above border so edge points never clip)
    const nodesGroup = this._el('g', { class: 'sed-channel-nodes' });
    screenPts.forEach(pt => {
      nodesGroup.appendChild(this._el('circle', {
        cx: pt.x.toFixed(2),
        cy: pt.y.toFixed(2),
        r: 2.55,
        fill: pt.color,
        stroke: pointStroke,
        'stroke-width': 0.9
      }));
    });
    this.svg.appendChild(nodesGroup);

    // 9. Interactive Laser Crosshair Layer (Updated dynamically on mousemove)
    this.crosshairGroup = this._el('g', { class: 'sed-crosshair', style: 'display:none; pointer-events:none;' });
    this.vHair = this._el('line', {
      y1: plotTop,
      y2: plotBottom,
      stroke: isLight ? 'rgba(0, 133, 138, 0.65)' : 'rgba(126, 243, 250, 0.65)',
      'stroke-width': 1,
      'stroke-dasharray': '3,2'
    });
    this.hHair = this._el('line', {
      x1: padLeft,
      x2: padLeft + plotW,
      stroke: isLight ? 'rgba(0, 133, 138, 0.45)' : 'rgba(126, 243, 250, 0.42)',
      'stroke-width': 1,
      'stroke-dasharray': '3,2'
    });
    this.activeOuterRing = this._el('circle', {
      r: 6.5,
      fill: 'none',
      stroke: '#ffffff',
      'stroke-width': 1.6
    });
    this.activeInnerDot = this._el('circle', {
      r: 3.6,
      fill: '#00e1ee',
      stroke: '#0d1117',
      'stroke-width': 1.1
    });
    this.crosshairGroup.appendChild(this.vHair);
    this.crosshairGroup.appendChild(this.hHair);
    this.crosshairGroup.appendChild(this.activeOuterRing);
    this.crosshairGroup.appendChild(this.activeInnerDot);
    this.svg.appendChild(this.crosshairGroup);

    this._geometry = {
      width,
      height,
      padLeft,
      plotTop,
      plotBottom,
      plotW,
      plotH,
      screenPts
    };
  }

  _bindInteractions() {
    this.svg.addEventListener('mousemove', (e) => {
      if (!this._geometry || !this._geometry.screenPts.length) return;
      const rect = this.svg.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const { padLeft, plotW, plotTop, plotBottom, width, screenPts } = this._geometry;
      if (mx < padLeft - 8 || mx > padLeft + plotW + 8 || my < plotTop - 4 || my > plotBottom + 12) {
        this._hideCrosshair();
        return;
      }

      // Snap to nearest of the 102 spectral channels
      let best = screenPts[0];
      let bestDist = Math.abs(mx - best.x);
      for (let i = 1; i < screenPts.length; i++) {
        const d = Math.abs(mx - screenPts[i].x);
        if (d < bestDist) {
          bestDist = d;
          best = screenPts[i];
        }
      }

      this.hoveredIndex = best.idx;
      this.crosshairGroup.style.display = 'block';
      this.vHair.setAttribute('x1', best.x.toFixed(2));
      this.vHair.setAttribute('x2', best.x.toFixed(2));
      this.hHair.setAttribute('y1', best.y.toFixed(2));
      this.hHair.setAttribute('y2', best.y.toFixed(2));
      this.activeOuterRing.setAttribute('cx', best.x.toFixed(2));
      this.activeOuterRing.setAttribute('cy', best.y.toFixed(2));
      this.activeOuterRing.setAttribute('stroke', best.color);
      this.activeInnerDot.setAttribute('cx', best.x.toFixed(2));
      this.activeInnerDot.setAttribute('cy', best.y.toFixed(2));
      this.activeInnerDot.setAttribute('fill', best.color);

      const p = best.raw;
      const resLabel = p.detector_array === 5 ? 'R~135 High-Res' : 'R~41 LVF';
      this.hoverCard.innerHTML = `
        <div class="sed-hover-title">λ = ${p.wavelength_um.toFixed(3)} µm • Ch #${p.band_index}/102</div>
        <div class="sed-hover-flux">Flux: ${p.flux_mjy_sr.toFixed(2)} ± ${(p.uncertainty || 0).toFixed(2)} MJy/sr</div>
        <div class="sed-hover-arr">SPHEREx Array ${p.detector_array} (${resLabel})</div>
      `;
      this.hoverCard.classList.add('visible');

      // Smart horizontal placement so readout never clips or covers the active point
      const cardW = this.hoverCard.offsetWidth || 215;
      let leftPos = best.x + 14;
      if (leftPos + cardW > width - 8) {
        leftPos = Math.max(padLeft + 4, best.x - cardW - 14);
      }
      const topPos = Math.max(plotTop + 4, Math.min(plotBottom - 62, best.y - 26));
      this.hoverCard.style.left = `${Math.round(leftPos)}px`;
      this.hoverCard.style.top = `${Math.round(topPos)}px`;
    });

    this.svg.addEventListener('mouseleave', () => {
      this._hideCrosshair();
    });
  }

  _hideCrosshair() {
    this.hoveredIndex = -1;
    if (this.crosshairGroup) this.crosshairGroup.style.display = 'none';
    if (this.hoverCard) this.hoverCard.classList.remove('visible');
  }

  /** Exports a self-contained publication-quality Vector SVG file */
  exportSvg(targetName = 'SPHEREx_Target') {
    if (!this.svg) return;
    const clone = this.svg.cloneNode(true);
    clone.setAttribute('xmlns', SVG_NS);
    const cross = clone.querySelector('.sed-crosshair');
    if (cross) cross.remove();

    // Prepend solid background rect so exported SVG looks crisp in any viewer
    const vb = (clone.getAttribute('viewBox') || '0 0 460 266').split(' ').map(Number);
    const bg = document.createElementNS(SVG_NS, 'rect');
    bg.setAttribute('x', '0');
    bg.setAttribute('y', '0');
    bg.setAttribute('width', String(vb[2] || 460));
    bg.setAttribute('height', String(vb[3] || 266));
    bg.setAttribute('fill', '#11151b');
    clone.insertBefore(bg, clone.firstChild);

    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
    const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safe = String(targetName).replace(/[^a-z0-9_-]+/gi, '_');
    a.href = url;
    a.download = `${safe}_SPHEREx_102Band_Spectrum.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  _renderMolecularChips() {
    const container = document.getElementById('molecular-pills-container');
    if (!container) return;
    container.innerHTML = '';

    const groups = [
      { key: 'CH4', label: 'CH₄ 1.67/3.3µm', isIce: false, desc: 'Methane absorption bands — signature of cool T & Y Brown Dwarfs like Epsilon Indi B & WISE 0855.' },
      { key: 'H2O Ice', label: 'H₂O Ice 3.05µm', isIce: true, desc: 'Solid water-ice absorption feature in Array 4 — reveals icy comets, Kuiper Belt objects & sub-freezing Y-dwarf clouds.' },
      { key: 'CO2', label: 'CO₂ 4.27µm (R~135)', isIce: true, desc: 'Carbon dioxide band resolved at high spectral resolution (R~135) by SPHEREx Array 5.' },
      { key: 'CO', label: 'CO 2.32/4.67µm', isIce: false, desc: 'Carbon monoxide overtone & fundamental bands — strong in M-dwarfs (Barnard\'s Star) and AGB Mira giants (R Draconis).' }
    ];

    groups.forEach(g => {
      const btn = document.createElement('button');
      const isOn = this.activeMarkers.has(g.key);
      btn.type = 'button';
      btn.className = `mol-chip ${g.isIce ? 'ice' : 'gas'} ${isOn ? 'active' : ''}`;
      btn.setAttribute('data-tip-title', `${g.label} Spectral Marker`);
      btn.setAttribute('data-tip-body', `Click to toggle vertical wavelength line & badge on the 102-band vector plot. ${g.desc}`);
      btn.innerHTML = `<span>●</span> ${g.label}`;
      btn.addEventListener('click', () => {
        if (this.activeMarkers.has(g.key)) this.activeMarkers.delete(g.key);
        else this.activeMarkers.add(g.key);
        this._drawVectorPlot(this.currentData);
        this._renderMolecularChips();
      });
      container.appendChild(btn);
    });
  }
}

window.SEDChart = SEDChart;
