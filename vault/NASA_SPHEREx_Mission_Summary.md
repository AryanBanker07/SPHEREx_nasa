# NASA SPHEREx Mission Summary

**Mission Name:** Spectro-Photometer for the History of the Universe, Epoch of Reionization and Ices Explorer (SPHEREx)  
**Lead Institutions:** NASA Jet Propulsion Laboratory (JPL) & California Institute of Technology (Caltech)  
**Launch / Survey Operations:** 2025 – Present  
**Cadence:** All-Sky Survey every 6 months (4 complete surveys over nominal mission)  
**Wavelength Range:** $0.75\,\mu\text{m} \text{ to } 5.0\,\mu\text{m}$ (102 spectral channels)  

---

## 1. Instrument Optical Architecture

SPHEREx utilizes a wide-field, off-axis all-reflective Schmidt telescope design split by a dichroic beam splitter into two focal plane assemblies containing a total of **six $2048 \times 2048$ Teledyne H2RG HgCdTe detector arrays**:

```
[Incoming Near-Infrared Sky Light: 0.75 - 5.0 µm]
                        │
             ┌──────────┴──────────┐
      Dichroic Splitter (Short / Long)
             │                     │
    ┌────────┴────────┐   ┌────────┴────────┐
   Short-Wavelength      Long-Wavelength
      Assemblies            Assemblies
   (Arrays 1, 2, 3)      (Arrays 4, 5, 6)
```

Mounted directly above each of the six detector arrays is a specialized **Linear Variable Filter (LVF)**. Rather than discrete color filters, the LVFs create a continuous spectral gradient. Each detector array is divided into **17 distinct spectral channels**:
$$\text{Total Spectral Channels} = 6 \text{ Arrays} \times 17 \text{ Bands/Array} = 102 \text{ Spectral Bands}$$

---

## 2. Detector Arrays & Spectral Breakdown

| Array ID | Spectral Range ($\mu\text{m}$) | Channels | Resolving Power ($R = \lambda/\Delta\lambda$) | Primary Astrophysical Diagnostics |
| :--- | :--- | :--- | :--- | :--- |
| **Array 1** | $0.75 - 1.11$ | 17 | $\sim 41$ | Optical/NIR transition, warm stellar continua, Paschen series |
| **Array 2** | $1.11 - 1.64$ | 17 | $\sim 41$ | Methane ($\text{CH}_4$ at $1.67\,\mu\text{m}$), $J$ & $H$ photometric peaks |
| **Array 3** | $1.64 - 2.42$ | 17 | $\sim 41$ | Water vapor ($\text{H}_2\text{O}$ at $1.90\,\mu\text{m}$), CO overtone ($2.32\,\mu\text{m}$) |
| **Array 4** | $2.42 - 3.82$ | 17 | $\sim 41$ | **Solid Water Ice ($\text{H}_2\text{O}$ at $3.05\,\mu\text{m}$)**, PAHs & hydrocarbons ($3.3\,\mu\text{m}$) |
| **Array 5** | $3.82 - 4.42$ | 17 | **$\sim 135$ (High Resolution)** | **Carbon Dioxide Ice/Gas ($\text{CO}_2$ at $4.27\,\mu\text{m}$)** |
| **Array 6** | $4.42 - 5.00$ | 17 | $\sim 41$ | **Carbon Monoxide ($\text{CO}$ at $4.67\,\mu\text{m}$)**, **$5\,\mu\text{m}$ Y-Dwarf Window** |

---

## 3. Pixel Scale & Sky Survey Cadence
- **Spatial Resolution / Pixel Scale:** $\sim 6.2 \text{ arcsec/pixel}$.
- **Cadence:** Complete all-sky map every 6 months.
- **Data Volume:** Over **1 billion distinct celestial objects** surveyed each epoch.
- **Level 2 MEF HDU Layout:**
  - `IMAGE`: Calibrated flux density in $\text{MJy/sr}$.
  - `VARIANCE`: Per-pixel uncertainty.
  - `FLAGS`: Data quality bitmasks (cosmic rays, saturation, bad pixels).
  - `ZODI`: Modeled zodiacal dust background.

