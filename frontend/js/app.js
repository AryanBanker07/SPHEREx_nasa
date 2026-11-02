/**
 * Main Application Controller for SPHEREx Time-Domain Sky Explorer.
 * Coordinates UI, Blinker, SED chart, Aladin Lite v3, and API services.
 */

// Offline / Standalone Fallback Benchmark Presets
const FALLBACK_BENCHMARKS = {
  "Barnard's Star": {
    name: "Barnard's Star",
    ra: 269.452083,
    dec: 4.693333,
    pm_ra_cosdec: -798.58,
    pm_dec: 10328.12,
    type: "High Proper Motion Red Dwarf (M4V)",
    description: "Second closest star system. Moves ~5.18 arcsec per 6-month SPHEREx survey."
  },
  "Epsilon Indi B": {
    name: "Epsilon Indi B",
    ra: 331.043750,
    dec: -56.782778,
    pm_ra_cosdec: 3961.0,
    pm_dec: -2539.0,
    type: "Binary Brown Dwarf (T1 + T6)",
    description: "Nearby brown dwarf pair orbiting K-star. Distinct methane (1.6 & 3.3 µm) and water bands."
  },
  "WISE 0855": {
    name: "WISE 0855-0714",
    ra: 133.795129,
    dec: -7.245147,
    pm_ra_cosdec: -8132.0,
    pm_dec: 678.0,
    type: "Ultra-Cool Sub-Freezing Y-Dwarf (T ~ 250 K)",
    description: "Coldest known sub-stellar object (ice clouds). Blazing in SPHEREx Arrays 5 & 6 (4-5 µm) but dark in Array 1."
  },
  "RW Aurigae": {
    name: "RW Aurigae",
    ra: 76.956250,
    dec: 30.401389,
    pm_ra_cosdec: 2.1,
    pm_dec: -18.7,
    type: "Young UXor Variable Star (T Tauri Binary)",
    description: "Classical T Tauri star showing deep multi-magnitude dimmings from circumstellar dust streams."
  },
  "R Draconis": {
    name: "R Draconis",
    ra: 248.167500,
    dec: 66.755000,
    pm_ra_cosdec: 12.3,
    pm_dec: 18.9,
    type: "Mira Pulsating Variable Red Giant",
    description: "Pulsating giant with 245-day period. Creates high-contrast flux variations across 6-month SPHEREx epochs."
  },
  "Planet 9 Candidate": {
    name: "Planet 9 / Planet X (Candidate Search Field)",
    ra: 52.500000,
    dec: -15.200000,
    pm_ra_cosdec: -120.0,
    pm_dec: -45.0,
    type: "Hypothetical Trans-Neptunian Planet X",
    description: "Slowly shifting distant solar system planetary candidate, detectable in infrared thermal emission."
  }
};

class SPHERExApp {
  constructor() {
    this.apiBase = window.location.origin.includes('http') ? '' : 'http://localhost:8000';
    this.state = {
      target: "Barnard's Star",
      ra: 269.452083,
      dec: 4.693333,
      fov: 8.0,
      arraySelection: "all",
      mode: "normal", // 'normal', 'inverted', 'difference', 'coadd'
      activeView: "blink", // 'blink', 'aladin'
      currentCube: null,
      currentDiff: null,
      currentCoadd: null,
      currentSpectrum: null
    };

    this.blinker = null;
    this.sedChart = null;
    this.aladin = null;
  }

  async init() {
    // Canvas dimensions
    const canvas = document.getElementById('blink-canvas');
    canvas.width = 512;
    canvas.height = 512;

    // Initialize Blinker Engine
    this.blinker = new window.SkyBlinker(canvas, {
      onEpochChange: (epoch, index) => this._onEpochChanged(epoch, index),
      onPixelHover: (pos) => this._onPixelHover(pos),
      onPixelClick: (pos) => this._onPixelClicked(pos)
    });

    // Initialize SED Chart
    const chartCanvas = document.getElementById('sed-chart');
    this.sedChart = new window.SEDChart(chartCanvas);

    // Initialize Aladin Viewer
    this.aladin = new window.AladinViewer('aladin-container');

    // Setup UI event bindings
    this._bindEvents();

    // Check URL parameters
    this._parseUrlParams();

    // Fetch Target Data
    await this.loadTarget(this.state.target, this.state.ra, this.state.dec);
  }

  _parseUrlParams() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('ra') && params.has('dec')) {
      this.state.ra = parseFloat(params.get('ra'));
      this.state.dec = parseFloat(params.get('dec'));
      this.state.target = params.get('target') || `Target (${this.state.ra.toFixed(3)}, ${this.state.dec.toFixed(3)})`;
      document.getElementById('target-input').value = this.state.target;
    }
    if (params.has('fov')) {
      this.state.fov = parseFloat(params.get('fov'));
      const fovSelect = document.getElementById('fov-select');
      if (fovSelect) fovSelect.value = this.state.fov;
    }
    if (params.has('mode')) {
      this.state.mode = params.get('mode');
    }
  }

  async loadTarget(targetName, ra, dec) {
    this._showLoading(true);
    this.state.target = targetName;
    this.state.ra = ra;
    this.state.dec = dec;

    // Update UI headers
    document.getElementById('display-target-name').textContent = targetName;
    document.getElementById('hud-coords').textContent = `RA ${ra.toFixed(4)}° | Dec ${dec.toFixed(4)}°`;

    try {
      // 1. Fetch Cutouts
      const cutoutRes = await fetch(`${this.apiBase}/api/cutout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ra: ra,
          dec: dec,
          fov_arcmin: this.state.fov,
          target_name: targetName,
          array_selection: this.state.arraySelection
        })
      });
      const cubeData = await cutoutRes.json();
      this.state.currentCube = cubeData;

      // 2. Fetch Difference Subtraction (Epoch 1 vs Epoch 2)
      let diffData = null;
      if (cubeData.epochs && cubeData.epochs.length >= 2) {
        const diffRes = await fetch(`${this.apiBase}/api/difference`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            matrix_a: cubeData.epochs[0].raw_matrix,
            matrix_b: cubeData.epochs[1].raw_matrix,
            dt_years: 0.5,
            epoch_a_label: cubeData.epochs[0].label,
            epoch_b_label: cubeData.epochs[1].label
          })
        });
        diffData = await diffRes.json();
        this.state.currentDiff = diffData;
      }

      // 3. Fetch Coaddition
      let coaddData = null;
      if (cubeData.epochs) {
        const coaddRes = await fetch(`${this.apiBase}/api/coadd`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            matrices: cubeData.epochs.map(e => e.raw_matrix)
          })
        });
        coaddData = await coaddRes.json();
        this.state.currentCoadd = coaddData;
      }

      // 4. Fetch 102-Band SED Spectrum
      const specRes = await fetch(`${this.apiBase}/api/spectrum`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_name: targetName
        })
      });
      const specData = await specRes.json();
      this.state.currentSpectrum = specData;

      // Load into Blinker & SED Chart
      this.blinker.loadData(cubeData, diffData, coaddData);
      this.blinker.setDisplayMode(this.state.mode);
      this.sedChart.renderSpectrum(specData);

      // Update Aladin Lite if active
      if (this.aladin) {
        this.aladin.goto(ra, dec, this.state.fov / 60.0);
      }

      // Update Candidate Box & Metadata
      this._updateCandidatesUI(diffData);
      this._updateMetadataUI(cubeData, specData);

    } catch (err) {
      console.error('Error fetching target data from backend, using standalone fallback:', err);
      this._loadStandaloneFallback(targetName, ra, dec);
    } finally {
      this._showLoading(false);
    }
  }

  _loadStandaloneFallback(targetName, ra, dec) {
    // Complete client-side simulation engine (for static deployments like Vercel / GitHub Pages)
    const meta = FALLBACK_BENCHMARKS[targetName] || {
      name: targetName,
      ra: ra,
      dec: dec,
      pm_ra_cosdec: 0,
      pm_dec: 0,
      type: "Custom Astronomical Source",
      description: "Custom coordinate field query."
    };

    const npix = 128;
    const offCanvas = document.createElement('canvas');
    offCanvas.width = npix;
    offCanvas.height = npix;
    const ctx = offCanvas.getContext('2d');

    const epochsInfo = [
      { id: "epoch_1", label: "SPHEREx Survey 1 (May 2025)", date: "2025-05-15", yr: 2025.37 },
      { id: "epoch_2", label: "SPHEREx Survey 2 (Nov 2025)", date: "2025-11-15", yr: 2025.87 },
      { id: "epoch_3", label: "SPHEREx Survey 3 (May 2026)", date: "2026-05-15", yr: 2026.37 },
      { id: "epoch_4", label: "SPHEREx Survey 4 (Nov 2026)", date: "2026-11-15", yr: 2026.87 },
      { id: "wise_ref", label: "WISE Baseline Reference (2010)", date: "2010-06-01", yr: 2010.42 }
    ];

    let seed = Math.abs(Math.sin(ra * 100 + dec * 50) * 10000);
    const rng = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    const bgStars = [];
    for (let i = 0; i < 28; i++) {
      bgStars.push({
        x: 6 + rng() * (npix - 12),
        y: 6 + rng() * (npix - 12),
        b: 50 + rng() * 160,
        r: 1.0 + rng() * 1.5
      });
    }

    const epochFrames = [];
    const center = npix / 2;
    const pixelScale = 6.2;

    epochsInfo.forEach((ep) => {
      ctx.fillStyle = '#080a10';
      ctx.fillRect(0, 0, npix, npix);

      // Draw background stars
      bgStars.forEach(s => {
        const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 2.2);
        grad.addColorStop(0, `rgba(${s.b}, ${s.b}, ${Math.min(255, s.b + 30)}, 0.95)`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * 2.2, 0, 2 * Math.PI);
        ctx.fill();
      });

      // Target position
      const dt = ep.yr - 2025.37;
      const shiftX = -((meta.pm_ra_cosdec / 1000.0) * dt) / pixelScale;
      const shiftY = ((meta.pm_dec / 1000.0) * dt) / pixelScale;

      const tx = center + shiftX;
      const ty = center + shiftY;

      let targetB = 240;
      let targetColor = '255, 230, 200';
      if (meta.name.includes('WISE 0855')) {
        targetColor = '255, 140, 80';
      } else if (meta.name.includes('RW Aur')) {
        if (ep.id === 'epoch_2') targetB = 60;
        else if (ep.id === 'epoch_4') targetB = 85;
      } else if (meta.name.includes('R Dra')) {
        const ph = (dt % 0.67) / 0.67 * 2 * Math.PI;
        targetB = Math.round(90 + 140 * ((Math.cos(ph) + 1) / 2));
      }

      const tGrad = ctx.createRadialGradient(tx, ty, 0, tx, ty, 4.5);
      tGrad.addColorStop(0, `rgba(${targetColor}, ${targetB / 255})`);
      tGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = tGrad;
      ctx.beginPath();
      ctx.arc(tx, ty, 4.5, 0, 2 * Math.PI);
      ctx.fill();

      // Normal PNG
      const normB64 = offCanvas.toDataURL('image/png').split(',')[1];

      // Inverted PNG
      const imgData = ctx.getImageData(0, 0, npix, npix);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const lum = 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
        const inv = 255 - lum;
        d[i] = inv;
        d[i+1] = inv;
        d[i+2] = inv;
      }
      ctx.putImageData(imgData, 0, 0);
      const invB64 = offCanvas.toDataURL('image/png').split(',')[1];

      epochFrames.push({
        epoch_id: ep.id,
        label: ep.label,
        date: ep.date,
        image_b64: normB64,
        invert_b64: invB64,
        target_x: tx,
        target_y: ty,
        shift_ra_arcsec: -shiftX * pixelScale,
        shift_dec_arcsec: shiftY * pixelScale
      });
    });

    // Difference image synthesis
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, npix, npix);

    const candidates = [];
    const hasProperMotion = Math.abs(meta.pm_ra_cosdec) > 50 || Math.abs(meta.pm_dec) > 50;
    const isVariable = meta.name.includes('RW Aur') || meta.name.includes('R Dra');

    if (hasProperMotion) {
      const dt = 0.5;
      const sx = -((meta.pm_ra_cosdec / 1000.0) * dt) / pixelScale;
      const sy = ((meta.pm_dec / 1000.0) * dt) / pixelScale;

      // Cyan deficit at Epoch 1
      const gNeg = ctx.createRadialGradient(center, center, 0, center, center, 5.0);
      gNeg.addColorStop(0, 'rgba(0, 200, 255, 0.95)');
      gNeg.addColorStop(1, 'rgba(128, 128, 128, 0)');
      ctx.fillStyle = gNeg;
      ctx.beginPath();
      ctx.arc(center, center, 5.0, 0, 2 * Math.PI);
      ctx.fill();

      // Amber excess at Epoch 2
      const gPos = ctx.createRadialGradient(center + sx, center + sy, 0, center + sx, center + sy, 5.0);
      gPos.addColorStop(0, 'rgba(255, 200, 50, 0.95)');
      gPos.addColorStop(1, 'rgba(128, 128, 128, 0)');
      ctx.fillStyle = gPos;
      ctx.beginPath();
      ctx.arc(center + sx, center + sy, 5.0, 0, 2 * Math.PI);
      ctx.fill();

      const dispArcsec = Math.hypot(sx, sy) * pixelScale;
      candidates.push({
        id: "dipole_1",
        category: "Moving Object Dipole",
        displacement_arcsec: dispArcsec.toFixed(2),
        proper_motion_rate: (dispArcsec / 0.5).toFixed(2),
        description: `Bipolar dipole detected: Shifts ${dispArcsec.toFixed(2)}″ over 0.5 yr. Fast moving infrared source.`
      });
    } else if (isVariable) {
      const gVar = ctx.createRadialGradient(center, center, 0, center, center, 5.0);
      gVar.addColorStop(0, 'rgba(255, 80, 80, 0.95)');
      gVar.addColorStop(1, 'rgba(128, 128, 128, 0)');
      ctx.fillStyle = gVar;
      ctx.beginPath();
      ctx.arc(center, center, 5.0, 0, 2 * Math.PI);
      ctx.fill();

      candidates.push({
        id: "variable_1",
        category: "Variable / Transient",
        displacement_arcsec: "0.00",
        proper_motion_rate: "0.00",
        description: "Monochromatic stationary flux variation: Deep magnitude change between survey epochs."
      });
    }

    const diffB64 = offCanvas.toDataURL('image/png').split(',')[1];

    const cubeData = {
      target: targetName,
      ra: ra,
      dec: dec,
      fov_arcmin: this.state.fov,
      npix: npix,
      pixel_scale: pixelScale,
      epochs: epochFrames
    };

    const diffData = {
      epoch_a: "Survey 1",
      epoch_b: "Survey 2",
      difference_b64: diffB64,
      candidates: candidates,
      has_dipole: hasProperMotion,
      has_variable: isVariable
    };

    const coaddData = {
      coadd_b64: epochFrames[0].image_b64,
      snr_boost_factor: "2.0x"
    };

    // 102-Band Spectrum Synthesis
    const spectralPoints = [];
    for (let i = 0; i < 102; i++) {
      const arrId = Math.floor(i / 17) + 1;
      const w = 0.75 + (i / 101.0) * (5.00 - 0.75);
      let flux = 20.0;

      if (meta.name.includes('WISE 0855')) {
        flux = Math.pow(w / 5.0, 4.5) * 45.0;
        if (Math.abs(w - 3.05) < 0.2) flux *= 0.35; // H2O ice absorption
        if (Math.abs(w - 3.30) < 0.1) flux *= 0.45; // CH4 absorption
        if (w < 1.6) flux = 0.5 + Math.random() * 0.5;
      } else if (meta.name.includes('Epsilon Indi')) {
        flux = 35.0 * Math.exp(-Math.pow(w - 1.5, 2) / 2.0);
        if (Math.abs(w - 1.67) < 0.08) flux *= 0.4;
        if (Math.abs(w - 3.30) < 0.12) flux *= 0.35;
      } else if (meta.name.includes('Barnard')) {
        flux = 60.0 * Math.exp(-Math.pow(w - 1.2, 2) / 3.0) + 10.0;
      } else if (meta.name.includes('RW Aur')) {
        flux = 30.0 + 15.0 * Math.pow(w / 3.0, 1.2);
      } else if (meta.name.includes('R Dra')) {
        flux = 55.0 * Math.exp(-Math.pow(w - 2.2, 2) / 4.0);
        if (Math.abs(w - 4.67) < 0.15) flux *= 0.5;
      }

      spectralPoints.push({
        band_index: i + 1,
        detector_array: arrId,
        wavelength_um: parseFloat(w.toFixed(4)),
        flux_mjy_sr: parseFloat((flux + (Math.random() - 0.5) * 0.8).toFixed(3)),
        uncertainty: 0.25
      });
    }

    const molMarkers = [
      { name: "CH4 (Methane)", center_um: 1.67, species: "Methane" },
      { name: "H2O (Vapor)", center_um: 1.90, species: "Water Vapor" },
      { name: "CO (Overtone)", center_um: 2.32, species: "Carbon Monoxide" },
      { name: "H2O Ice (Crucial)", center_um: 3.05, species: "Water Ice Absorption" },
      { name: "CH4 / PAH", center_um: 3.30, species: "Hydrocarbons" },
      { name: "CO2 Fundamental", center_um: 4.27, species: "Carbon Dioxide" },
      { name: "CO Fundamental", center_um: 4.67, species: "Carbon Monoxide" }
    ];

    const specData = {
      target: targetName,
      classification: meta.type || "Near-Infrared Source",
      total_bands: 102,
      molecular_markers: molMarkers,
      spectral_points: spectralPoints
    };

    this.state.currentCube = cubeData;
    this.state.currentDiff = diffData;
    this.state.currentCoadd = coaddData;
    this.state.currentSpectrum = specData;

    this.blinker.loadData(cubeData, diffData, coaddData);
    this.blinker.setDisplayMode(this.state.mode);
    this.sedChart.renderSpectrum(specData);

    if (this.aladin) {
      this.aladin.goto(ra, dec, this.state.fov / 60.0);
    }

    this._updateCandidatesUI(diffData);
    this._updateMetadataUI(cubeData, specData);
  }

  _bindEvents() {
    // Search form
    const searchBtn = document.getElementById('btn-search');
    const searchInput = document.getElementById('target-input');

    const handleSearch = async () => {
      const q = searchInput.value.trim();
      if (!q) return;
      try {
        const res = await fetch(`${this.apiBase}/api/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q })
        });
        const data = await res.json();
        await this.loadTarget(data.name, data.ra, data.dec);
      } catch (e) {
        alert('Could not resolve target name or coordinates. Try "Barnard\'s Star" or "WISE 0855".');
      }
    };

    searchBtn.addEventListener('click', handleSearch);
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSearch();
    });

    // Preset target buttons
    document.querySelectorAll('.preset-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const key = chip.getAttribute('data-target');
        const info = FALLBACK_BENCHMARKS[key];
        if (info) {
          searchInput.value = info.name;
          this.loadTarget(info.name, info.ra, info.dec);
        }
      });
    });

    // FOV Selector
    const fovSelect = document.getElementById('fov-select');
    if (fovSelect) {
      fovSelect.addEventListener('change', (e) => {
        this.state.fov = parseFloat(e.target.value);
        this.loadTarget(this.state.target, this.state.ra, this.state.dec);
      });
    }

    // Array Selector
    const arraySelect = document.getElementById('array-select');
    if (arraySelect) {
      arraySelect.addEventListener('change', (e) => {
        this.state.arraySelection = e.target.value;
        this.loadTarget(this.state.target, this.state.ra, this.state.dec);
      });
    }

    // Playback Controls
    const btnPlay = document.getElementById('btn-play');
    btnPlay.addEventListener('click', () => {
      if (this.blinker.isPlaying) {
        this.blinker.stop();
        btnPlay.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Play';
      } else {
        this.blinker.start();
        btnPlay.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause';
      }
    });

    document.getElementById('btn-prev').addEventListener('click', () => {
      this.blinker.stepBackward();
      this._syncPlayButtonState();
    });

    document.getElementById('btn-next').addEventListener('click', () => {
      this.blinker.stepForward();
      this._syncPlayButtonState();
    });

    // FPS speed slider
    const fpsSlider = document.getElementById('fps-slider');
    const fpsLabel = document.getElementById('fps-label');
    fpsSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      fpsLabel.textContent = `${val.toFixed(1)} fps`;
      this.blinker.setFps(val);
    });

    // Display mode buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.getAttribute('data-mode');
        this.state.mode = mode;
        this.blinker.setDisplayMode(mode);
      });
    });

    // View tab switching (Blink vs CDS Aladin)
    document.querySelectorAll('.view-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.view-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const view = tab.getAttribute('data-view');
        this.state.activeView = view;
        const blinkCanvas = document.getElementById('blink-canvas');
        const aladinContainer = document.getElementById('aladin-container');

        if (view === 'aladin') {
          blinkCanvas.style.display = 'none';
          aladinContainer.style.display = 'block';
          this.aladin.goto(this.state.ra, this.state.dec, this.state.fov / 60.0);
        } else {
          aladinContainer.style.display = 'none';
          blinkCanvas.style.display = 'block';
          this.blinker.render();
        }
      });
    });

    // Export GIF Button
    document.getElementById('btn-export-gif').addEventListener('click', () => {
      const fname = `spherex_${this.state.target.replace(/\s+/g, '_')}_blink.gif`;
      window.ExportTools.exportBlinkGif(this.blinker, fname);
    });

    // Share Link Button
    document.getElementById('btn-share').addEventListener('click', () => {
      const link = window.ExportTools.generateShareLink(this.state);
      navigator.clipboard.writeText(link).then(() => {
        alert(`Direct Deep-Link copied to clipboard!\n\n${link}`);
      }).catch(() => {
        prompt('Copy your deep link:', link);
      });
    });

    // Export CSV Button
    document.getElementById('btn-export-csv').addEventListener('click', () => {
      if (this.state.currentDiff && this.state.currentDiff.candidates) {
        window.ExportTools.exportCandidateCSV(
          this.state.currentDiff.candidates,
          this.state.target,
          this.state.ra,
          this.state.dec
        );
      } else {
        alert('No candidate detections logged for this field.');
      }
    });
  }

  _onEpochChanged(epoch, index) {
    document.getElementById('hud-epoch-label').textContent = epoch.label || `Epoch ${index+1}`;
    // Update stepper nodes
    document.querySelectorAll('.epoch-node').forEach((node, i) => {
      if (i === index) node.classList.add('active');
      else node.classList.remove('active');
    });
  }

  _onPixelHover(pos) {
    const coordsEl = document.getElementById('hud-cursor-coords');
    if (coordsEl) {
      coordsEl.textContent = `Pixel: (${pos.pixelX}, ${pos.pixelY}) | RA: ${pos.ra.toFixed(5)}° Dec: ${pos.dec.toFixed(5)}°`;
    }
  }

  async _onPixelClicked(pos) {
    // Extract spectrum at clicked pixel
    try {
      const res = await fetch(`${this.apiBase}/api/spectrum`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_name: this.state.target,
          pixel_x: pos.pixelX,
          pixel_y: pos.pixelY
        })
      });
      const specData = await res.json();
      this.sedChart.renderSpectrum(specData);
      this._updateMetadataUI(this.state.currentCube, specData);
    } catch (e) {
      console.warn('Could not extract pixel SED:', e);
    }
  }

  _updateCandidatesUI(diffData) {
    const listEl = document.getElementById('candidates-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (!diffData || !diffData.candidates || diffData.candidates.length === 0) {
      listEl.innerHTML = '<p style="font-size:0.75rem; color:#64748b; padding:0.5rem;">No significant motion dipoles or variable transients detected above 3.5σ threshold.</p>';
      return;
    }

    diffData.candidates.forEach(c => {
      const item = document.createElement('div');
      item.className = 'candidate-item';
      item.innerHTML = `
        <div class="candidate-header">
          <span class="candidate-title">${c.category}</span>
          <span class="candidate-rate">${c.proper_motion_rate ? c.proper_motion_rate + ' ″/yr' : 'Variable Flux'}</span>
        </div>
        <p class="candidate-desc">${c.description}</p>
      `;
      listEl.appendChild(item);
    });
  }

  _updateMetadataUI(cubeData, specData) {
    const typeEl = document.getElementById('meta-classification');
    if (typeEl && specData) {
      typeEl.textContent = specData.classification || 'Near-IR Source';
    }
    const bandsEl = document.getElementById('meta-bands');
    if (bandsEl && specData) {
      bandsEl.textContent = `${specData.total_bands || 102} Bands (0.75 - 5.0 µm)`;
    }
    const snrEl = document.getElementById('meta-snr');
    if (snrEl && this.state.currentCoadd) {
      snrEl.textContent = `+${this.state.currentCoadd.snr_boost_factor} Coadd Gain`;
    }
  }

  _syncPlayButtonState() {
    const btnPlay = document.getElementById('btn-play');
    if (btnPlay) {
      btnPlay.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Play';
    }
  }

  _showLoading(show) {
    const el = document.getElementById('loading-spinner');
    if (el) el.style.display = show ? 'flex' : 'none';
  }
}

// Bootstrap application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new SPHERExApp();
  window.app.init();
});

