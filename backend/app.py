"""
FastAPI Server for SPHEREx Time-Domain Sky Explorer.
Follows ECC software rules: factory create_app(), separated Pydantic schemas,
modular routers, CORS, and static web serving.
"""

from typing import Dict, List, Any, Optional
import os
from fastapi import FastAPI, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from backend.coordinate_resolver import parse_coordinates, BENCHMARK_TARGETS
from backend.spherex_engine import SPHERExEngine, ARRAY_CONFIGS, EPOCHS
from backend.difference_engine import DifferenceEngine
from backend.sed_extractor import SEDExtractor


# Pydantic Request & Response Schemas
class ResolveRequest(BaseModel):
    query: str = Field(..., description="Target name or coordinates (e.g., 'Barnard\'s Star', '269.452, 4.693')")


class CutoutRequest(BaseModel):
    ra: float = Field(..., description="Right Ascension in decimal degrees")
    dec: float = Field(..., description="Declination in decimal degrees")
    fov_arcmin: float = Field(8.0, ge=1.0, le=60.0, description="Field of View in arcminutes")
    target_name: Optional[str] = Field("Target", description="Optional target label")
    array_selection: Optional[str] = Field("all", description="Array filter: 'all', '1', '2', '3', '4', '5', '6'")


class DifferenceRequest(BaseModel):
    matrix_a: List[List[float]] = Field(..., description="Raw 2D flux matrix for Epoch A")
    matrix_b: List[List[float]] = Field(..., description="Raw 2D flux matrix for Epoch B")
    dt_years: float = Field(0.5, description="Time difference in years")
    epoch_a_label: str = Field("Epoch 1", description="Label for Epoch A")
    epoch_b_label: str = Field("Epoch 2", description="Label for Epoch B")


class CoaddRequest(BaseModel):
    matrices: List[List[List[float]]] = Field(..., description="List of 2D flux matrices to coadd")


class SpectrumRequest(BaseModel):
    target_name: str = Field(..., description="Target name")
    pixel_x: Optional[float] = Field(None, description="Clicked pixel X")
    pixel_y: Optional[float] = Field(None, description="Clicked pixel Y")


def create_app() -> FastAPI:
    """Application factory for SPHEREx Sky Explorer backend."""
    app = FastAPI(
        title="SPHEREx Time-Domain Sky Explorer API",
        description="Public API for multi-epoch near-infrared SPHEREx images, blinking, difference imaging, and 102-band spectra.",
        version="1.0.0"
    )

    # CORS configuration
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # API Routes
    @app.get("/api/targets")
    async def get_benchmark_targets() -> Dict[str, Any]:
        """Returns the pre-indexed challenge benchmark targets."""
        return {
            "targets": list(BENCHMARK_TARGETS.values()),
            "count": len(BENCHMARK_TARGETS)
        }

    @app.get("/api/metadata")
    async def get_metadata() -> Dict[str, Any]:
        """Returns SPHEREx instrument specifications, detector arrays, and survey epochs."""
        return {
            "mission": "NASA SPHEREx",
            "full_name": "Spectro-Photometer for the History of the Universe, Epoch of Reionization and Ices Explorer",
            "total_bands": 102,
            "bands_per_array": 17,
            "detector_arrays": ARRAY_CONFIGS,
            "wavelength_range_um": [0.75, 5.00],
            "pixel_scale_arcsec": 6.2,
            "survey_epochs": EPOCHS
        }

    @app.post("/api/resolve")
    async def resolve_target(req: ResolveRequest) -> Dict[str, Any]:
        """Resolves target names or coordinate strings via Astropy and CDS Sesame."""
        try:
            return parse_coordinates(req.query)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Coordinate resolution error: {str(e)}")

    @app.post("/api/cutout")
    async def generate_cutout(req: CutoutRequest) -> Dict[str, Any]:
        """Generates multi-epoch SPHEREx cutouts for blinking analysis."""
        # Check if coordinates match benchmark metadata
        target_meta = None
        for data in BENCHMARK_TARGETS.values():
            if abs(data["ra"] - req.ra) < 0.05 and abs(data["dec"] - req.dec) < 0.05:
                target_meta = data
                break

        if not target_meta and req.target_name:
            target_meta = {"name": req.target_name, "pm_ra_cosdec": 0.0, "pm_dec": 0.0}

        try:
            return SPHERExEngine.generate_cutout_cube(
                ra_deg=req.ra,
                dec_deg=req.dec,
                fov_arcmin=req.fov_arcmin,
                target_meta=target_meta,
                array_selection=req.array_selection or "all"
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Cutout generation error: {str(e)}")

    @app.post("/api/difference")
    async def compute_difference(req: DifferenceRequest) -> Dict[str, Any]:
        """Computes epoch subtraction, automated dipole detection, and bipolar image rendering."""
        try:
            return DifferenceEngine.compute_difference(
                matrix_a=req.matrix_a,
                matrix_b=req.matrix_b,
                dt_years=req.dt_years,
                epoch_a_label=req.epoch_a_label,
                epoch_b_label=req.epoch_b_label
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Difference computation error: {str(e)}")

    @app.post("/api/coadd")
    async def compute_coadd(req: CoaddRequest) -> Dict[str, Any]:
        """Performs image coaddition across multiple epochs/bands to boost SNR."""
        try:
            return DifferenceEngine.compute_coaddition(req.matrices)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Coaddition error: {str(e)}")

    @app.post("/api/spectrum")
    async def extract_spectrum(req: SpectrumRequest) -> Dict[str, Any]:
        """Extracts 102-band spectrophotometric SED and identifies molecular ice/gas signatures."""
        try:
            return SEDExtractor.extract_spectrum(
                target_name=req.target_name,
                pixel_x=req.pixel_x,
                pixel_y=req.pixel_y
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Spectra extraction error: {str(e)}")

    # Mount frontend static files
    frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
    if os.path.isdir(frontend_dir):
        app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app:app", host="0.0.0.0", port=8000, reload=True)

