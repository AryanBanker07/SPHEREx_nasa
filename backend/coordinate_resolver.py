"""
Coordinate and Target Resolver Module for SPHEREx Time-Domain Sky Explorer.
Utilizes Astropy coordinates, units, and CDS name resolution.
"""

from typing import Dict, Any, Optional
import urllib.parse
import urllib.request
import json
import logging
from astropy.coordinates import SkyCoord
import astropy.units as u

logger = logging.getLogger(__name__)

# Predefined benchmark targets and planetary test beds
BENCHMARK_TARGETS: Dict[str, Dict[str, Any]] = {
    "barnard": {
        "name": "Barnard's Star",
        "ra": 269.452083,
        "dec": 4.693333,
        "pm_ra_cosdec": -798.58,   # mas/yr
        "pm_dec": 10328.12,        # mas/yr (Fastest proper motion known!)
        "type": "High Proper Motion Red Dwarf (M4V)",
        "description": "Second closest star system. Moves ~5.18 arcsec per 6-month SPHEREx survey.",
        "recommended_fov": "10m"
    },
    "eps_indi_b": {
        "name": "Epsilon Indi B",
        "ra": 331.043750,
        "dec": -56.782778,
        "pm_ra_cosdec": 3961.0,    # mas/yr
        "pm_dec": -2539.0,         # mas/yr
        "type": "Binary Brown Dwarf (T1 + T6)",
        "description": "Nearby brown dwarf pair orbiting K-star. Distinct methane (1.6 & 3.3 µm) and water bands.",
        "recommended_fov": "10m"
    },
    "wise_0855": {
        "name": "WISE 0855-0714",
        "ra": 133.795129,
        "dec": -7.245147,
        "pm_ra_cosdec": -8132.0,   # mas/yr
        "pm_dec": 678.0,           # mas/yr
        "type": "Ultra-Cool Sub-Freezing Y-Dwarf (T ~ 250 K)",
        "description": "Coldest known sub-stellar object (ice clouds). Blazing in SPHEREx Arrays 5 & 6 (4-5 µm) but dark in Array 1.",
        "recommended_fov": "10m"
    },
    "rw_aur": {
        "name": "RW Aurigae",
        "ra": 76.956250,
        "dec": 30.401389,
        "pm_ra_cosdec": 2.1,
        "pm_dec": -18.7,
        "type": "Young UXor Variable Star (T Tauri Binary)",
        "description": "Classical T Tauri star showing deep multi-magnitude dimmings from circumstellar dust streams.",
        "recommended_fov": "10m"
    },
    "r_dra": {
        "name": "R Draconis",
        "ra": 248.167500,
        "dec": 66.755000,
        "pm_ra_cosdec": 12.3,
        "pm_dec": 18.9,
        "type": "Mira Pulsating Variable Red Giant",
        "description": "Pulsating giant with 245-day period. Creates high-contrast flux variations across 6-month SPHEREx epochs.",
        "recommended_fov": "10m"
    },
    "planet_nine_candidate": {
        "name": "Planet 9 / Planet X (Candidate Search Field)",
        "ra": 52.500000,
        "dec": -15.200000,
        "pm_ra_cosdec": -120.0,
        "pm_dec": -45.0,
        "type": "Hypothetical Trans-Neptunian Planet X",
        "description": "Slowly shifting distant solar system planetary candidate, detectable in infrared thermal emission.",
        "recommended_fov": "15m"
    }
}


def parse_coordinates(query: str) -> Dict[str, Any]:
    """
    Parse an input string into celestial coordinates (ICRS).
    Supports:
    - Target names ('Barnard\'s Star', 'WISE 0855', etc.)
    - Decimal degrees ('269.452, 4.693')
    - Sexagesimal format ('17h57m48.5s +04d41m36s' or '17:57:48.5 +04:41:36')
    """
    clean_query = query.strip()
    
    # 1. Check if query matches a known benchmark key or name
    normalized_key = clean_query.lower().replace(" ", "_").replace("'", "").replace("-", "_")
    for key, data in BENCHMARK_TARGETS.items():
        if normalized_key in key or key in normalized_key or clean_query.lower() in data["name"].lower():
            c = SkyCoord(ra=data["ra"] * u.deg, dec=data["dec"] * u.deg, frame="icrs")
            return _format_coord_result(c, display_name=data["name"], benchmark_meta=data)

    # 2. Try parsing as comma-separated or space-separated numbers (Decimal Degrees)
    try:
        parts = clean_query.replace(",", " ").split()
        if len(parts) == 2:
            ra_val = float(parts[0])
            dec_val = float(parts[1])
            c = SkyCoord(ra=ra_val * u.deg, dec=dec_val * u.deg, frame="icrs")
            return _format_coord_result(c, display_name=f"RA {ra_val:.4f}°, Dec {dec_val:.4f}°")
    except Exception:
        pass

    # 3. Try parsing as Sexagesimal strings (HMS DMS)
    try:
        if any(h in clean_query for h in ['h', ':', 'd', 'm', 's']):
            c = SkyCoord(clean_query, frame="icrs")
            return _format_coord_result(c, display_name=clean_query)
    except Exception:
        pass

    # 4. Fallback: Query online CDS Sesame Name Resolver
    try:
        encoded_name = urllib.parse.quote(clean_query)
        url = f"https://cdsweb.u-strasbg.fr/cgi-bin/nph-sesame/-oI/A?{encoded_name}"
        req = urllib.request.Request(url, headers={"User-Agent": "SPHEREx-Sky-Explorer/1.0"})
        with urllib.request.urlopen(req, timeout=5) as response:
            content = response.read().decode("utf-8")
            # Look for %J line with RA Dec in decimal degrees
            for line in content.splitlines():
                if line.startswith("%J"):
                    tokens = line.split()
                    if len(tokens) >= 3:
                        ra = float(tokens[1])
                        dec = float(tokens[2])
                        c = SkyCoord(ra=ra * u.deg, dec=dec * u.deg, frame="icrs")
                        return _format_coord_result(c, display_name=clean_query)
    except Exception as e:
        logger.warning(f"Sesame lookup failed for '{clean_query}': {e}")

    # 5. Last resort: Astropy SkyCoord.from_name
    try:
        c = SkyCoord.from_name(clean_query)
        return _format_coord_result(c, display_name=clean_query)
    except Exception as e:
        raise ValueError(f"Could not resolve celestial coordinates for input: '{query}'. Please enter RA and Dec in decimal or HMS/DMS format.")


def _format_coord_result(coord: SkyCoord, display_name: str, benchmark_meta: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Standardize coordinate output with decimal, sexagesimal, and galactic representations."""
    ra_deg = float(coord.ra.deg)
    dec_deg = float(coord.dec.deg)
    
    hms = coord.ra.hms
    dms = coord.dec.dms
    
    dec_sign = "+" if dec_deg >= 0 else "-"
    ra_str = f"{int(hms.h):02d}h {int(hms.m):02d}m {hms.s:05.2f}s"
    dec_str = f"{dec_sign}{abs(int(dms.d)):02d}d {abs(int(dms.m)):02d}m {abs(dms.s):04.1f}s"
    
    gal = coord.galactic
    
    result = {
        "name": display_name,
        "ra": round(ra_deg, 6),
        "dec": round(dec_deg, 6),
        "ra_hms": ra_str,
        "dec_dms": dec_str,
        "galactic_l": round(float(gal.l.deg), 4),
        "galactic_b": round(float(gal.b.deg), 4),
        "is_benchmark": benchmark_meta is not None,
    }
    
    if benchmark_meta:
        result["benchmark_info"] = benchmark_meta
        
    return result

