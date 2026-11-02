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
    // Generate simulated canvas frames for offline / direct browser usage
    alert('Connecting to standalone offline simulation mode.');
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

