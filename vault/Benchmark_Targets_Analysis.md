# Benchmark Targets Analysis: Validation of the 5 Mandatory Targets

This document details the scientific validation and signature modeling of the 5 benchmark test systems required by the NASA Space Apps Challenge *Planet X and SPHEREx*.

---

## 1. Barnard's Star (GJ 699)
- **Coordinates (ICRS):** $\alpha = 17\text{h } 57\text{m } 48.5\text{s}$ ($269.452083^\circ$), $\delta = +04^\circ 41' 36''$ ($+4.693333^\circ$)
- **Distance:** $1.83\text{ pc}$ ($5.96\text{ ly}$) — 2nd closest stellar system to the Sun.
- **Physical Classification:** Late M-dwarf main sequence star (M4V).
- **Proper Motion:**
  - $\mu_\alpha \cos\delta = -798.58\text{ mas/yr}$
  - $\mu_\delta = +10328.12\text{ mas/yr}$
  - **Total Proper Motion:** $\mu \approx 10.36''/\text{yr}$ (Fastest known stellar proper motion).
- **SPHEREx Appearance:**
  - Over a single 6-month survey interval ($\Delta t = 0.5\text{ yr}$), it shifts by **$\Delta r \approx 5.18''$** ($\sim 0.84\text{ SPHEREx pixels}$).
  - In Difference Images ($I_{\text{Epoch 2}} - I_{\text{Epoch 1}}$), it produces a massive, unmistakable **bipolar dipole** with a dark negative trough at the May 2025 position and bright positive peak at the Nov 2025 position.
  - Relative to the 2010 WISE baseline, it shifts by **$\sim 160''$** ($\sim 26\text{ SPHEREx pixels}$).

---

## 2. Epsilon Indi B ($\epsilon$ Indi Ba / Bb)
- **Coordinates (ICRS):** $\alpha = 22\text{h } 04\text{m } 10.5\text{s}$ ($331.043750^\circ$), $\delta = -56^\circ 46' 58''$ ($-56.782778^\circ$)
- **Distance:** $3.63\text{ pc}$ ($11.8\text{ ly}$).
- **Physical Classification:** Binary brown dwarf system (spectral classes T1 + T6) orbiting the K5V primary star $\epsilon$ Indi A.
- **Proper Motion:** $\mu_\alpha \cos\delta \approx +3961\text{ mas/yr}$, $\mu_\delta \approx -2539\text{ mas/yr}$ ($\mu \approx 4.70''/\text{yr}$).
- **SPHEREx Appearance:**
  - Displaces $\approx 2.35''$ per 6-month survey epoch.
  - Spectroscopic 102-band extraction displays deep **Methane ($\text{CH}_4$)** absorption bands at $1.67\,\mu\text{m}$ (Array 2) and $3.30\,\mu\text{m}$ (Array 4), along with atmospheric water vapor depressions at $1.4\,\mu\text{m}$ and $1.9\,\mu\text{m}$.

---

## 3. WISE 0855 (WISE J085510.83-071442.5)
- **Coordinates (ICRS):** $\alpha = 08\text{h } 55\text{m } 10.831\text{s}$ ($133.795129^\circ$), $\delta = -07^\circ 14' 42.53''$ ($-7.245147^\circ$)
- **Distance:** $2.28\text{ pc}$ ($7.43\text{ ly}$) — 4th closest star/sub-stellar system.
- **Physical Classification:** Sub-stellar ultra-cool Y-dwarf ($T_{\text{eff}} \approx 250\text{ K}$, sub-zero Celsius, $\sim -23^\circ\text{C}$).
- **Proper Motion:** $\mu_\alpha \cos\delta = -8132\text{ mas/yr}$, $\mu_\delta = +678\text{ mas/yr}$ ($\mu \approx 8.16''/\text{yr}$).
- **SPHEREx Appearance:**
  - Displaces **$\approx 4.08''$** per 6-month survey epoch.
  - Because of its extreme sub-freezing temperature, it is virtually invisible in optical and short near-IR (Arrays 1 and 2, $0.75 - 1.64\,\mu\text{m}$), but blazes intensely in **Arrays 5 and 6 ($3.8 - 5.0\,\mu\text{m}$)** through the $5\,\mu\text{m}$ atmospheric emergence window.
  - Features prominent absorption at **$3.05\,\mu\text{m}$**, indicating **water ice clouds** in its sub-stellar atmosphere.

---

## 4. RW Aurigae (RW Aur A / B)
- **Coordinates (ICRS):** $\alpha = 05\text{h } 07\text{m } 49.5\text{s}$ ($76.956250^\circ$), $\delta = +30^\circ 24' 05''$ ($+30.401389^\circ$)
- **Distance:** $\sim 160\text{ pc}$ in the Taurus-Auriga star-forming complex.
- **Physical Classification:** Classical T Tauri binary young stellar object (UXor-type variable).
- **Proper Motion:** Very small ($\mu \approx 0.019''/\text{yr}$).
- **SPHEREx Appearance:**
  - Stationary position, but undergoes dramatic, multi-magnitude deep dimming events ($\Delta V > 2\text{ mag}$) caused by circumstellar dust occultations and tidal arms.
  - In Difference Images, it appears as an **isolated, non-dipolar point-source residual** (pure positive or negative residual flux), easily differentiating photometric variability from astrometric motion.

---

## 5. R Draconis (R Dra)
- **Coordinates (ICRS):** $\alpha = 16\text{h } 32\text{m } 40.2\text{s}$ ($248.167500^\circ$), $\delta = +66^\circ 45' 18''$ ($+66.755000^\circ$)
- **Distance:** $\sim 650\text{ pc}$.
- **Physical Classification:** Mira-type pulsating asymptotic giant branch (AGB) red giant variable star.
- **Period:** $P \approx 245.6\text{ days}$.
- **SPHEREx Appearance:**
  - The SPHEREx 6-month survey cadence ($\approx 182.6\text{ days}$) aliases across its 245-day period, producing stark infrared brightness contrasts between alternating surveys.
  - Difference imaging cleanly isolates its large-amplitude flux swing without any dipole spatial displacement.

