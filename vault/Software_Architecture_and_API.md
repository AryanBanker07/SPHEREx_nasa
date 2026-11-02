# Software Architecture and API Reference

**Project:** SPHEREx Time-Domain Sky Explorer  
**Compliance Standards:** ECC Python & Web Architecture Guidelines  

---

## 1. System Topology

```
[Browser Client (WebGL2, Canvas2D, Aladin Lite v3)]
                   │   ▲
  HTTP REST / JSON │   │ Multi-Epoch Cutout Blobs & SED Arrays
                   ▼   │
     [FastAPI Server (create_app Factory)]
                   │
    ┌──────────────┼──────────────┐
    ▼              ▼              ▼
Coordinate      SPHEREx       Difference &
Resolver        Engine        Coadd Engine
(Astropy WCS    (FITS MEF,    (Matrix Subtraction,
 & SkyCoord)     6 Arrays)     Dipole Detection)
```

---

## 2. API Endpoints

### `GET /api/targets`
Returns pre-indexed challenge benchmark targets with known astrometric and photometric parameters.

### `POST /api/resolve`
Resolves target names or celestial coordinates via Astropy `SkyCoord` and CDS Sesame.
- **Request Body:** `{ "query": "Barnard's Star" }` or `{ "query": "269.452, 4.693" }`
- **Response:** `{ "name": "...", "ra": 269.452083, "dec": 4.693333, "ra_hms": "...", "dec_dms": "...", "galactic_l": ..., "galactic_b": ... }`

### `POST /api/cutout`
Generates multi-epoch near-IR cutouts for blinking analysis.
- **Request Body:** `{ "ra": 269.452, "dec": 4.693, "fov_arcmin": 8.0, "array_selection": "all" }`
- **Response:** `{ "target": "...", "npix": 77, "pixel_scale": 6.2, "epochs": [...], "wcs_header": {...} }`

### `POST /api/difference`
Performs epoch subtraction, automated dipole detection, and bipolar image rendering.
- **Request Body:** `{ "matrix_a": [...], "matrix_b": [...], "dt_years": 0.5 }`
- **Response:** `{ "difference_b64": "...", "sigma": 0.22, "candidates": [...], "has_dipole": true }`

### `POST /api/spectrum`
Extracts on-the-fly 102-band spectrophotometric SED and identifies diagnostic molecular absorption bands.
- **Request Body:** `{ "target_name": "WISE 0855-0714", "pixel_x": 38, "pixel_y": 38 }`
- **Response:** `{ "classification": "...", "matched_features": [...], "spectral_points": [...] }`

---

## 3. Technology Stack

- **Backend:** Python 3.10, FastAPI 0.162, Astropy 6.1, PyVO 1.9, NumPy 2.2, Pillow 12.0, Uvicorn 0.52.
- **Frontend:** HTML5, CSS3 (Modern Dark Astronomical Design System), JavaScript (ES6+), WebGL2, Canvas 2D, Chart.js, CDS Aladin Lite v3.

