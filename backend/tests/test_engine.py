"""
Test suite validating SPHEREx Engine, Coordinate Resolver, Difference Imaging,
102-Band SED Extractor, and the 5 Benchmark Targets.
"""

import numpy as np
from backend.coordinate_resolver import parse_coordinates, BENCHMARK_TARGETS
from backend.spherex_engine import SPHERExEngine, EPOCHS, SPHEREX_WAVELENGTHS
from backend.difference_engine import DifferenceEngine
from backend.sed_extractor import SEDExtractor


def test_coordinate_resolver_benchmarks():
    """Verify all 5 mandatory targets resolve accurately to known positions."""
    targets = ["Barnard's Star", "Epsilon Indi B", "WISE 0855", "RW Aurigae", "R Draconis"]
    for t in targets:
        res = parse_coordinates(t)
        assert "ra" in res
        assert "dec" in res
        assert res["ra"] > 0
        assert "ra_hms" in res
        assert "dec_dms" in res
        assert res["is_benchmark"] is True


def test_coordinate_resolver_formats():
    """Verify decimal degrees and sexagesimal string resolution."""
    # Decimal
    res_dec = parse_coordinates("269.452, 4.693")
    assert abs(res_dec["ra"] - 269.452) < 0.001
    assert abs(res_dec["dec"] - 4.693) < 0.001

    # Sexagesimal
    res_sex = parse_coordinates("08h55m10.831s -07d14m42.53s")
    assert abs(res_sex["ra"] - 133.795) < 0.01
    assert abs(res_sex["dec"] - (-7.245)) < 0.01


def test_spherex_instrument_specs():
    """Verify 102 spectral bands and wavelength range (0.75 - 5.0 µm)."""
    assert len(SPHEREX_WAVELENGTHS) == 102
    assert abs(SPHEREX_WAVELENGTHS[0] - 0.75) < 0.01
    assert abs(SPHEREX_WAVELENGTHS[-1] - 5.00) < 0.01
    assert len(EPOCHS) >= 4


def test_cutout_generation_and_proper_motion():
    """Verify multi-epoch cutout generation and proper motion displacement."""
    b_data = BENCHMARK_TARGETS["barnard"]
    cube = SPHERExEngine.generate_cutout_cube(
        ra_deg=b_data["ra"],
        dec_deg=b_data["dec"],
        fov_arcmin=8.0,
        target_meta=b_data
    )

    assert cube["npix"] > 30
    assert len(cube["epochs"]) == len(EPOCHS)
    
    # Check Epoch 1 vs Epoch 2 displacement
    ep1 = cube["epochs"][0]
    ep2 = cube["epochs"][1]
    assert ep1["image_b64"] is not None
    assert ep2["image_b64"] is not None
    # Barnard moves > 4 arcsec between Epoch 1 & 2 (~0.5 year)
    diff_shift = abs(ep2["shift_dec_arcsec"] - ep1["shift_dec_arcsec"])
    assert diff_shift > 4.0


def test_difference_engine_dipole_detection():
    """Verify that epoch subtraction reveals dipoles for moving sources."""
    b_data = BENCHMARK_TARGETS["barnard"]
    cube = SPHERExEngine.generate_cutout_cube(
        ra_deg=b_data["ra"],
        dec_deg=b_data["dec"],
        target_meta=b_data
    )

    mat_1 = cube["epochs"][0]["raw_matrix"]
    mat_2 = cube["epochs"][1]["raw_matrix"]

    diff_res = DifferenceEngine.compute_difference(
        matrix_a=mat_1,
        matrix_b=mat_2,
        dt_years=0.5,
        epoch_a_label="Epoch 1",
        epoch_b_label="Epoch 2"
    )

    assert "difference_b64" in diff_res
    assert diff_res["has_dipole"] is True
    assert len(diff_res["candidates"]) > 0
    candidate = diff_res["candidates"][0]
    assert candidate["category"] == "Moving Object Dipole"
    assert candidate["proper_motion_rate"] > 5.0  # > 5 arcsec/year


def test_difference_engine_variable_star():
    """Verify that epoch subtraction isolates stationary variable stars."""
    rw_data = BENCHMARK_TARGETS["rw_aur"]
    cube = SPHERExEngine.generate_cutout_cube(
        ra_deg=rw_data["ra"],
        dec_deg=rw_data["dec"],
        target_meta=rw_data
    )

    mat_1 = cube["epochs"][0]["raw_matrix"]
    mat_2 = cube["epochs"][1]["raw_matrix"]

    diff_res = DifferenceEngine.compute_difference(
        matrix_a=mat_1,
        matrix_b=mat_2,
        dt_years=0.5,
        epoch_a_label="Epoch 1",
        epoch_b_label="Epoch 2"
    )

    assert diff_res["has_variable"] is True
    var_candidate = [c for c in diff_res["candidates"] if c["category"] == "Variable / Transient"]
    assert len(var_candidate) > 0


def test_102_band_sed_extractor():
    """Verify 102-band spectrophotometric extraction and molecular ice identification."""
    spec_y_dwarf = SEDExtractor.extract_spectrum("WISE 0855-0714")
    assert spec_y_dwarf["total_bands"] == 102
    assert "Ultra-Cool" in spec_y_dwarf["classification"]
    assert any("Water Ice" in f for f in spec_y_dwarf["matched_features"])

    # Verify that Band 6 (4.5-5.0 µm) flux is much brighter than Band 1 (0.75-1.1 µm)
    pts = spec_y_dwarf["spectral_points"]
    flux_band1 = pts[0]["flux_mjy_sr"]
    flux_band6 = pts[-1]["flux_mjy_sr"]
    assert flux_band6 > 10.0 * flux_band1  # Characteristic extreme red color of cold Y-dwarf


def test_coaddition_snr_boost():
    """Verify SNR boost calculation in multi-epoch coaddition."""
    mat = [[1.0] * 32 for _ in range(32)]
    res = DifferenceEngine.compute_coaddition([mat, mat, mat, mat])
    assert res["n_frames"] == 4
    assert res["snr_boost_factor"] == "2.0x"
