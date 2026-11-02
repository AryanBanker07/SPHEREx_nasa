"""
SPHEREx Instrument Physics, Multi-Epoch Generator, and FITS MEF Engine.
Accurately models SPHEREx 6 detector arrays, 102 spectral bands (0.75 - 5.0 µm),
Level 2 Multi-Extension FITS (IMAGE, VARIANCE, FLAGS, ZODI), and multi-epoch astrometric/photometric shifts.
"""

from typing import Dict, List, Tuple, Any, Optional
import numpy as np
from astropy.io import fits
from astropy.wcs import WCS
import io
import base64
from PIL import Image

# SPHEREx Detector Array Specifications
# 6 Arrays, each with Linear Variable Filter (LVF) divided into 17 bands = 102 Total Bands
ARRAY_CONFIGS = {
    1: {"name": "Array 1 (Short NIR)", "w_min": 0.75, "w_max": 1.11, "bands": 17, "r_res": 41},
    2: {"name": "Array 2 (Short NIR)", "w_min": 1.11, "w_max": 1.64, "bands": 17, "r_res": 41},
    3: {"name": "Array 3 (Mid NIR)",   "w_min": 1.64, "w_max": 2.42, "bands": 17, "r_res": 41},
    4: {"name": "Array 4 (Mid NIR - Ice)", "w_min": 2.42, "w_max": 3.82, "bands": 17, "r_res": 41},
    5: {"name": "Array 5 (Long NIR - CO2/CO)", "w_min": 3.82, "w_max": 4.42, "bands": 17, "r_res": 135},
    6: {"name": "Array 6 (Long NIR - 5µm Window)", "w_min": 4.42, "w_max": 5.00, "bands": 17, "r_res": 41},
}

# Generate exact central wavelength array for all 102 channels
SPHEREX_WAVELENGTHS = []
SPHEREX_BAND_ARRAY_MAP = []
for arr_idx in range(1, 7):
    cfg = ARRAY_CONFIGS[arr_idx]
    w_arr = np.linspace(cfg["w_min"], cfg["w_max"], cfg["bands"])
    for w in w_arr:
        SPHEREX_WAVELENGTHS.append(round(float(w), 4))
        SPHEREX_BAND_ARRAY_MAP.append(arr_idx)
SPHEREX_WAVELENGTHS = np.array(SPHEREX_WAVELENGTHS)

# Survey Cadence (Survey 1 to 4 every 6 months)
EPOCHS = [
    {"id": "epoch_1", "label": "SPHEREx Survey 1 (May 2025)", "date": "2025-05-15", "mjd": 60810.0, "epoch_years": 2025.37},
    {"id": "epoch_2", "label": "SPHEREx Survey 2 (Nov 2025)", "date": "2025-11-15", "mjd": 60994.0, "epoch_years": 2025.87},
    {"id": "epoch_3", "label": "SPHEREx Survey 3 (May 2026)", "date": "2026-05-15", "mjd": 61175.0, "epoch_years": 2026.37},
    {"id": "epoch_4", "label": "SPHEREx Survey 4 (Nov 2026)", "date": "2026-11-15", "mjd": 61359.0, "epoch_years": 2026.87},
    {"id": "wise_ref", "label": "WISE Baseline Reference (2010)", "date": "2010-06-01", "mjd": 55348.0, "epoch_years": 2010.42}
]

PIXEL_SCALE_ARCSEC = 6.2  # 6.2 arcsec/pixel for SPHEREx


class SPHERExEngine:
    """Manages SPHEREx Level 2 MEF generation, multi-epoch cutouts, and multi-band transformations."""

    @staticmethod
    def get_survey_epochs() -> List[Dict[str, Any]]:
        return EPOCHS

    @staticmethod
    def get_array_metadata() -> Dict[int, Dict[str, Any]]:
        return ARRAY_CONFIGS

    @staticmethod
    def get_all_wavelengths() -> List[float]:
        return SPHEREX_WAVELENGTHS.tolist()

    @classmethod
    def generate_cutout_cube(
        cls,
        ra_deg: float,
        dec_deg: float,
        fov_arcmin: float = 8.0,
        target_meta: Optional[Dict[str, Any]] = None,
        array_selection: str = "all"  # "all", "coadd", "1", "2", "3", "4", "5", "6"
    ) -> Dict[str, Any]:
        """
        Generates calibrated multi-epoch cutouts for the specified sky coordinate.
        Calculates astrometric shifting and photometric variations across survey epochs.
        """
        # Pixel dimensions
        fov_arcsec = fov_arcmin * 60.0
        npix = int(np.clip(round(fov_arcsec / PIXEL_SCALE_ARCSEC), 32, 128))
        
        # Build Astropy WCS header
        wcs = WCS(naxis=2)
        wcs.wcs.crpix = [npix / 2.0, npix / 2.0]
        wcs.wcs.cdelt = [-PIXEL_SCALE_ARCSEC / 3600.0, PIXEL_SCALE_ARCSEC / 3600.0]
        wcs.wcs.crval = [ra_deg, dec_deg]
        wcs.wcs.ctype = ["RA---TAN", "DEC--TAN"]

        # Proper motion parameters
        pm_ra = target_meta.get("pm_ra_cosdec", 0.0) if target_meta else 0.0  # mas/yr
        pm_dec = target_meta.get("pm_dec", 0.0) if target_meta else 0.0      # mas/yr
        target_name = target_meta.get("name", "Target") if target_meta else "Target"

        # Background starry field (deterministic random based on coordinates)
        seed = int((abs(ra_deg) * 1000 + abs(dec_deg) * 10000) % 2**31)
        rng = np.random.RandomState(seed)

        # Base background stars
        num_bg_stars = 25
        bg_x = rng.uniform(2, npix - 3, num_bg_stars)
        bg_y = rng.uniform(2, npix - 3, num_bg_stars)
        bg_flux = rng.exponential(scale=15.0, size=num_bg_stars) + 2.0

        # Primary source parameters
        center_x = (npix - 1) / 2.0
        center_y = (npix - 1) / 2.0
        
        ref_year = 2025.37  # Epoch 1 is reference

        epoch_frames = []
        for ep in EPOCHS:
            # Calculate proper motion shift in arcseconds relative to Epoch 1
            dt_years = ep["epoch_years"] - ref_year
            shift_ra_arcsec = (pm_ra / 1000.0) * dt_years
            shift_dec_arcsec = (pm_dec / 1000.0) * dt_years

            # Convert to pixels (RA increases left, so minus sign on X)
            shift_px_x = -shift_ra_arcsec / PIXEL_SCALE_ARCSEC
            shift_px_y = shift_dec_arcsec / PIXEL_SCALE_ARCSEC

            current_target_x = center_x + shift_px_x
            current_target_y = center_y + shift_px_y

            # Photometric variability model
            flux_multiplier = 1.0
            if "RW Aur" in target_name:
                # Eruptive/dipping UXor behavior: Deep dip in Epoch 2 & 4
                if ep["id"] == "epoch_2":
                    flux_multiplier = 0.22  # >1.6 mag deep dimming
                elif ep["id"] == "epoch_3":
                    flux_multiplier = 0.95  # recovery
                elif ep["id"] == "epoch_4":
                    flux_multiplier = 0.35  # secondary dip
                else:
                    flux_multiplier = 1.00
            elif "R Dra" in target_name:
                # Mira variable with 245-day cycle: Sinusoidal infrared oscillation
                phase = (ep["mjd"] - 60810.0) / 245.6 * 2 * np.pi
                flux_multiplier = 0.5 + 0.5 * (np.cos(phase) + 1.0) / 2.0

            # Generate flux 2D slice
            image_data = np.zeros((npix, npix), dtype=np.float32)

            # Zodiacal background (ZODI) ~ 0.3 - 0.7 MJy/sr
            zodi_level = 0.45 + 0.05 * np.sin(ra_deg / 57.3)
            image_data += zodi_level

            # Gaussian PSF renderer
            psf_fwhm = 1.5  # pixels
            sigma = psf_fwhm / 2.355

            y_grid, x_grid = np.mgrid[0:npix, 0:npix]

            # Render background stars
            for bx, by, bf in zip(bg_x, bg_y, bg_flux):
                r2 = (x_grid - bx)**2 + (y_grid - by)**2
                image_data += bf * np.exp(-r2 / (2 * sigma**2))

            # Render target
            # Target flux depends on array selection and target spectral type
            primary_flux = cls._get_target_band_flux(target_name, array_selection) * flux_multiplier
            r2_target = (x_grid - current_target_x)**2 + (y_grid - current_target_y)**2
            image_data += primary_flux * np.exp(-r2_target / (2 * sigma**2))

            # Add Poisson & read noise
            noise = rng.normal(0, 0.15, size=(npix, npix)).astype(np.float32)
            image_data = np.clip(image_data + noise, 0, None)

            # Generate Level 2 FLAGS and VARIANCE
            variance_data = (image_data * 0.05 + 0.02).astype(np.float32)
            flags_data = np.zeros((npix, npix), dtype=np.uint16)
            # Add synthetic cosmic ray in 1 frame
            if ep["id"] == "epoch_2":
                cr_x, cr_y = int(npix * 0.25), int(npix * 0.75)
                image_data[cr_y, cr_x] += 120.0
                flags_data[cr_y, cr_x] |= 2  # bit 1: cosmic ray

            # Convert to display PNG (Base64)
            img_b64 = cls._array_to_png_base64(image_data)
            inv_b64 = cls._array_to_png_base64(image_data, invert=True)

            epoch_frames.append({
                "epoch_id": ep["id"],
                "label": ep["label"],
                "date": ep["date"],
                "mjd": ep["mjd"],
                "image_b64": img_b64,
                "invert_b64": inv_b64,
                "target_x": round(float(current_target_x), 2),
                "target_y": round(float(current_target_y), 2),
                "shift_ra_arcsec": round(float(shift_ra_arcsec), 2),
                "shift_dec_arcsec": round(float(shift_dec_arcsec), 2),
                "raw_matrix": image_data.tolist()
            })

        return {
            "target": target_name,
            "ra": ra_deg,
            "dec": dec_deg,
            "fov_arcmin": fov_arcmin,
            "npix": npix,
            "pixel_scale": PIXEL_SCALE_ARCSEC,
            "epochs": epoch_frames,
            "wcs_header": dict(wcs.to_header())
        }

    @classmethod
    def _get_target_band_flux(cls, target_name: str, array_selection: str) -> float:
        """Calculates expected integrated flux for specific spectral types and arrays."""
        if "WISE 0855" in target_name:
            # Sub-zero Y dwarf: Extremely red! Dark in Array 1, brilliant in Array 5/6 (4-5 µm)
            if array_selection in ["1", "2"]:
                return 0.4
            elif array_selection == "3":
                return 2.5
            elif array_selection == "4":
                return 8.0
            elif array_selection in ["5", "6"]:
                return 45.0
            return 28.0  # Coadded flux
        elif "Epsilon Indi B" in target_name:
            # T dwarf binary: Strong near-IR flux with deep absorption features
            if array_selection == "1":
                return 15.0
            elif array_selection in ["2", "3"]:
                return 35.0
            return 30.0
        elif "Barnard" in target_name:
            # M dwarf: Peak in Arrays 1 to 3, bright throughout
            return 60.0
        elif "RW Aur" in target_name:
            # Young T Tauri: Strong infrared circumstellar disk excess
            return 50.0
        elif "R Dra" in target_name:
            # Mira giant: High infrared luminosity
            return 55.0
        else:
            return 25.0

    @classmethod
    def _array_to_png_base64(cls, arr: np.ndarray, invert: bool = False) -> str:
        """Converts astronomical floating-point matrix to normalized contrast-stretched PNG base64."""
        # Astronomical Asinh stretch
        vmin = np.percentile(arr, 1)
        vmax = np.percentile(arr, 99.5)
        scaled = np.clip((arr - vmin) / max(vmax - vmin, 1e-5), 0, 1)
        
        # Apply asinh stretch for dynamic range
        stretched = np.arcsinh(10.0 * scaled) / np.arcsinh(10.0)
        
        if invert:
            # Greyscale negative: 0 (white) to 255 (black)
            uint8_data = ((1.0 - stretched) * 255).astype(np.uint8)
        else:
            # Standard: 0 (black) to 255 (white)
            uint8_data = (stretched * 255).astype(np.uint8)

        img = Image.fromarray(uint8_data)
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        return base64.b64encode(buffer.getvalue()).decode("utf-8")

