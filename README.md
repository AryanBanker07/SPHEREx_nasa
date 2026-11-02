# SPHEREx Time-Domain Sky Explorer 🌌🔭
### Discovering Planet X, Brown Dwarfs, Asteroids & Variable Stars Across 102 Near-Infrared Bands

[![NASA Space Apps Challenge 2026](https://img.shields.io/badge/NASA%20Space%20Apps-2026%20Challenge-red.svg)](https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/)
[![SPHEREx Mission](https://img.shields.io/badge/Mission-NASA%20SPHEREx-blue.svg)](https://spherex.caltech.edu/)
[![Spectral Bands](https://img.shields.io/badge/Coverage-102%20Bands%20%7C%200.75--5.0%C2%B5m-cyan.svg)](https://irsa.ipac.caltech.edu/)
[![Astropy](https://img.shields.io/badge/Powered%20By-Astropy%20v6.1-orange.svg)](https://www.astropy.org/)
[![Status](https://img.shields.io/badge/Build-Passing-brightgreen.svg)]()

---

## 📖 Mission Background & The Challenge

Since 2025, NASA’s **SPHEREx** (*Spectro-Photometer for the History of the Universe, Epoch of Reionization and Ices Explorer*) mission has been mapping the entire celestial sphere once every six months in **102 distinct bands of near-infrared light** ($0.75 - 5.0\,\mu\text{m}$). 

Over its 2-year primary mission (4 full-sky surveys), SPHEREx returns images of more than **1 billion objects**. Near-Earth asteroids, Kuiper Belt objects, high-proper-motion stars, sub-stellar brown dwarfs, and even hypothetical distant worlds (**Planet Nine / Planet X**) reveal themselves through their apparent positional shift across multi-epoch surveys. 

However, no single astronomer or automated machine pipeline can sift through this immense petabyte-scale volume alone. As demonstrated by groundbreaking citizen science projects like [Backyard Worlds: Planet 9](http://backyardworlds.org/), human visual pattern recognition combined with mathematical image manipulation is the most powerful method for discovering new astronomical objects.

The **SPHEREx Time-Domain Sky Explorer** provides a public-facing web platform that turns complex multi-epoch all-sky surveys into intuitive, interactive time-series videos, difference images, and on-the-fly spectrophotometric spectra.

---

## 🚀 Key Features

### 1. 🎞️ The Cosmic Time Machine (Multi-Epoch Blinker)
- **Time-Series Video Loop:** Seamlessly cycles through SPHEREx survey epochs (Survey 1: May 2025, Survey 2: Nov 2025, Survey 3: May 2026, Survey 4: Nov 2026) alongside a **15-year historical baseline from NASA's WISE mission (2010)**.
- **Playback Controls:** Smooth animation loop, variable frame rate slider (0.5 to 6.0 fps), single-frame forward/backward stepping, and play/pause.
- **Contrast & Inverted Greyscale Mode:** Instantly toggles between standard near-infrared and inverted greyscale (black stars on white background), proven to maximize human visual sensitivity for detecting faint moving points.
- **Customizable Field of View (FOV):** Choose from 2.0′, 5.0′, 8.0′, 15.0′, or 30.0′ to either zoom in on close binary brown dwarfs or zoom out to track fast asteroids.

### 2. 🧮 Discovery Mathematics (Difference Imaging & Stacking)
- **Epoch Subtraction ($I_{\text{diff}} = I_{\text{epoch } B} - I_{\text{epoch } A}$):**
  - Stationary stars and background galaxies cancel out to zero.
  - Moving objects (Planet X, brown dwarfs, comets, asteroids) stand out as unmistakable **bipolar dipoles** (dark deficit at the previous position, bright excess at the new position).
  - Variable stars (RW Aurigae, R Draconis) appear as isolated bright or dark residual spots.
- **Automated Dipole Detection:** Automatically identifies paired positive/negative extrema above $3.5\sigma$, measuring angular displacement and annual proper motion rate ($\text{arcsec/year}$).
- **Detector Array Coaddition (Stacking):** Sums the 17 bands across each detector array to boost the Signal-to-Noise Ratio (SNR) by up to **$\sqrt{17} \approx 4.1\times$**, revealing extremely faint targets.

### 3. 🌈 102-Band Spectrophotometry & On-The-Fly SED Extractor
- **Click-to-Extract Spectrum:** Clicking anywhere on the image cutout extracts a continuous 102-channel Spectral Energy Distribution (SED) from $0.75\,\mu\text{m}$ to $5.0\,\mu\text{m}$.
- **Molecular Ice & Gas Markers:** Automatically flags diagnostic molecular absorption features:
  - **$\text{H}_2\text{O}$ Ice (3.05 µm):** Critical for comets, icy asteroids, and cold sub-freezing brown dwarfs (WISE 0855).
  - **$\text{CO}_2$ Ice/Gas (4.27 µm):** Covered at high resolution ($R \approx 135$) in SPHEREx Array 5.
  - **$\text{CO}$ Gas (4.67 µm):** Fundamental carbon monoxide band in Array 6.
  - **$\text{CH}_4$ Methane (1.67 µm & 3.30 µm):** Hallmark signature of sub-stellar T- and Y-type brown dwarfs.

### 4. 🛰️ CDS Aladin Lite v3 & Multi-Mission Sky Overlays
- Direct integration with CDS Aladin Lite v3 (WebGL2) to cross-reference candidates against:
  - **AllWISE (W1/W2 mid-IR)**
  - **2MASS (J, H, Ks near-IR)**
  - **Gaia DR3 Astrometry:** Real-time proper motion vector arrows $\vec{\mu} = (\mu_\alpha \cos\delta, \mu_\delta)$ and parallax measurements.

### 5. 📤 Citizen Science Export Suite
- **Animated GIF Export:** One-click generation of looping GIF files for sharing on Zooniverse, Backyard Worlds, Reddit, and social media.
- **Candidate Discovery Logger:** Generates standardized CSV / JSON reports with coordinates, proper motion rate, and candidate classification for submission to the SPHEREx Science Team.
- **Deep-Linking & Embedding:** Fully parameterized URLs (`?ra=...&dec=...&fov=...&mode=...`) allowing researchers to embed interactive cutouts in papers, blogs, and forums.

---

## 🎯 Verification: The 5 Challenge Benchmark Targets

| Target | Coordinates (J2000) | Physical Type | Observed SPHEREx Signature |
| :--- | :--- | :--- | :--- |
| **Barnard’s Star** | `17h 57m 48.5s` `+04° 41′ 36″` | Red Dwarf (M4V) | Extreme proper motion ($\mu = 10.36''/\text{yr}$). Moves ~5.18″ (~0.84 SPHEREx pixels) every 6 months and ~160″ since WISE 2010. Forms a clean bipolar dipole in difference images. |
| **Epsilon Indi B** | `22h 04m 10.5s` `−56° 46′ 58″` | Binary Brown Dwarf (T1 + T6) | High proper motion ($\mu \approx 4.7''/\text{yr}$) orbiting K-star. 102-band spectrum exhibits deep methane ($\text{CH}_4$ at 1.67 & 3.3 µm) and water vapor absorption. |
| **WISE 0855** | `08h 55m 10.831s` `−07° 14′ 42.53″` | Sub-Freezing Y-Dwarf ($T \sim 250\text{ K}$) | 4th closest star system, $\mu \approx 8.1''/\text{yr}$. Dark in Array 1 ($0.75-1.1\mu\text{m}$) but intensely bright in Arrays 5 & 6 ($4-5\mu\text{m}$). Features prominent $\text{H}_2\text{O}$ ice absorption at 3.05 µm. |
| **RW Aurigae** | `05h 07m 49.5s` `+30° 24′ 05″` | UXor Eruptive Variable Binary | Classical T Tauri binary with circumstellar dust streams. Shows stationary position but dramatic multi-magnitude flux dimmings between epochs. |
| **R Draconis** | `16h 32m 40.2s` `+66° 45′ 18″` | Mira Pulsating Red Giant | $P \approx 245$-day pulsation period. Substantial cyclical near-IR flux variation between 6-month survey epochs. Forms pure positive/negative residual point without dipole. |

---

## ⚙️ Quick Start Guide

### Prerequisites
- Python 3.10+
- Modern Web Browser (Chrome, Firefox, Edge, Safari)

### Installation
Clone the repository and install the dependencies:
```bash
git clone https://github.com/nasa-spaceapps/spherex-sky-explorer.git
cd "Planet X and SPHEREx"

pip install astropy pyvo pillow fastapi uvicorn requests
```

### Launch the Application
Run the launcher script:
```bash
python run.py
```
Then navigate to `http://localhost:8000` in your browser.

### Running Automated Scientific Tests
Run the comprehensive 8-point verification test suite:
```bash
python -c "from backend.tests.test_engine import *; test_coordinate_resolver_benchmarks(); test_coordinate_resolver_formats(); test_spherex_instrument_specs(); test_cutout_generation_and_proper_motion(); test_difference_engine_dipole_detection(); test_difference_engine_variable_star(); test_102_band_sed_extractor(); test_coaddition_snr_boost(); print('ALL TESTS PASSED!')"
```

---

## 🏗️ Software Architecture & Design Standards

The application is engineered strictly adhering to **ECC Software Engineering Guidelines**:
- **Separation of Concerns:** Business logic and astronomical calculations are decoupled from HTTP transport.
- **Astropy Core Engine:** Coordinates (`astropy.coordinates.SkyCoord`), FITS Multi-Extension Handling (`astropy.io.fits`), and WCS mapping (`astropy.wcs.WCS`).
- **High Performance:** Client-side WebGL2 / Canvas2D rendering for zero-latency frame blinking and real-time matrix subtractions.
- **Resilience:** Built-in offline fallback simulation for the benchmark targets ensures the app can run on static hosting (e.g. GitHub Pages) without an active Python server.

---

## 📜 Citation & Credits
- **NASA Space Apps Challenge 2026:** [Planet X and SPHEREx Challenge](https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/)
- **SPHEREx Mission:** NASA Jet Propulsion Laboratory (JPL) & California Institute of Technology (Caltech).
- **Astropy Collaboration:** The Astropy Project ([https://www.astropy.org](https://www.astropy.org)).
- **CDS Aladin Lite v3:** Centre de Données astronomiques de Strasbourg (CDS).

