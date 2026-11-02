/**
 * SPHEREx: Planet X & Moving Worlds — Main Zooniverse Citizen Science Controller.
 * Connects FastAPI + Astropy backend with a complete in-browser physics & Sesame fallback
 * so every single tool, band, FOV, difference pair, spectrum, and workflow works 100% anywhere.
 */

const BENCHMARK_CATALOG = {
  "Barnard's Star": {
    key: "Barnard's Star",
    subjectId: "SPX-26945-0441",
    name: "Barnard's Star",
    ra: 269.452083,
    dec: 4.693333,
    ra_hms: "17h 57m 48.50s",
    dec_dms: "+04° 41′ 36.0″",
    pm_ra_cosdec: -798.58,
    pm_dec: 10328.12,
    type: "High Proper Motion Red Dwarf (M4V)",
    recommended_fov: 8,
    description: "Fastest proper-motion star in the sky (10.36″/yr). Shifts ~5.18″ every 6-month SPHEREx survey and ~160″ relative to 2010 WISE."
  },
  "WISE 0855": {
    key: "WISE 0855",
    subjectId: "SPX-13379-0714",
    name: "WISE 0855-0714",
    ra: 133.795129,
    dec: -7.245147,
    ra_hms: "08h 55m 10.83s",
    dec_dms: "-07° 14′ 42.5″",
    pm_ra_cosdec: -8132.0,
    pm_dec: 678.0,
    type: "Ultra-Cool Sub-Freezing Y-Dwarf (T ~ 250 K)",
    recommended_fov: 8,
    description: "Coldest known brown dwarf (-23°C) at 7.4 ly, moving 8.16″/yr. Dark in Array 1 (0.75–1.1µm), blazing in Array 6 (4.4–5.0µm) with 3.05µm water-ice clouds!"
  },
  "Epsilon Indi B": {
    key: "Epsilon Indi B",
    subjectId: "SPX-33104-5646",
    name: "Epsilon Indi B",
    ra: 331.043750,
    dec: -56.782778,
    ra_hms: "22h 04m 10.50s",
    dec_dms: "-56° 46′ 58.0″",
    pm_ra_cosdec: 3961.0,
    pm_dec: -2539.0,
    type: "Binary Brown Dwarf Pair (T1 + T6)",
    recommended_fov: 8,
    description: "Pair of gravitational brown dwarfs orbiting Epsilon Indi A (4.70″/yr). Exhibits textbook CH₄ methane absorption dips at 1.67µm and 3.30µm."
  },
  "RW Aurigae": {
    key: "RW Aurigae",
    subjectId: "SPX-07695-3024",
    name: "RW Aurigae",
    ra: 76.956250,
    dec: 30.401389,
    ra_hms: "05h 07m 49.50s",
    dec_dms: "+30° 24′ 05.0″",
    pm_ra_cosdec: 2.1,
    pm_dec: -18.7,
    type: "Young UXor Variable Star (T Tauri Binary)",
    recommended_fov: 8,
    description: "Stationary young binary undergoing dramatic >1.6 mag dust-stream occultations between epochs, plus warm circumstellar disk excess (>2µm)."
  },
  "R Draconis": {
    key: "R Draconis",
    subjectId: "SPX-24816-6645",
    name: "R Draconis",
    ra: 248.167500,
    dec: 66.755000,
    ra_hms: "16h 32m 40.20s",
    dec_dms: "+66° 45′ 18.0″",
    pm_ra_cosdec: 12.3,
    pm_dec: 18.9,
    type: "Mira Pulsating AGB Red Giant (P = 245.6d)",
    recommended_fov: 8,
    description: "Luminous pulsating red giant whose 245-day cycle produces stark infrared flux swings across 6-month SPHEREx surveys and deep 4.67µm CO absorption."
  },
  "Planet X Field": {
    key: "Planet X Field",
    subjectId: "SPX-05250-1512",
    name: "Planet 9 / Planet X Search Field",
    ra: 52.500000,
    dec: -15.200000,
    ra_hms: "03h 30m 00.00s",
    dec_dms: "-15° 12′ 00.0″",
    pm_ra_cosdec: -480.0,
    pm_dec: -190.0,
    type: "Trans-Neptunian / Distant Planet X Candidate",
    recommended_fov: 8,
    description: "Simulated outer solar system survey patch showing subtle semi-annual parallax shift detectable via multi-epoch blinking and difference subtraction."
  }
};

class SPHERExZooApp {
  constructor() {
    this.apiBase = window.location.protocol.startsWith('http') ? '' : 'http://127.0.0.1:8000';
    this.usingBackend = true;

    this.state = {
      target: "Barnard's Star",
      subjectId: "SPX-26945-0441",
      ra: 269.452083,
      dec: 4.693333,
      fov: 8,
      arraySelection: "all",
      mode: "normal",       // 'normal', 'inverted', 'rgb', 'difference', 'coadd'
      activeView: "blink",  // 'blink', 'split', 'aladin'
      diffIdxA: 0,
      diffIdxB: 1,
      selectedChoice: null,
      currentCube: null,
      currentDiff: null,
      currentCoadd: null,
      currentSpectrum: null
    };

    this.classifications = this._loadStorage('spx_classifications', []);
    this.favorites = this._loadStorage('spx_favorites', []);
    this.recents = this._loadStorage('spx_recents', []);

    this.tooltipEngine = null;
    this.blinker = null;
    this.sedChart = null;
    this.aladin = null;
  }

  async init() {
    // Theme persistence
    const savedTheme = localStorage.getItem('spx_zoo_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    this._updateThemeBtnLabel(savedTheme);

    // Initialize Universal Hover Tooltip HUD
    this.tooltipEngine = new window.ZooTooltipEngine();

    // Initialize Subject Viewer Canvases
    const canvas = document.getElementById('blink-canvas');
    canvas.width = 560;
    canvas.height = 560;

    const splitA = document.getElementById('split-canvas-a');
    const splitB = document.getElementById('split-canvas-b');
    splitA.width = 360; splitA.height = 360;
    splitB.width = 360; splitB.height = 360;

    this.blinker = new window.SkyBlinker(canvas, {
      splitCanvasA: splitA,
      splitCanvasB: splitB,
      onEpochChange: (ep, idx) => this._onEpochChanged(ep, idx),
      onPixelHover: (pos) => this._onPixelHover(pos),
      onPixelClick: (pos) => this._onPixelClicked(pos),
      onMarkersChange: (markers) => this._renderDetectionsAndMarkers()
    });

    this.sedChart = new window.SEDChart(document.getElementById('sed-chart'));
    this.aladin = new window.AladinViewer('aladin-container');

    this._bindAllControls();
    this._bindKeyboardShortcuts();
    this._parseUrlQuery();
    this._updateNavCounters();

    await this.loadTarget(this.state.target, this.state.ra, this.state.dec);
  }

  _loadStorage(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  _saveStorage(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (_) {}
  }

  _parseUrlQuery() {
    const p = new URLSearchParams(window.location.search);
    if (p.has('target') && BENCHMARK_CATALOG[p.get('target')]) {
      const bm = BENCHMARK_CATALOG[p.get('target')];
      this.state.target = bm.name;
      this.state.ra = bm.ra;
      this.state.dec = bm.dec;
    }
    if (p.has('ra') && p.has('dec')) {
      const ra = parseFloat(p.get('ra'));
      const dec = parseFloat(p.get('dec'));
      if (!isNaN(ra) && !isNaN(dec)) {
        this.state.ra = ra;
        this.state.dec = dec;
        if (!p.has('target')) {
          this.state.target = `Field (${ra.toFixed(3)}°, ${dec.toFixed(3)}°)`;
        }
      }
    }
    if (p.has('fov')) {
      const f = parseFloat(p.get('fov'));
      if (!isNaN(f)) {
        this.state.fov = f;
        document.getElementById('fov-select').value = String(f);
      }
    }
    if (p.has('array')) {
      this.state.arraySelection = p.get('array');
      document.getElementById('array-select').value = this.state.arraySelection;
    }
    if (p.has('mode')) {
      this.state.mode = p.get('mode');
    }
    document.getElementById('target-input').value = this.state.target;
  }

  _findBenchmarkMeta(name, ra, dec) {
    for (const item of Object.values(BENCHMARK_CATALOG)) {
      if (
        item.name.toLowerCase() === (name || '').toLowerCase() ||
        item.key.toLowerCase() === (name || '').toLowerCase() ||
        (Math.abs(item.ra - ra) < 0.05 && Math.abs(item.dec - dec) < 0.05)
      ) {
        return item;
      }
    }
    return null;
  }

  async loadTarget(targetName, ra, dec) {
    this._setLoading(true);
    const bm = this._findBenchmarkMeta(targetName, ra, dec);
    this.state.target = bm ? bm.name : targetName;
    this.state.ra = ra;
    this.state.dec = dec;
    this.state.subjectId = bm
      ? bm.subjectId
      : `SPX-${Math.round(Math.abs(ra) * 100)}-${Math.round(Math.abs(dec) * 100)}`;

    // Sync active benchmark pill
    document.querySelectorAll('.target-pill').forEach(btn => {
      const key = btn.getAttribute('data-target');
      const match = bm && bm.key === key;
      btn.classList.toggle('active', Boolean(match));
    });

    // Sync top ribbon labels
    document.getElementById('subject-id-badge').textContent = `SUBJECT #${this.state.subjectId}`;
    document.getElementById('display-target-name').textContent = this.state.target;
    document.getElementById('hud-coords').textContent =
      `RA ${ra.toFixed(4)}° (${this._degToHms(ra)})  |  Dec ${dec >= 0 ? '+' : ''}${dec.toFixed(4)}° (${this._degToDms(dec)})`;

    // Sync favorite heart state
    this._syncFavoriteUI();

    try {
      const cutoutRes = await fetch(`${this.apiBase}/api/cutout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ra,
          dec,
          fov_arcmin: this.state.fov,
          target_name: this.state.target,
          array_selection: this.state.arraySelection
        })
      });
      if (!cutoutRes.ok) throw new Error(`HTTP ${cutoutRes.status}`);
      const cubeData = await cutoutRes.json();
      if (!cubeData || !cubeData.epochs) throw new Error('Invalid cutout payload');

      this.usingBackend = true;
      this._setEngineStatus(true);
      this.state.currentCube = cubeData;

      // Compute Difference for active pair
      const diffData = await this._computeDifferencePair(cubeData, this.state.diffIdxA, this.state.diffIdxB);
      this.state.currentDiff = diffData;

      // Compute Coadd
      const coaddRes = await fetch(`${this.apiBase}/api/coadd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matrices: cubeData.epochs.map(e => e.raw_matrix) })
      });
      const coaddData = coaddRes.ok ? await coaddRes.json() : null;
      this.state.currentCoadd = coaddData;

      // Extract nominal target 102-band SED
      const ep0 = cubeData.epochs[0];
      const specRes = await fetch(`${this.apiBase}/api/spectrum`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_name: this.state.target,
          pixel_x: ep0.target_x,
          pixel_y: ep0.target_y,
          center_x: ep0.target_x,
          center_y: ep0.target_y
        })
      });
      const specData = specRes.ok ? await specRes.json() : this._synthesizeClientSpectrum(this.state.target, true, 5500);
      this.state.currentSpectrum = specData;

      this._applyLoadedDataset(cubeData, diffData, coaddData, specData);
    } catch (err) {
      this.usingBackend = false;
      this._setEngineStatus(false);
      const sim = this._buildClientSimulation(this.state.target, ra, dec, this.state.fov, this.state.arraySelection);
      this.state.currentCube = sim.cubeData;
      this.state.currentDiff = sim.diffData;
      this.state.currentCoadd = sim.coaddData;
      this.state.currentSpectrum = sim.specData;
      this._applyLoadedDataset(sim.cubeData, sim.diffData, sim.coaddData, sim.specData);
    } finally {
      this._recordRecentTarget();
      window.ExportTools.syncBrowserUrl(this.state);
      this._setLoading(false);
    }
  }

  _applyLoadedDataset(cubeData, diffData, coaddData, specData) {
    this._populateEpochControls(cubeData.epochs);
    this.blinker.loadData(cubeData, diffData, coaddData, true);
    if (this.state.arraySelection === 'rgb' && this.state.mode === 'normal') {
      this.blinker.setDisplayMode('rgb');
    } else {
      this.blinker.setDisplayMode(this.state.mode);
    }
    this._syncDisplayModeToolbar();
    this._syncPlayPauseUI();

    this.sedChart.renderSpectrum(specData);
    document.getElementById('sed-classification-badge').textContent = specData.classification || 'Near-IR Source';
    document.getElementById('sed-aperture-coords').textContent =
      `Aperture @ RA ${this.state.ra.toFixed(4)}°, Dec ${this.state.dec.toFixed(4)}°`;

    if (this.state.activeView === 'aladin') {
      this.aladin.goto(this.state.ra, this.state.dec, this.state.fov / 60.0);
    }

    this._renderDetectionsAndMarkers();
  }

  async _computeDifferencePair(cubeData, idxA, idxB) {
    const epA = cubeData.epochs[idxA] || cubeData.epochs[0];
    const epB = cubeData.epochs[idxB] || cubeData.epochs[1];
    const dtYears = Math.max(0.1, Math.abs((epB.mjd - epA.mjd) / 365.25));

    if (this.usingBackend) {
      try {
        const res = await fetch(`${this.apiBase}/api/difference`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            matrix_a: epA.raw_matrix,
            matrix_b: epB.raw_matrix,
            dt_years: dtYears,
            epoch_a_label: epA.label,
            epoch_b_label: epB.label
          })
        });
        if (res.ok) return await res.json();
      } catch (_) {}
    }
    return this._synthesizeClientDifference(epA, epB, dtYears);
  }

  /* ========================================================================
     CLIENT-SIDE SCIENTIFIC SIMULATION & RESOLVER (FOR STATIC CLOUD HOSTING)
     ======================================================================== */
  async _resolveQueryClientOrServer(rawQuery) {
    // 1. Try local FastAPI Astropy endpoint first
    try {
      const res = await fetch(`${this.apiBase}/api/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: rawQuery })
      });
      if (res.ok) return await res.json();
    } catch (_) {}

    // 2. Match built-in Benchmark names
    const qLower = rawQuery.trim().toLowerCase();
    for (const item of Object.values(BENCHMARK_CATALOG)) {
      if (item.name.toLowerCase().includes(qLower) || item.key.toLowerCase().includes(qLower) || qLower.includes(item.key.toLowerCase())) {
        return { name: item.name, ra: item.ra, dec: item.dec };
      }
    }

    // 3. Parse decimal degrees: "133.795, -7.245" or "133.795 -7.245"
    const decParts = rawQuery.trim().replace(/,/g, ' ').split(/\s+/);
    if (decParts.length === 2 && !isNaN(Number(decParts[0])) && !isNaN(Number(decParts[1]))) {
      const ra = parseFloat(decParts[0]);
      const dec = parseFloat(decParts[1]);
      if (ra >= 0 && ra <= 360 && dec >= -90 && dec <= 90) {
        return { name: `Field (${ra.toFixed(4)}°, ${dec.toFixed(4)}°)`, ra, dec };
      }
    }

    // 4. Parse sexagesimal HMS DMS: "08h55m10.83s -07d14m42.5s" or "17:57:48.5 +04:41:36"
    const sexMatch = rawQuery.trim().match(
      /^(\d{1,2})[h:\s]+(\d{1,2})[m:\s]+([\d.]+)s?\s+([+-]?\d{1,2})[d°:\s]+(\d{1,2})[m'′:\s]+([\d.]+)[s"″]?$/i
    );
    if (sexMatch) {
      const rh = parseFloat(sexMatch[1]), rm = parseFloat(sexMatch[2]), rs = parseFloat(sexMatch[3]);
      const ddStr = sexMatch[4];
      const sign = ddStr.startsWith('-') ? -1 : 1;
      const dd = Math.abs(parseFloat(ddStr)), dm = parseFloat(sexMatch[5]), ds = parseFloat(sexMatch[6]);
      const ra = (rh + rm / 60 + rs / 3600) * 15.0;
      const dec = sign * (dd + dm / 60 + ds / 3600);
      return { name: rawQuery.trim(), ra, dec };
    }

    // 5. Query live CDS Sesame Astronomical Name Resolver over HTTPS
    const sesameUrl = `https://cdsweb.u-strasbg.fr/cgi-bin/nph-sesame/-oI/A?${encodeURIComponent(rawQuery.trim())}`;
    const sRes = await fetch(sesameUrl);
    if (sRes.ok) {
      const txt = await sRes.text();
      const jLine = txt.split('\n').find(l => l.startsWith('%J '));
      if (jLine) {
        const toks = jLine.trim().split(/\s+/);
        if (toks.length >= 3) {
          return { name: rawQuery.trim(), ra: parseFloat(toks[1]), dec: parseFloat(toks[2]) };
        }
      }
    }

    throw new Error('Unresolved target');
  }

  _buildClientSimulation(targetName, ra, dec, fovArcmin, arraySelection) {
    const bm = this._findBenchmarkMeta(targetName, ra, dec) || {
      name: targetName,
      ra,
      dec,
      pm_ra_cosdec: 0,
      pm_dec: 0,
      type: 'Near-Infrared Field Source'
    };

    const pixelScale = 6.2;
    const npix = Math.max(36, Math.min(128, Math.round((fovArcmin * 60) / pixelScale)));

    const epochsMeta = [
      { id: 'epoch_1', label: 'SPHEREx Survey 1 (May 2025)', date: '2025-05-15', mjd: 60810, yr: 2025.37 },
      { id: 'epoch_2', label: 'SPHEREx Survey 2 (Nov 2025)', date: '2025-11-15', mjd: 60994, yr: 2025.87 },
      { id: 'epoch_3', label: 'SPHEREx Survey 3 (May 2026)', date: '2026-05-15', mjd: 61175, yr: 2026.37 },
      { id: 'epoch_4', label: 'SPHEREx Survey 4 (Nov 2026)', date: '2026-11-15', mjd: 61359, yr: 2026.87 },
      { id: 'wise_ref', label: 'WISE Baseline Reference (2010)', date: '2010-06-01', mjd: 55348, yr: 2010.42 }
    ];

    let seed = Math.floor((Math.abs(ra) * 1000 + Math.abs(dec) * 10000) % 2147483647) || 42;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const numBg = Math.max(18, Math.min(45, Math.round(fovArcmin * 3.2)));
    const bgStars = [];
    const gaiaSources = [];
    for (let i = 0; i < numBg; i++) {
      const bx = 2 + rand() * (npix - 4);
      const by = 2 + rand() * (npix - 4);
      const bf = 4 + -Math.log(Math.max(0.02, rand())) * 14;
      const bt = 3400 + rand() * 6000;
      const pmRa = (rand() - 0.5) * 24;
      const pmDec = (rand() - 0.5) * 24;
      bgStars.push({ x: bx, y: by, flux: bf, teff: bt });
      if (i < 14) {
        gaiaSources.push({
          id: `Gaia DR3 ${100000 + i * 7919}`,
          x: bx, y: by,
          g_mag: (18.4 - 2.5 * Math.log10(Math.max(1, bf))).toFixed(2),
          pm_ra: pmRa, pm_dec: pmDec, teff: Math.round(bt)
        });
      }
    }

    const center = (npix - 1) / 2;
    const sigma = 1.5 / 2.355;

    const targetBandFlux = (arr) => {
      if (bm.name.includes('WISE 0855')) {
        if (arr === '1' || arr === '2') return 0.4;
        if (arr === '3') return 2.5;
        if (arr === '4') return 8.5;
        if (arr === '5' || arr === '6') return 46.0;
        return 28.0;
      }
      if (bm.name.includes('Epsilon Indi')) return arr === '1' ? 14.0 : 34.0;
      if (bm.name.includes('Barnard')) return 58.0;
      if (bm.name.includes('RW Aur')) return 48.0;
      if (bm.name.includes('R Dra')) return 54.0;
      return 28.0;
    };

    const epochs = epochsMeta.map(ep => {
      const dt = ep.yr - 2025.37;
      const shiftRaArcsec = (bm.pm_ra_cosdec / 1000.0) * dt;
      const shiftDecArcsec = (bm.pm_dec / 1000.0) * dt;
      const tx = center - shiftRaArcsec / pixelScale;
      const ty = center + shiftDecArcsec / pixelScale;

      let fMult = 1.0;
      if (bm.name.includes('RW Aur')) {
        fMult = ep.id === 'epoch_2' ? 0.22 : (ep.id === 'epoch_4' ? 0.35 : (ep.id === 'epoch_3' ? 0.95 : 1.0));
      } else if (bm.name.includes('R Dra')) {
        const ph = ((ep.mjd - 60810) / 245.6) * Math.PI * 2;
        fMult = 0.45 + 0.55 * ((Math.cos(ph) + 1) / 2);
      }

      const mat = Array.from({ length: npix }, () => new Float32Array(npix));
      const chS = Array.from({ length: npix }, () => new Float32Array(npix));
      const chM = Array.from({ length: npix }, () => new Float32Array(npix));
      const chL = Array.from({ length: npix }, () => new Float32Array(npix));

      const zodi = 0.45;
      for (let y = 0; y < npix; y++) {
        for (let x = 0; x < npix; x++) {
          let v = zodi + (rand() - 0.5) * 0.22;
          let vs = zodi * 0.7, vm = zodi * 0.9, vl = zodi * 1.3;

          for (let s = 0; s < bgStars.length; s++) {
            const st = bgStars[s];
            const dx = x - st.x, dy = y - st.y;
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) continue;
            const psf = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
            const bw = Math.min(1.5, Math.max(0.5, st.teff / 5800));
            const rw = Math.min(1.4, Math.max(0.45, 4500 / st.teff));
            const scale = (arraySelection === '1' || arraySelection === '2') ? bw : ((arraySelection === '5' || arraySelection === '6') ? rw : 1.0);
            v += st.flux * scale * psf;
            vs += st.flux * bw * psf;
            vm += st.flux * psf;
            vl += st.flux * rw * psf;
          }

          const dtx = x - tx, dty = y - ty;
          if (Math.abs(dtx) <= 6 && Math.abs(dty) <= 6) {
            const tPsf = Math.exp(-(dtx * dtx + dty * dty) / (2 * sigma * sigma));
            v += targetBandFlux(arraySelection) * fMult * tPsf;
            vs += targetBandFlux('1') * fMult * tPsf;
            vm += targetBandFlux('3') * fMult * tPsf;
            vl += targetBandFlux('6') * fMult * tPsf;
          }

          mat[y][x] = Math.max(0, v);
          chS[y][x] = Math.max(0, vs);
          chM[y][x] = Math.max(0, vm);
          chL[y][x] = Math.max(0, vl);
        }
      }

      const flags = [];
      if (ep.id === 'epoch_2') {
        const cx = Math.floor(npix * 0.25), cy = Math.floor(npix * 0.75);
        mat[cy][cx] += 95;
        flags.push({ x: cx, y: cy, bit: 2, flag: 'COSMIC_RAY_HIT', note: 'Single-read transient spike flagged in Level-2 FLAGS HDU' });
      } else if (ep.id === 'epoch_3') {
        const hx = Math.floor(npix * 0.78), hy = Math.floor(npix * 0.22);
        flags.push({ x: hx, y: hy, bit: 4, flag: 'WARM_DETECTOR_PIXEL', note: 'H2RG dark-current warm pixel masked' });
      }

      const normB64 = this._matrixToPngB64(mat, false);
      const invB64 = this._matrixToPngB64(mat, true);
      const rgbB64 = this._rgbMatricesToPngB64(chL, chM, chS);

      return {
        epoch_id: ep.id,
        label: ep.label,
        date: ep.date,
        mjd: ep.mjd,
        zodi_mjy_sr: zodi,
        image_b64: arraySelection === 'rgb' ? rgbB64 : normB64,
        rgb_b64: rgbB64,
        invert_b64: invB64,
        target_x: tx,
        target_y: ty,
        shift_ra_arcsec: shiftRaArcsec,
        shift_dec_arcsec: shiftDecArcsec,
        flags,
        raw_matrix: mat.map(r => Array.from(r))
      };
    });

    const cubeData = {
      target: bm.name,
      ra,
      dec,
      fov_arcmin: fovArcmin,
      npix,
      pixel_scale: pixelScale,
      array_selection: arraySelection,
      gaia_sources: gaiaSources,
      bg_stars: bgStars,
      epochs,
      wcs_header: { CTYPE1: 'RA---TAN', CTYPE2: 'DEC--TAN', CRVAL1: ra, CRVAL2: dec, CDELT1: -pixelScale / 3600, CDELT2: pixelScale / 3600 }
    };

    const diffData = this._synthesizeClientDifference(epochs[this.state.diffIdxA] || epochs[0], epochs[this.state.diffIdxB] || epochs[1], 0.5);

    // Coadd average
    const coaddMat = Array.from({ length: npix }, (_, y) =>
      Array.from({ length: npix }, (__, x) =>
        epochs.reduce((acc, e) => acc + e.raw_matrix[y][x], 0) / epochs.length
      )
    );
    const coaddData = {
      n_frames: epochs.length,
      snr_boost_factor: `${Math.sqrt(epochs.length).toFixed(2)}x`,
      coadd_b64: this._matrixToPngB64(coaddMat, false)
    };

    const specData = this._synthesizeClientSpectrum(bm.name, true, 5400);
    return { cubeData, diffData, coaddData, specData };
  }

  _synthesizeClientDifference(epA, epB, dtYears) {
    const matA = epA.raw_matrix;
    const matB = epB.raw_matrix;
    const npix = matA.length;

    const diff = Array.from({ length: npix }, (_, y) =>
      Array.from({ length: npix }, (__, x) => matB[y][x] - matA[y][x])
    );

    let maxAbs = 1.0;
    let maxPos = -999, posPt = [0, 0];
    let minNeg = 999, negPt = [0, 0];

    for (let y = 0; y < npix; y++) {
      for (let x = 0; x < npix; x++) {
        const v = diff[y][x];
        if (Math.abs(v) > maxAbs) maxAbs = Math.abs(v);
        if (v > maxPos) { maxPos = v; posPt = [x, y]; }
        if (v < minNeg) { minNeg = v; negPt = [x, y]; }
      }
    }

    const cv = document.createElement('canvas');
    cv.width = npix; cv.height = npix;
    const ctx = cv.getContext('2d');
    const imgData = ctx.createImageData(npix, npix);

    const vLim = Math.max(maxAbs * 0.65, 2.0);
    for (let y = 0; y < npix; y++) {
      for (let x = 0; x < npix; x++) {
        const idx = (y * npix + x) * 4;
        const n = Math.max(-1, Math.min(1, diff[y][x] / vLim));
        if (n >= 0) {
          imgData.data[idx] = Math.round(128 + n * 127);
          imgData.data[idx + 1] = Math.round(128 + n * 105);
          imgData.data[idx + 2] = Math.round(128 - n * 85);
        } else {
          const a = Math.abs(n);
          imgData.data[idx] = Math.round(128 - a * 105);
          imgData.data[idx + 1] = Math.round(128 + a * 35);
          imgData.data[idx + 2] = Math.round(128 + a * 127);
        }
        imgData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const candidates = [];
    const distPx = Math.hypot(posPt[0] - negPt[0], posPt[1] - negPt[1]);
    if (maxPos > 6 && minNeg < -6 && distPx >= 0.5 && distPx <= 35) {
      const dispArcsec = distPx * 6.2;
      const rate = dispArcsec / Math.max(0.1, dtYears);
      candidates.push({
        id: 'dipole_1',
        category: 'Moving Object Dipole',
        displacement_arcsec: dispArcsec.toFixed(2),
        proper_motion_rate: rate.toFixed(2),
        description: `Paired dark/bright dipole detected (${dispArcsec.toFixed(1)}″ shift across ${dtYears.toFixed(1)} yr → ~${rate.toFixed(1)}″/yr).`
      });
    } else if (maxPos > 8 || minNeg < -8) {
      candidates.push({
        id: 'variable_1',
        category: 'Variable / Transient',
        proper_motion_rate: null,
        description: `Stationary flux residual (ΔF = ${(maxPos > Math.abs(minNeg) ? '+' + maxPos.toFixed(1) : minNeg.toFixed(1))} MJy/sr) with zero astrometric shift.`
      });
    }

    return {
      epoch_a: epA.label,
      epoch_b: epB.label,
      dt_years: dtYears,
      difference_b64: cv.toDataURL('image/png').split(',')[1],
      candidates,
      has_dipole: candidates.some(c => c.category === 'Moving Object Dipole'),
      has_variable: candidates.some(c => c.category === 'Variable / Transient')
    };
  }

  _synthesizeClientSpectrum(targetName, isPrimaryTarget = true, bgTeff = 5400) {
    const pts = [];
    let classification = 'Field Star Photosphere (G/K Continuum)';

    for (let i = 0; i < 102; i++) {
      const arr = Math.floor(i / 17) + 1;
      const w = 0.75 + (i / 101) * (5.0 - 0.75);
      let f = 14.0;

      if (!isPrimaryTarget) {
        const peak = 2898 / bgTeff;
        f = 22.0 * Math.exp(-Math.pow(w - peak, 2) / 2.6) + 2.2;
      } else if (targetName.includes('WISE 0855')) {
        classification = 'Ultra-Cool Sub-Freezing Y-Dwarf (T ~ 250 K)';
        f = Math.pow(w / 5.0, 4.7) * 45.0;
        f *= 1 - 0.70 * Math.exp(-Math.pow(w - 3.05, 2) / (2 * 0.14 * 0.14)); // H2O Ice
        f *= 1 - 0.55 * Math.exp(-Math.pow(w - 3.30, 2) / (2 * 0.08 * 0.08)); // CH4
        if (w < 1.64) f = Math.min(f, 0.7);
      } else if (targetName.includes('Epsilon Indi')) {
        classification = 'T1 + T6 Binary Brown Dwarf';
        f = 36.0 * Math.exp(-Math.pow(w - 1.35, 2) / 2.2) + 4.0;
        f *= 1 - 0.62 * Math.exp(-Math.pow(w - 1.67, 2) / (2 * 0.07 * 0.07));
        f *= 1 - 0.65 * Math.exp(-Math.pow(w - 3.30, 2) / (2 * 0.10 * 0.10));
        f *= 1 - 0.48 * Math.exp(-Math.pow(w - 1.90, 2) / (2 * 0.09 * 0.09));
      } else if (targetName.includes('Barnard')) {
        classification = 'Late M-Dwarf Star (M4V)';
        f = 62.0 * Math.exp(-Math.pow(w - 1.15, 2) / 2.8) + 8.0;
        f *= 1 - 0.26 * Math.exp(-Math.pow(w - 2.32, 2) / (2 * 0.08 * 0.08));
        f *= 1 - 0.30 * Math.exp(-Math.pow(w - 4.67, 2) / (2 * 0.09 * 0.09));
      } else if (targetName.includes('RW Aur')) {
        classification = 'Young UXor T Tauri Star + Dust Disk';
        f = 28.0 * Math.exp(-Math.pow(w - 0.95, 2) / 1.9) + 15.0 * Math.pow(w / 3.0, 1.25);
        f += 7.5 * Math.exp(-Math.pow(w - 3.28, 2) / (2 * 0.06 * 0.06));
      } else if (targetName.includes('R Dra')) {
        classification = 'Pulsating AGB Mira Giant';
        f = 58.0 * Math.exp(-Math.pow(w - 1.6, 2) / 3.5) + 10.0;
        f *= 1 - 0.45 * Math.exp(-Math.pow(w - 4.67, 2) / (2 * 0.10 * 0.10));
        f *= 1 - 0.22 * Math.exp(-Math.pow(w - 4.27, 2) / (2 * 0.07 * 0.07));
      } else {
        classification = 'Outer Solar System / Near-IR Continuum';
        f = 22.0 * Math.exp(-Math.pow(w - 1.4, 2) / 3.2) + 4.0;
        f *= 1 - 0.35 * Math.exp(-Math.pow(w - 3.05, 2) / (2 * 0.14 * 0.14));
      }

      const noisy = Math.max(0.08, f + (Math.sin(i * 12.7) * 0.35));
      pts.push({
        band_index: i + 1,
        detector_array: arr,
        wavelength_um: Number(w.toFixed(4)),
        flux_mjy_sr: Number(noisy.toFixed(2)),
        uncertainty: Number((noisy * 0.03 + 0.15).toFixed(2))
      });
    }

    return {
      target: targetName,
      classification,
      total_bands: 102,
      molecular_markers: [
        { name: 'CH4 (Methane)', center_um: 1.67 },
        { name: 'H2O Ice (Crucial)', center_um: 3.05 },
        { name: 'CH4 / PAH', center_um: 3.30 },
        { name: 'CO2 (Fundamental)', center_um: 4.27 },
        { name: 'CO (Fundamental)', center_um: 4.67 }
      ],
      spectral_points: pts
    };
  }

  _matrixToPngB64(mat, invert = false) {
    const npix = mat.length;
    const flat = [];
    for (let y = 0; y < npix; y++) for (let x = 0; x < npix; x++) flat.push(mat[y][x]);
    flat.sort((a, b) => a - b);
    const vmin = flat[Math.floor(flat.length * 0.02)] || 0;
    const vmax = Math.max(vmin + 0.5, flat[Math.floor(flat.length * 0.995)] || 10);

    const cv = document.createElement('canvas');
    cv.width = npix; cv.height = npix;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(npix, npix);
    const denom = Math.asinh(10);

    for (let y = 0; y < npix; y++) {
      for (let x = 0; x < npix; x++) {
        const s = Math.max(0, Math.min(1, (mat[y][x] - vmin) / (vmax - vmin)));
        const st = Math.asinh(10 * s) / denom;
        const val = Math.round((invert ? 1 - st : st) * 255);
        const idx = (y * npix + x) * 4;
        img.data[idx] = val;
        img.data[idx + 1] = val;
        img.data[idx + 2] = val;
        img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return cv.toDataURL('image/png').split(',')[1];
  }

  _rgbMatricesToPngB64(rMat, gMat, bMat) {
    const npix = rMat.length;
    const stretchCh = (m) => {
      const flat = [];
      for (let y = 0; y < npix; y++) for (let x = 0; x < npix; x++) flat.push(m[y][x]);
      flat.sort((a, b) => a - b);
      const vmin = flat[Math.floor(flat.length * 0.03)] || 0;
      const vmax = Math.max(vmin + 1.0, flat[Math.floor(flat.length * 0.996)] || 12);
      const denom = Math.asinh(12);
      return { vmin, vmax, denom };
    };
    const sr = stretchCh(rMat), sg = stretchCh(gMat), sb = stretchCh(bMat);
    const cv = document.createElement('canvas');
    cv.width = npix; cv.height = npix;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(npix, npix);
    const mapV = (v, st) => Math.round((Math.asinh(12 * Math.max(0, Math.min(1, (v - st.vmin) / (st.vmax - st.vmin)))) / st.denom) * 255);

    for (let y = 0; y < npix; y++) {
      for (let x = 0; x < npix; x++) {
        const idx = (y * npix + x) * 4;
        img.data[idx] = mapV(rMat[y][x], sr);
        img.data[idx + 1] = mapV(gMat[y][x], sg);
        img.data[idx + 2] = mapV(bMat[y][x], sb);
        img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return cv.toDataURL('image/png').split(',')[1];
  }

  /* ========================================================================
     UI EVENT BINDINGS & ZOONIVERSE WORKFLOWS
     ======================================================================== */
  _bindAllControls() {
    // Theme Toggle
    document.getElementById('btn-theme-toggle').addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('spx_zoo_theme', next);
      this._updateThemeBtnLabel(next);
    });

    // Keyboard Shortcuts Help Modal
    document.getElementById('btn-shortcuts-modal').addEventListener('click', () => {
      this._openModal('Keyboard Shortcuts & Observer Controls', this._buildShortcutsHtml());
    });

    // Project Navigation Tabs (Classify, About, Talk, Collect, Recents)
    document.querySelectorAll('.zoo-nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const nav = tab.getAttribute('data-nav');
        if (nav === 'classify') {
          this._setActiveProjectNav('classify');
          this._closeModal();
        } else if (nav === 'about') {
          this._openModal('About SPHEREx: Planet X & 102-Band All-Sky Discovery', this._buildAboutHtml());
        } else if (nav === 'talk') {
          this._openModal('Talk & Discovery Log — Volunteer Classifications', this._buildTalkHtml());
        } else if (nav === 'collect') {
          this._openModal('Saved Subject Collections & Favorites', this._buildCollectionsHtml());
        } else if (nav === 'recents') {
          this._openModal('Recently Inspected Sky Coordinates', this._buildRecentsHtml());
        }
      });
    });

    // Coordinate Search Bar
    const searchInput = document.getElementById('target-input');
    const doSearch = async () => {
      const q = searchInput.value.trim();
      if (!q) return;
      this._setLoading(true);
      try {
        const resolved = await this._resolveQueryClientOrServer(q);
        await this.loadTarget(resolved.name, resolved.ra, resolved.dec);
        this.toast(`Pointed telescope to ${resolved.name} (RA ${resolved.ra.toFixed(3)}°, Dec ${resolved.dec.toFixed(3)}°)`);
      } catch (_) {
        this._setLoading(false);
        this.toast('Could not resolve coordinates. Enter RA, Dec (e.g. "133.795, -7.245") or a SIMBAD object name.');
      }
    };
    document.getElementById('btn-search').addEventListener('click', doSearch);
    searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });

    // Benchmark Quick Pills
    document.querySelectorAll('.target-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const key = pill.getAttribute('data-target');
        const info = BENCHMARK_CATALOG[key];
        if (info) {
          searchInput.value = info.name;
          this.loadTarget(info.name, info.ra, info.dec);
        }
      });
    });

    // FOV & Detector Array Selectors
    document.getElementById('fov-select').addEventListener('change', (e) => {
      this.state.fov = parseFloat(e.target.value);
      this.loadTarget(this.state.target, this.state.ra, this.state.dec);
    });

    document.getElementById('array-select').addEventListener('change', (e) => {
      this.state.arraySelection = e.target.value;
      if (this.state.arraySelection === 'rgb') {
        this.state.mode = 'rgb';
      } else if (this.state.mode === 'rgb') {
        this.state.mode = 'normal';
      }
      this.loadTarget(this.state.target, this.state.ra, this.state.dec);
    });

    // Viewer Top Switcher (Blinker vs Split Compare vs CDS Aladin Lite)
    document.querySelectorAll('.viewer-view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.viewer-view-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.activeView = btn.getAttribute('data-view');

        const blinkCanvas = document.getElementById('blink-canvas');
        const splitBox = document.getElementById('split-compare-container');
        const aladinWrap = document.getElementById('aladin-wrapper');

        blinkCanvas.style.display = this.state.activeView === 'blink' ? 'block' : 'none';
        splitBox.style.display = this.state.activeView === 'split' ? 'grid' : 'none';
        aladinWrap.style.display = this.state.activeView === 'aladin' ? 'block' : 'none';

        if (this.state.activeView === 'aladin') {
          this.aladin.goto(this.state.ra, this.state.dec, this.state.fov / 60.0);
        } else {
          this.blinker.render();
        }
      });
    });

    // Aladin Survey Chips
    document.querySelectorAll('.survey-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.survey-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.aladin.setSurvey(chip.getAttribute('data-survey'));
      });
    });

    // Vertical Zooniverse Subject Toolbar Icons
    document.getElementById('tool-inspect').addEventListener('click', () => this._selectPointerTool('inspect'));
    document.getElementById('tool-mark').addEventListener('click', () => this._selectPointerTool('mark'));
    document.getElementById('tool-pan').addEventListener('click', () => this._selectPointerTool('pan'));
    document.getElementById('tool-zoom-in').addEventListener('click', () => this.blinker.zoomBy(1.35));
    document.getElementById('tool-zoom-out').addEventListener('click', () => this.blinker.zoomBy(1 / 1.35));
    document.getElementById('tool-reset').addEventListener('click', () => {
      this.blinker.resetView();
      document.getElementById('slider-brightness').value = 100;
      document.getElementById('slider-contrast').value = 100;
      document.getElementById('lbl-brightness').textContent = '100%';
      document.getElementById('lbl-contrast').textContent = '100%';
      this.toast('Reset zoom, pan, brightness & contrast.');
    });

    document.getElementById('tool-invert').addEventListener('click', () => {
      this._setDisplayMode(this.state.mode === 'inverted' ? 'normal' : 'inverted');
    });
    document.getElementById('tool-rgb').addEventListener('click', () => {
      this._setDisplayMode(this.state.mode === 'rgb' ? 'normal' : 'rgb');
    });
    document.getElementById('tool-diff').addEventListener('click', () => {
      this._setDisplayMode(this.state.mode === 'difference' ? 'normal' : 'difference');
    });
    document.getElementById('tool-coadd').addEventListener('click', () => {
      this._setDisplayMode(this.state.mode === 'coadd' ? 'normal' : 'coadd');
    });

    // Brightness / Contrast Popover
    const pop = document.getElementById('stretch-popover');
    document.getElementById('tool-stretch').addEventListener('click', () => {
      pop.classList.toggle('open');
    });
    document.getElementById('btn-close-stretch').addEventListener('click', () => pop.classList.remove('open'));
    document.getElementById('slider-brightness').addEventListener('input', (e) => {
      this.blinker.brightness = parseInt(e.target.value, 10);
      document.getElementById('lbl-brightness').textContent = `${e.target.value}%`;
      this.blinker.render();
    });
    document.getElementById('slider-contrast').addEventListener('input', (e) => {
      this.blinker.contrast = parseInt(e.target.value, 10);
      document.getElementById('lbl-contrast').textContent = `${e.target.value}%`;
      this.blinker.render();
    });

    // Overlays: Grid, Gaia DR3, Contamination Flags
    document.getElementById('tool-grid').addEventListener('click', (e) => {
      this.blinker.showGrid = !this.blinker.showGrid;
      e.currentTarget.classList.toggle('active-gold', this.blinker.showGrid);
      this.blinker.render();
    });
    document.getElementById('tool-gaia').addEventListener('click', (e) => {
      this.blinker.showGaia = !this.blinker.showGaia;
      e.currentTarget.classList.toggle('active-gold', this.blinker.showGaia);
      this.blinker.render();
    });
    document.getElementById('tool-flags').addEventListener('click', (e) => {
      this.blinker.showFlags = !this.blinker.showFlags;
      e.currentTarget.classList.toggle('active-gold', this.blinker.showFlags);
      this.blinker.render();
    });

    // Flipbook Scrubber Controls
    document.getElementById('btn-play').addEventListener('click', () => {
      if (this.blinker.isPlaying) this.blinker.stop();
      else {
        if (this.state.mode === 'difference' || this.state.mode === 'coadd') {
          this._setDisplayMode('normal');
        }
        this.blinker.start();
      }
      this._syncPlayPauseUI();
    });
    document.getElementById('btn-prev').addEventListener('click', () => {
      this.blinker.stepBackward();
      this._syncPlayPauseUI();
    });
    document.getElementById('btn-next').addEventListener('click', () => {
      this.blinker.stepForward();
      this._syncPlayPauseUI();
    });
    document.getElementById('speed-select').addEventListener('change', (e) => {
      this.blinker.setFps(parseFloat(e.target.value));
    });

    // Difference Epoch Pair selectors
    const onDiffPairChange = async () => {
      this.state.diffIdxA = parseInt(document.getElementById('diff-epoch-a').value, 10);
      this.state.diffIdxB = parseInt(document.getElementById('diff-epoch-b').value, 10);
      if (this.state.currentCube) {
        const diffData = await this._computeDifferencePair(this.state.currentCube, this.state.diffIdxA, this.state.diffIdxB);
        this.state.currentDiff = diffData;
        this.blinker.updateDifferenceImage(diffData);
        this._renderDetectionsAndMarkers();
      }
    };
    document.getElementById('diff-epoch-a').addEventListener('change', onDiffPairChange);
    document.getElementById('diff-epoch-b').addEventListener('change', onDiffPairChange);

    // Subject Bottom-Right Actions (Metadata 'i', Favorite, Collect, GIF, Share)
    document.getElementById('btn-subject-info').addEventListener('click', () => {
      this._openModal(`Subject Metadata & Contamination Flags — #${this.state.subjectId}`, this._buildMetadataHtml());
    });
    document.getElementById('btn-favorite').addEventListener('click', () => this._toggleFavorite());
    document.getElementById('btn-collect').addEventListener('click', () => {
      this._toggleFavorite(true);
      this._openModal('Saved Subject Collections & Favorites', this._buildCollectionsHtml());
    });
    document.getElementById('btn-export-gif').addEventListener('click', () => {
      const ok = window.ExportTools.exportBlinkGif(this.blinker, `SPHEREx_${this.state.subjectId}_blink.gif`);
      if (ok) this.toast('Exported animated blinking GIF!');
    });
    document.getElementById('btn-share').addEventListener('click', () => {
      const shareUrl = window.ExportTools.syncBrowserUrl(this.state);
      this._openModal('Share & Embed Coordinate View', this._buildShareEmbedHtml(shareUrl));
    });

    // Right Panel: Task vs Tutorial Tabs
    document.querySelectorAll('.zoo-task-tab').forEach(t => {
      t.addEventListener('click', () => {
        document.querySelectorAll('.zoo-task-tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        const which = t.getAttribute('data-tab');
        document.getElementById('tab-body-task').classList.toggle('hidden', which !== 'task');
        document.getElementById('tab-body-tutorial').classList.toggle('hidden', which !== 'tutorial');
      });
    });

    // Classification Choices
    document.querySelectorAll('.zoo-choice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.zoo-choice-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.state.selectedChoice = btn.getAttribute('data-choice');
      });
    });

    document.getElementById('btn-need-help').addEventListener('click', () => {
      this._openModal('Classification Guide: Spotting Dipoles vs Variable Stars', this._buildNeedHelpHtml());
    });

    document.getElementById('btn-export-csv').addEventListener('click', () => {
      window.ExportTools.exportDiscoveriesCSV(
        this.classifications,
        this.state.currentDiff?.candidates || [],
        this.state
      );
      this.toast('Downloaded Citizen Science CSV Discovery Report.');
    });

    // Done & Talk / Done Buttons
    document.getElementById('btn-done-submit').addEventListener('click', () => this._submitClassification(false));
    document.getElementById('btn-done-talk').addEventListener('click', () => this._submitClassification(true));

    // Pull-Out Field Guide Drawer
    const drawer = document.getElementById('field-guide-drawer');
    document.getElementById('btn-field-guide').addEventListener('click', () => drawer.classList.toggle('open'));
    document.getElementById('btn-close-drawer').addEventListener('click', () => drawer.classList.remove('open'));
    document.querySelectorAll('.fg-load-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-fg-target');
        const info = BENCHMARK_CATALOG[key];
        if (info) {
          document.getElementById('target-input').value = info.name;
          this.loadTarget(info.name, info.ra, info.dec);
          drawer.classList.remove('open');
        }
      });
    });

    // Modal Backdrop Close
    document.getElementById('btn-close-modal').addEventListener('click', () => this._closeModal());
    document.getElementById('zoo-modal-backdrop').addEventListener('click', (e) => {
      if (e.target.id === 'zoo-modal-backdrop') this._closeModal();
    });
  }

  _bindKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      const k = e.key.toLowerCase();
      if (e.code === 'Space') {
        e.preventDefault();
        document.getElementById('btn-play').click();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        document.getElementById('btn-next').click();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        document.getElementById('btn-prev').click();
      } else if (k === 'i') document.getElementById('tool-invert').click();
      else if (k === 'r') document.getElementById('tool-rgb').click();
      else if (k === 'd') document.getElementById('tool-diff').click();
      else if (k === 'c') document.getElementById('tool-coadd').click();
      else if (k === 's') this._selectPointerTool('inspect');
      else if (k === 'm') this._selectPointerTool('mark');
      else if (k === 'p') this._selectPointerTool('pan');
      else if (k === 'g') document.getElementById('tool-grid').click();
      else if (k === 'f') document.getElementById('tool-flags').click();
      else if (e.key === '+' || e.key === '=') this.blinker.zoomBy(1.3);
      else if (e.key === '-') this.blinker.zoomBy(1 / 1.3);
      else if (e.key === '0') document.getElementById('tool-reset').click();
    });
  }

  _selectPointerTool(tool) {
    this.blinker.setActiveTool(tool);
    ['inspect', 'mark', 'pan'].forEach(t => {
      document.getElementById(`tool-${t}`).classList.toggle('active', t === tool);
    });
  }

  _setDisplayMode(mode) {
    this.state.mode = mode;
    this.blinker.setDisplayMode(mode);
    if (mode === 'difference' || mode === 'coadd') {
      this.blinker.stop();
    }
    this._syncDisplayModeToolbar();
    this._syncPlayPauseUI();
    window.ExportTools.syncBrowserUrl(this.state);
  }

  _syncDisplayModeToolbar() {
    document.getElementById('tool-invert').classList.toggle('active', this.state.mode === 'inverted');
    document.getElementById('tool-rgb').classList.toggle('active', this.state.mode === 'rgb');
    document.getElementById('tool-diff').classList.toggle('active', this.state.mode === 'difference');
    document.getElementById('tool-coadd').classList.toggle('active', this.state.mode === 'coadd');
    document.getElementById('diff-pair-bar').classList.toggle('visible', this.state.mode === 'difference');

    const modeNames = {
      normal: 'STANDARD NIR',
      inverted: 'INVERTED NEGATIVE',
      rgb: 'FALSE-COLOR RGB (ARR 1/3/6)',
      difference: 'EPOCH DIFFERENCE (B − A)',
      coadd: 'STACKED COADD (SNR BOOST)'
    };
    document.getElementById('hud-mode-badge').textContent = modeNames[this.state.mode] || 'STANDARD NIR';
  }

  _populateEpochControls(epochs) {
    const dotsBox = document.getElementById('epoch-dots-container');
    const selA = document.getElementById('diff-epoch-a');
    const selB = document.getElementById('diff-epoch-b');
    dotsBox.innerHTML = '';
    selA.innerHTML = '';
    selB.innerHTML = '';

    epochs.forEach((ep, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `epoch-dot-btn ${idx === 0 ? 'active' : ''}`;
      btn.textContent = idx === 4 ? 'W10' : `E${idx + 1}`;
      btn.setAttribute('data-tip-title', ep.label);
      btn.setAttribute('data-tip-body', `Click to jump directly to ${ep.label} (MJD ${ep.mjd}). Watch how nearby objects shift position relative to other frames.`);
      btn.addEventListener('click', () => {
        this.blinker.stop();
        if (this.state.mode === 'difference' || this.state.mode === 'coadd') {
          this._setDisplayMode('normal');
        }
        this.blinker.goToEpoch(idx);
        this._syncPlayPauseUI();
      });
      dotsBox.appendChild(btn);

      const optA = new Option(ep.label, idx, idx === this.state.diffIdxA, idx === this.state.diffIdxA);
      const optB = new Option(ep.label, idx, idx === this.state.diffIdxB, idx === this.state.diffIdxB);
      selA.add(optA);
      selB.add(optB);
    });
  }

  _onEpochChanged(epoch, index) {
    if (!epoch) return;
    document.getElementById('hud-epoch-label').textContent = `${epoch.label}  •  MJD ${epoch.mjd}`;
    document.querySelectorAll('.epoch-dot-btn').forEach((b, idx) => {
      b.classList.toggle('active', idx === index);
    });
  }

  _onPixelHover(pos) {
    const fStr = pos.flux !== null && pos.flux !== undefined ? `  |  Flux: ${pos.flux.toFixed(2)} MJy/sr` : '';
    document.getElementById('hud-cursor-coords').textContent =
      `Pix (${pos.dataX.toFixed(1)}, ${pos.dataY.toFixed(1)})  |  RA ${pos.ra.toFixed(5)}°  Dec ${pos.dec >= 0 ? '+' : ''}${pos.dec.toFixed(5)}°${fStr}`;
  }

  async _onPixelClicked(pos) {
    document.getElementById('sed-aperture-coords').textContent =
      `Aperture @ Pix (${pos.dataX.toFixed(1)}, ${pos.dataY.toFixed(1)}) • RA ${pos.ra.toFixed(4)}°, Dec ${pos.dec.toFixed(4)}°`;

    const distToTarget = Math.hypot(pos.dataX - pos.targetX, pos.dataY - pos.targetY);
    if (this.usingBackend) {
      try {
        const res = await fetch(`${this.apiBase}/api/spectrum`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target_name: this.state.target,
            pixel_x: pos.dataX,
            pixel_y: pos.dataY,
            center_x: pos.targetX,
            center_y: pos.targetY
          })
        });
        if (res.ok) {
          const specData = await res.json();
          this.state.currentSpectrum = specData;
          this.sedChart.renderSpectrum(specData);
          document.getElementById('sed-classification-badge').textContent = specData.classification;
          return;
        }
      } catch (_) {}
    }

    const isPrimary = distToTarget <= 3.2;
    const specData = this._synthesizeClientSpectrum(this.state.target, isPrimary, 4200 + ((Math.round(pos.dataX * 199) % 4500)));
    this.state.currentSpectrum = specData;
    this.sedChart.renderSpectrum(specData);
    document.getElementById('sed-classification-badge').textContent = specData.classification;
  }

  _renderDetectionsAndMarkers() {
    const box = document.getElementById('candidates-list');
    box.innerHTML = '';

    const markers = this.blinker?.markers || [];
    markers.forEach((m, idx) => {
      const div = document.createElement('div');
      div.className = 'detection-row user-mark';
      div.innerHTML = `
        <div>
          <strong style="color:var(--zoo-gold);">Volunteer Marker #${idx + 1}</strong>
          <div style="font-family:var(--font-mono); font-size:0.71rem; color:var(--text-secondary);">
            RA ${m.ra.toFixed(5)}°, Dec ${m.dec.toFixed(5)}° (${m.epochLabel})
          </div>
        </div>
        <button type="button" class="remove-mark-btn" data-tip-title="Remove Marker" data-tip-body="Delete this candidate reticle from the subject viewer.">✕</button>
      `;
      div.querySelector('.remove-mark-btn').addEventListener('click', () => this.blinker.removeMarker(m.id));
      box.appendChild(div);
    });

    const autoCands = this.state.currentDiff?.candidates || [];
    autoCands.slice(0, 3).forEach(c => {
      const div = document.createElement('div');
      div.className = 'detection-row';
      const rateBadge = c.proper_motion_rate ? `${c.proper_motion_rate}″/yr` : 'ΔFlux Variable';
      div.innerHTML = `
        <div style="display:flex; justify-content:space-between; font-weight:700; margin-bottom:2px;">
          <span>Pipeline Hint: ${c.category}</span>
          <span style="font-family:var(--font-mono); color:var(--zoo-teal-hover);">${rateBadge}</span>
        </div>
        <div style="color:var(--text-secondary); font-size:0.74rem;">${c.description}</div>
      `;
      box.appendChild(div);
    });

    if (!markers.length && !autoCands.length) {
      box.innerHTML = '<div style="font-size:0.76rem; color:var(--text-muted);">No dipole markers yet. Select the Crosshair Marker tool (M) on the right toolbar to tag moving objects!</div>';
    }
  }

  _submitClassification(openTalkAfter = false) {
    const choice = this.state.selectedChoice || 'Fast-Moving Dipole / Brown Dwarf';
    const topAuto = (this.state.currentDiff?.candidates || [])[0];
    const entry = {
      id: 'CLS-' + Date.now(),
      subjectId: this.state.subjectId,
      target: this.state.target,
      ra: this.state.ra,
      dec: this.state.dec,
      choice,
      pmRate: topAuto?.proper_motion_rate ? `${topAuto.proper_motion_rate} arcsec/yr` : 'Stationary / Visual',
      markers: [...(this.blinker.markers || [])],
      spectralClass: this.state.currentSpectrum?.classification || 'NIR Source',
      timestamp: new Date().toISOString()
    };

    this.classifications.unshift(entry);
    this._saveStorage('spx_classifications', this.classifications.slice(0, 100));
    this._updateNavCounters();

    document.querySelectorAll('.zoo-choice-btn').forEach(b => b.classList.remove('selected'));
    this.state.selectedChoice = null;

    if (openTalkAfter) {
      this._openModal('Talk & Discovery Log — Classification Submitted!', this._buildTalkHtml());
    } else {
      this.toast(`Classification saved for ${this.state.target}! (${this.classifications.length} total logged)`);
    }
  }

  _toggleFavorite(forceAdd = false) {
    const idx = this.favorites.findIndex(f => f.target === this.state.target);
    if (idx >= 0 && !forceAdd) {
      this.favorites.splice(idx, 1);
      this.toast(`Removed ${this.state.target} from Favorites.`);
    } else if (idx < 0) {
      this.favorites.unshift({
        subjectId: this.state.subjectId,
        target: this.state.target,
        ra: this.state.ra,
        dec: this.state.dec,
        savedAt: new Date().toLocaleString()
      });
      this.toast(`Saved ${this.state.target} to your Zooniverse Collection!`);
    }
    this._saveStorage('spx_favorites', this.favorites);
    this._syncFavoriteUI();
    this._updateNavCounters();
  }

  _recordRecentTarget() {
    this.recents = this.recents.filter(r => r.target !== this.state.target);
    this.recents.unshift({
      subjectId: this.state.subjectId,
      target: this.state.target,
      ra: this.state.ra,
      dec: this.state.dec,
      viewedAt: new Date().toLocaleTimeString()
    });
    this.recents = this.recents.slice(0, 20);
    this._saveStorage('spx_recents', this.recents);
  }

  /* ========================================================================
     MODAL CONTENT BUILDERS & HELPERS
     ======================================================================== */
  _buildMetadataHtml() {
    const c = this.state.currentCube || {};
    const ep = (c.epochs || [])[this.blinker?.currentIndex || 0] || {};
    const flags = (c.epochs || []).flatMap(e => (e.flags || []).map(f => ({ ...f, epoch: e.label })));
    const flagRows = flags.length
      ? flags.map(f => `<div style="padding:0.4rem 0.6rem; background:var(--zoo-coral-subtle); border-left:3px solid var(--zoo-coral); margin-top:0.35rem; font-family:var(--font-mono); font-size:0.75rem;">
          <strong>[${f.flag} | BIT ${f.bit}]</strong> ${f.epoch} @ Pix(${f.x}, ${f.y}) — ${f.note}
        </div>`).join('')
      : '<p style="font-size:0.8rem;">0 contamination bitmask warnings in current cutout.</p>';

    return `
      <table class="meta-table">
        <tr><th>Subject ID</th><td>#${this.state.subjectId}</td></tr>
        <tr><th>Target Designation</th><td>${this.state.target}</td></tr>
        <tr><th>ICRS Right Ascension</th><td>${this.state.ra.toFixed(6)}° (${this._degToHms(this.state.ra)})</td></tr>
        <tr><th>ICRS Declination</th><td>${this.state.dec.toFixed(6)}° (${this._degToDms(this.state.dec)})</td></tr>
        <tr><th>Field of View / Grid</th><td>${this.state.fov.toFixed(1)} arcmin (${c.npix || 77} × ${c.npix || 77} px @ 6.2″/px)</td></tr>
        <tr><th>Active Detector Filter</th><td>${this.state.arraySelection.toUpperCase()} (102 LVF Channels, 0.75–5.00 µm)</td></tr>
        <tr><th>Active Frame MJD</th><td>${ep.mjd || 60810} (${ep.date || '2025-05-15'})</td></tr>
        <tr><th>Zodiacal Dust Model (ZODI)</th><td>${ep.zodi_mjy_sr || 0.45} MJy/sr</td></tr>
        <tr><th>Spectral Classification</th><td>${this.state.currentSpectrum?.classification || 'Near-IR Source'}</td></tr>
      </table>
      <h4 style="margin-top:1rem; font-family:var(--font-display); text-transform:uppercase; letter-spacing:0.05em;">SPHEREx Level-2 MEF Contamination Flags (FLAGS HDU)</h4>
      ${flagRows}
    `;
  }

  _buildShareEmbedHtml(shareUrl) {
    const embedCode = `<iframe src="${shareUrl}&embed=true" width="900" height="640" style="border:1px solid #00979d; border-radius:4px;" allowfullscreen></iframe>`;
    return `
      <p style="margin-bottom:0.6rem;">Share this exact sky coordinate, FOV, detector array, and display mode directly with collaborators or embed it into websites and Zooniverse Talk posts:</p>
      <label style="font-size:0.75rem; font-weight:700; text-transform:uppercase;">Direct Deep-Link URL</label>
      <input type="text" readonly value="${shareUrl}" onclick="this.select(); navigator.clipboard.writeText(this.value);" style="width:100%; padding:0.55rem; margin:0.3rem 0 0.9rem; background:var(--bg-input); border:1px solid var(--border-primary); font-family:var(--font-mono); font-size:0.76rem;">
      <label style="font-size:0.75rem; font-weight:700; text-transform:uppercase;">Embeddable HTML Widget</label>
      <textarea rows="3" readonly onclick="this.select(); navigator.clipboard.writeText(this.value);" style="width:100%; padding:0.55rem; margin-top:0.3rem; background:var(--bg-input); border:1px solid var(--border-primary); font-family:var(--font-mono); font-size:0.75rem;">${embedCode}</textarea>
      <p style="margin-top:0.55rem; font-size:0.76rem; color:var(--zoo-teal-hover);">Tip: Click either box to copy automatically to your clipboard.</p>
    `;
  }

  _buildAboutHtml() {
    return `
      <p style="margin-bottom:0.8rem;"><strong>SPHEREx (Spectro-Photometer for the History of the Universe, Epoch of Reionization and Ices Explorer)</strong> maps the entire sky every six months across <strong>102 near-infrared spectral bands (0.75 – 5.0 µm)</strong> using six HgCdTe H2RG detector arrays equipped with Linear Variable Filters (LVFs).</p>
      <p style="margin-bottom:0.8rem;">Inspired by NASA Citizen Science projects such as <em>Backyard Worlds: Planet 9</em> and Zooniverse's <em>Overlap Zoo</em>, this workstation empowers anyone to:</p>
      <ul style="padding-left:1.2rem; display:flex; flex-direction:column; gap:0.4rem; margin-bottom:0.9rem;">
        <li><strong>Blink Multi-Epoch Sky Cutouts:</strong> Spot nearby brown dwarfs, stars, comets, asteroids, and distant Planet X candidates shifting across 6-month SPHEREx surveys and 15-year WISE baselines.</li>
        <li><strong>Subtract & Stack Epochs:</strong> Use <em>Difference Mode (Epoch B − Epoch A)</em> to cancel static stars and reveal black/amber motion dipoles or stationary variable-star residuals.</li>
        <li><strong>Extract On-The-Fly 102-Band Spectra:</strong> Click any source to inspect water ice (3.05 µm), carbon dioxide (4.27 µm), carbon monoxide (4.67 µm), and methane (1.67 & 3.30 µm).</li>
      </ul>
    `;
  }

  _buildTalkHtml() {
    if (!this.classifications.length) {
      return `<p>You haven't submitted any classifications yet. Select an observation in the <strong>Task</strong> panel and click <strong>Done</strong> or <strong>Done & Talk</strong>!</p>`;
    }
    const rows = this.classifications.map(c => `
      <div style="padding:0.7rem; background:var(--bg-elevated); border:1px solid var(--border-primary); border-left:3px solid var(--zoo-teal); border-radius:4px; margin-bottom:0.55rem;">
        <div style="display:flex; justify-content:space-between; font-weight:700;">
          <span>#${c.subjectId} — ${c.target}</span>
          <span style="font-family:var(--font-mono); font-size:0.72rem; color:var(--zoo-gold);">${c.choice}</span>
        </div>
        <div style="font-family:var(--font-mono); font-size:0.73rem; margin-top:0.25rem;">
          RA ${c.ra.toFixed(4)}°, Dec ${c.dec.toFixed(4)}°  |  Motion: ${c.pmRate}  |  Markers: ${c.markers.length}  |  SED: ${c.spectralClass}
        </div>
      </div>
    `).join('');
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
        <span><strong>${this.classifications.length}</strong> Logged Citizen Science Classifications</span>
        <button type="button" onclick="document.getElementById('btn-export-csv').click()" class="zoo-btn-teal" style="border-radius:4px; height:30px;">Download CSV Report</button>
      </div>
      ${rows}
    `;
  }

  _buildCollectionsHtml() {
    if (!this.favorites.length) {
      return `<p>No saved subjects yet. Click the <strong>♡ Favorite</strong> or <strong>⊞ Collect</strong> icon below the sky viewer to bookmark interesting coordinates!</p>`;
    }
    return this.favorites.map((f, i) => `
      <div style="padding:0.65rem; background:var(--bg-elevated); border:1px solid var(--border-primary); border-radius:4px; margin-bottom:0.5rem; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <strong>${f.target}</strong> <span style="font-family:var(--font-mono); font-size:0.73rem;">(RA ${f.ra.toFixed(3)}°, Dec ${f.dec.toFixed(3)}°)</span>
          <div style="font-size:0.72rem; color:var(--text-muted);">Saved ${f.savedAt}</div>
        </div>
        <button type="button" class="zoo-btn-teal" style="border-radius:4px; height:30px;" onclick="window.app.loadTarget('${f.target.replace(/'/g, "\\'")}', ${f.ra}, ${f.dec}); window.app._closeModal();">Load Patch</button>
      </div>
    `).join('');
  }

  _buildRecentsHtml() {
    return this.recents.map(r => `
      <div style="padding:0.6rem; background:var(--bg-elevated); border:1px solid var(--border-primary); border-radius:4px; margin-bottom:0.45rem; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <strong>${r.target}</strong>
          <span style="font-family:var(--font-mono); font-size:0.73rem; margin-left:0.4rem;">RA ${r.ra.toFixed(3)}°, Dec ${r.dec.toFixed(3)}°</span>
        </div>
        <button type="button" class="zoo-btn-teal" style="border-radius:4px; height:28px;" onclick="window.app.loadTarget('${r.target.replace(/'/g, "\\'")}', ${r.ra}, ${r.dec}); window.app._closeModal();">Inspect</button>
      </div>
    `).join('');
  }

  _buildNeedHelpHtml() {
    return `
      <div style="display:flex; flex-direction:column; gap:0.75rem;">
        <div><strong>1. Moving Dipole (Stars, Brown Dwarfs, Asteroids, Planet X):</strong> In <em>Blink</em> mode, the dot hops across frames. In <em>Difference</em> mode (shortcut <kbd>D</kbd>), it forms a paired cyan hole (old position) + bright amber peak (new position).</div>
        <div><strong>2. Ultra-Cool Brown Dwarfs (like WISE 0855):</strong> Try switching the <em>Detector Array</em> dropdown from <code>Array 1</code> (vanishes!) to <code>Array 6 (4.4–5.0 µm)</code> or <code>RGB False-Color</code> (glows vivid red!). Click the object to confirm CH₄ and 3.05 µm H₂O Ice absorption in the 102-band plot.</div>
        <div><strong>3. Stationary Variable Stars (like RW Aurigae & R Draconis):</strong> The star stays at the exact same pixel coordinates, pulsing brighter or dimmer. In <em>Difference</em> mode it creates a single isolated ring/spot without a paired dipole.</div>
        <div><strong>4. Cosmic Rays & Detector Flags:</strong> Single-frame spikes flagged with red triangles (<kbd>F</kbd> toggle) are high-energy particle hits on the HgCdTe detector, not celestial objects.</div>
      </div>
    `;
  }

  _buildShortcutsHtml() {
    const keys = [
      ['Space', 'Play / Pause multi-epoch blink animation'],
      ['← / →', 'Step backward / forward one SPHEREx survey epoch'],
      ['S', 'Select Spectrum Pointer Tool (click any star to extract 102-band SED)'],
      ['M', 'Select Candidate Marker Tool (place numbered discovery reticles)'],
      ['P', 'Select Pan Tool (drag zoomed sky cutout)'],
      ['I', 'Toggle Inverted Negative greyscale mode'],
      ['R', 'Toggle 3-Band False-Color RGB infrared composite'],
      ['D', 'Toggle Difference Subtraction mode (Epoch B − Epoch A)'],
      ['C', 'Toggle Multi-Epoch Coaddition stack (SNR boost)'],
      ['G / F', 'Toggle WCS Celestial Grid (G) or Contamination Flags (F)'],
      ['+ / - / 0', 'Zoom In, Zoom Out, or Reset View']
    ];
    return `<table class="meta-table">${keys.map(([k, d]) => `<tr><th><kbd>${k}</kbd></th><td>${d}</td></tr>`).join('')}</table>`;
  }

  _openModal(title, bodyHtml) {
    document.getElementById('zoo-modal-title').textContent = title;
    document.getElementById('zoo-modal-body').innerHTML = bodyHtml;
    document.getElementById('zoo-modal-backdrop').classList.add('open');
  }

  _closeModal() {
    document.getElementById('zoo-modal-backdrop').classList.remove('open');
  }

  _setActiveProjectNav(id) {
    document.querySelectorAll('.zoo-nav-tab').forEach(t => {
      t.classList.toggle('active', t.getAttribute('data-nav') === id);
    });
  }

  _syncPlayPauseUI() {
    const btn = document.getElementById('btn-play');
    const playing = this.blinker.isPlaying;
    btn.classList.toggle('play-active', playing);
    btn.innerHTML = playing
      ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause'
      : '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Play';
  }

  _syncFavoriteUI() {
    const isFav = this.favorites.some(f => f.target === this.state.target);
    const btn = document.getElementById('btn-favorite');
    btn.classList.toggle('favorited', isFav);
  }

  _updateNavCounters() {
    document.getElementById('talk-count-pill').textContent = this.classifications.length;
    document.getElementById('collect-count-pill').textContent = this.favorites.length;
  }

  _updateThemeBtnLabel(theme) {
    const span = document.getElementById('theme-btn-label');
    if (span) span.textContent = theme === 'dark' ? 'Light Theme' : 'Dark Theme';
  }

  _setEngineStatus(isAstropyLive) {
    const dot = document.getElementById('engine-status-dot');
    const txt = document.getElementById('engine-status-text');
    if (dot && txt) {
      dot.classList.toggle('standalone', !isAstropyLive);
      txt.textContent = isAstropyLive ? 'Astropy Live API' : 'Browser Physics Engine';
    }
  }

  _setLoading(show) {
    const veil = document.getElementById('viewer-loading');
    if (veil) veil.style.display = show ? 'flex' : 'none';
  }

  toast(msg) {
    const el = document.getElementById('zoo-toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }

  _degToHms(raDeg) {
    const totalSec = (((raDeg % 360) + 360) % 360) / 15 * 3600;
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = (totalSec % 60).toFixed(1);
    return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(4, '0')}s`;
  }

  _degToDms(decDeg) {
    const sign = decDeg >= 0 ? '+' : '-';
    const absSec = Math.abs(decDeg) * 3600;
    const d = Math.floor(absSec / 3600);
    const m = Math.floor((absSec % 3600) / 60);
    const s = Math.round(absSec % 60);
    return `${sign}${String(d).padStart(2, '0')}° ${String(m).padStart(2, '0')}′ ${String(s).padStart(2, '0')}″`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new SPHERExZooApp();
  window.app.init();
});
