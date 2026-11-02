"""
Difference Imaging and Discovery Mathematics Engine.
Performs epoch subtraction (I_diff = I_B - I_A), automated dipole detection
for moving objects (Planet X, brown dwarfs, asteroids), and flux variability isolation.
"""

from typing import Dict, List, Tuple, Any, Optional
import numpy as np
import io
import base64
from PIL import Image

PIXEL_SCALE_ARCSEC = 6.2  # SPHEREx pixel scale


class DifferenceEngine:
    """Handles astronomical image subtraction, stacking, and automated dipole detection."""

    @classmethod
    def compute_difference(
        cls,
        matrix_a: List[List[float]],
        matrix_b: List[List[float]],
        dt_years: float = 0.5,
        epoch_a_label: str = "Epoch A",
        epoch_b_label: str = "Epoch B"
    ) -> Dict[str, Any]:
        """
        Subtracts Epoch A from Epoch B.
        Returns difference matrix, contrast-stretched bipolar image, and detected candidates.
        """
        arr_a = np.array(matrix_a, dtype=np.float32)
        arr_b = np.array(matrix_b, dtype=np.float32)
        
        # Ensure dimensions match
        if arr_a.shape != arr_b.shape:
            raise ValueError(f"Shape mismatch: {arr_a.shape} vs {arr_b.shape}")

        npix = arr_a.shape[0]

        # Raw subtraction
        diff_arr = arr_b - arr_a

        # Robust statistics for noise estimation
        sigma = np.std(diff_arr)
        threshold = max(3.5 * sigma, 0.5)

        # Detect moving dipole candidates and variable stars
        candidates = cls._detect_dipoles_and_variables(diff_arr, threshold, dt_years)

        # Render bipolar colormap (Negative = Dark/Cyan, Zero = Neutral Grey, Positive = Bright/Amber)
        bipolar_b64 = cls._render_bipolar_png(diff_arr, threshold)

        return {
            "epoch_a": epoch_a_label,
            "epoch_b": epoch_b_label,
            "dt_years": dt_years,
            "difference_b64": bipolar_b64,
            "sigma": round(float(sigma), 3),
            "candidates": candidates,
            "has_dipole": any(c["category"] == "Moving Object Dipole" for c in candidates),
            "has_variable": any(c["category"] == "Variable / Transient" for c in candidates)
        }

    @classmethod
    def compute_coaddition(cls, matrices: List[List[List[float]]]) -> Dict[str, Any]:
        """Averages multiple epochs/bands to boost SNR by sqrt(N)."""
        if not matrices:
            raise ValueError("No matrices provided for coaddition.")
            
        stack = np.array(matrices, dtype=np.float32)
        n_frames = stack.shape[0]
        coadd_arr = np.mean(stack, axis=0)

        snr_boost = round(float(np.sqrt(n_frames)), 2)

        # Normalize and render
        vmin = np.percentile(coadd_arr, 1)
        vmax = np.percentile(coadd_arr, 99.5)
        scaled = np.clip((coadd_arr - vmin) / max(vmax - vmin, 1e-5), 0, 1)
        stretched = np.arcsinh(10.0 * scaled) / np.arcsinh(10.0)
        uint8_data = (stretched * 255).astype(np.uint8)

        img = Image.fromarray(uint8_data)
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        coadd_b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

        return {
            "n_frames": n_frames,
            "snr_boost_factor": f"{snr_boost}x",
            "coadd_b64": coadd_b64
        }

    @classmethod
    def _detect_dipoles_and_variables(
        cls,
        diff_arr: np.ndarray,
        threshold: float,
        dt_years: float
    ) -> List[Dict[str, Any]]:
        """Identifies paired positive/negative extrema (dipoles) and un-paired peaks (variable stars)."""
        npix = diff_arr.shape[0]
        candidates = []

        # Find significant positive peaks and negative troughs
        pos_mask = diff_arr > threshold
        neg_mask = diff_arr < -threshold

        pos_indices = np.argwhere(pos_mask)
        neg_indices = np.argwhere(neg_mask)

        paired_pos = set()
        paired_neg = set()

        # Check for proximity pairings (within 1 to 12 pixels ~ 6.2" to 74")
        max_dist_px = 12.0
        min_dist_px = 0.6

        for i, (py, px) in enumerate(pos_indices):
            best_dist = 999.0
            best_neg_idx = -1
            
            for j, (ny, nx) in enumerate(neg_indices):
                if j in paired_neg:
                    continue
                dist = np.hypot(px - nx, py - ny)
                if min_dist_px <= dist <= max_dist_px and dist < best_dist:
                    best_dist = dist
                    best_neg_idx = j

            if best_neg_idx != -1:
                ny, nx = neg_indices[best_neg_idx]
                paired_pos.add(i)
                paired_neg.add(best_neg_idx)

                # Compute motion vector
                dx_px = px - nx
                dy_px = py - ny
                displacement_arcsec = best_dist * PIXEL_SCALE_ARCSEC
                pm_rate_arcsec_yr = displacement_arcsec / max(dt_years, 0.01)

                candidates.append({
                    "id": f"dipole_{len(candidates)+1}",
                    "category": "Moving Object Dipole",
                    "confidence": "High",
                    "pos_pixel": [int(px), int(py)],
                    "neg_pixel": [int(nx), int(ny)],
                    "displacement_arcsec": round(float(displacement_arcsec), 2),
                    "proper_motion_rate": round(float(pm_rate_arcsec_yr), 2),
                    "rate_unit": "arcsec/year",
                    "description": f"Shifts {displacement_arcsec:.2f}″ over {dt_years:.2f} yrs. Clear black/white dipole signature characteristic of high proper motion star, brown dwarf, or asteroid."
                })

        # Check for isolated strong positive/negative peaks without dipole pairing (Variable Stars)
        for i, (py, px) in enumerate(pos_indices):
            if i not in paired_pos and diff_arr[py, px] > 2.0 * threshold:
                candidates.append({
                    "id": f"variable_bright_{len(candidates)+1}",
                    "category": "Variable / Transient",
                    "type": "Flux Increase (Brightening)",
                    "pixel": [int(px), int(py)],
                    "delta_flux": round(float(diff_arr[py, px]), 2),
                    "description": "Stationary positive residual: Source flared or brightened significantly between epochs (e.g. Mira cycle, YSO flare, or supernova)."
                })

        for j, (ny, nx) in enumerate(neg_indices):
            if j not in paired_neg and diff_arr[ny, nx] < -2.0 * threshold:
                candidates.append({
                    "id": f"variable_dim_{len(candidates)+1}",
                    "category": "Variable / Transient",
                    "type": "Flux Decrease (Dimming)",
                    "pixel": [int(nx), int(ny)],
                    "delta_flux": round(float(diff_arr[ny, nx]), 2),
                    "description": "Stationary negative residual: Source dimmed or was eclipsed between epochs (e.g. UXor dust occultation as in RW Aurigae)."
                })

        return candidates[:8]

    @classmethod
    def _render_bipolar_png(cls, diff_arr: np.ndarray, threshold: float) -> str:
        """
        Renders a 3-channel RGB image for difference visualization:
        Negative residuals show blue-cyan, neutral is grey (128,128,128), positive is amber-yellow.
        """
        npix = diff_arr.shape[0]
        # Symmetrical scale around 0
        v_limit = max(np.percentile(np.abs(diff_arr), 99.0), threshold * 2.0)
        norm = np.clip(diff_arr / v_limit, -1.0, 1.0)

        rgb = np.zeros((npix, npix, 3), dtype=np.uint8)

        # Baseline neutral gray
        rgb[:, :, 0] = 128
        rgb[:, :, 1] = 128
        rgb[:, :, 2] = 128

        # Positive excess: shifts towards bright gold/white
        pos_idx = norm > 0
        p_val = norm[pos_idx]
        rgb[pos_idx, 0] = np.clip(128 + p_val * 127, 0, 255).astype(np.uint8)
        rgb[pos_idx, 1] = np.clip(128 + p_val * 110, 0, 255).astype(np.uint8)
        rgb[pos_idx, 2] = np.clip(128 - p_val * 80, 0, 255).astype(np.uint8)

        # Negative deficit: shifts towards deep cyan/dark blue
        neg_idx = norm < 0
        n_val = np.abs(norm[neg_idx])
        rgb[neg_idx, 0] = np.clip(128 - n_val * 100, 0, 255).astype(np.uint8)
        rgb[neg_idx, 1] = np.clip(128 - n_val * 40, 0, 255).astype(np.uint8)
        rgb[neg_idx, 2] = np.clip(128 + n_val * 127, 0, 255).astype(np.uint8)

        img = Image.fromarray(rgb, mode="RGB")
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        return base64.b64encode(buffer.getvalue()).decode("utf-8")

