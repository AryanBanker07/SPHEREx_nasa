# SPHEREx Sky Explorer: Zooniverse Redesign, Deployment & Repository Links

**Challenge:** NASA Space Apps Challenge 2026 — Planet X and SPHEREx  
**Design System:** NASA Citizen Science × Zooniverse Classifier (*Overlap Zoo* / *Backyard Worlds*)  
**Last Updated:** 2026-11-02  

---

## 🔗 Live Deployments & Repository

| Destination | URL / Link | Description |
| :--- | :--- | :--- |
| **Local Live Server** | [http://127.0.0.1:8000](http://127.0.0.1:8000) | Full-stack FastAPI + Astropy engine running locally on port 8000. |
| **GitHub Repository** | [https://github.com/AryanBanker07/SPHEREx_nasa](https://github.com/AryanBanker07/SPHEREx_nasa) | Full source code (backend, Zooniverse classifier frontend, test suites, Obsidian vault). |
| **Vercel Production Site** | [https://frontend-three-teal-18.vercel.app](https://frontend-three-teal-18.vercel.app) | Cloud-hosted interactive web workstation with complete Browser Physics Engine & live CDS Sesame lookup. |

---

## 🎨 Zooniverse Citizen Science UI Highlights

1. **Authentic Zooniverse Classifier Architecture:**
   - Uses official Zooniverse **Karla** typography paired with **Barlow Condensed** mission headers and **IBM Plex Mono** astrometric telemetry.
   - Signature `#00979d` Zooniverse Teal, `#005d69` Deep Teal, and `#f0b200` NASA Gold palette with persistent **Dark Observatory / Light Lab Theme Toggle**.
   - **Project Sub-Nav:** `CLASSIFY`, `ABOUT`, `TALK` (with live classification counter), `COLLECT` (Favorites & Saved Collections), and `RECENTS`.
   - **Right-Edge Pull-Out `FIELD GUIDE` Drawer:** Visual reference cards with one-click benchmark target loaders.
2. **Universal Hover Instructions (`tooltip.js`):**
   - Hovering over **every icon, toolbar button, epoch dot, wavelength pill, dropdown, and task choice** displays an instant instructional HUD tooltip with keyboard shortcuts and scientific explanations.
3. **12-Tool Vertical Subject Manipulation Toolbar:**
   - Spectrum Pointer (`S`), Candidate Marker (`M`), Pan (`P`), Zoom In/Out/Reset (`+`, `-`, `0`), Negative Invert (`I`), 3-Band False-Color RGB (`R`), Epoch Subtraction Difference (`D` with selectable Epoch A & B pairs), SNR Coadd Stack (`C`), Histogram Brightness/Contrast Stretch (`B`), WCS Coordinate Grid (`G`), Gaia DR3 Proper Motion Vectors, and SPHEREx Level-2 Contamination Flags (`F`).
4. **Vector SVG 102-Band Spectrophotometer & HiDPI Supersampled Cutouts:**
   - Replaced raster `<canvas>` Chart.js SED plot with a **100% Vector SVG Interactive Spectrophotometer (`sed_chart.js`)** rendered at native infinite device resolution:
     - True linear physical wavelength axis (`0.75 – 5.00 µm`), dedicated non-overlapping `A1`–`A6` detector array header strip (each with hover tooltip physics), `±1σ` photometric uncertainty envelope & error whiskers, staggered molecular absorption callouts (`CH₄`, `H₂O Ice`, `CO₂`, `CO`), channel-snapping laser crosshair readout, and one-click lossless `.svg` export.
   - Upgraded `SkyBlinker` (`blinker.js`), `SPHERExEngine` (`spherex_engine.py`), and `DifferenceEngine` (`difference_engine.py`) to `2×–3×` Retina `devicePixelRatio` canvas buffers and `384×384` supersampled sub-pixel Moffat/Gaussian starfields with diffraction spikes.
