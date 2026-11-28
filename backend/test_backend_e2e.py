import os
import sys

# Configure environment for Astropy and Matplotlib
backend_dir = os.path.dirname(os.path.abspath(__file__))
os.environ["ASTROPY_CONFIG_DIR"] = os.path.join(backend_dir, ".astropy", "config")
os.environ["ASTROPY_CACHE_DIR"] = os.path.join(backend_dir, ".astropy", "cache")
os.environ["MPLCONFIGDIR"] = os.path.join(backend_dir, ".matplotlib")
os.environ["PYTHONPATH"] = backend_dir

sys.path.insert(0, backend_dir)

from app.main import (
    health_check,
    get_sample_targets,
    search_spherex,
    compare_spectra,
    create_timelapse,
    create_share_link,
    get_shared_investigation,
    SearchRequest,
    SpectrumCompareRequest,
    TimeLapseRequest,
    ShareInvestigationRequest,
)

def run_tests():
    print("1. Testing health_check()...", flush=True)
    health = health_check()
    assert health["status"] == "ok"
    print("   -> Health check OK: status = ok", flush=True)

    print("2. Testing get_sample_targets()...", flush=True)
    targets = get_sample_targets()
    assert len(targets) >= 5
    target_names = [t["name"] for t in targets]
    print(f"   -> Found {len(targets)} targets: {target_names}", flush=True)

    print("3. Testing search_spherex() for Barnard's Star...", flush=True)
    search_res = search_spherex(SearchRequest(ra=269.452075, dec=4.693364, fov_arcmin=15.0))
    epochs = search_res["epochs"]
    assert len(epochs) > 0
    total_frames = sum(len(e["observations"]) for e in epochs)
    print(f"   -> Search OK: {len(epochs)} epochs, {total_frames} frames", flush=True)

    print("4. Testing compare_spectra() for Barnard's Star...", flush=True)
    spec_res = compare_spectra(SpectrumCompareRequest(ra=269.452075, dec=4.693364))
    assert "epoch_spectra" in spec_res
    print(f"   -> Spectra OK: {len(spec_res['epoch_spectra'])} epoch spectra returned", flush=True)
    if "difference_spectrum_102" in spec_res:
        print(f"   -> Difference Spectrum: {len(spec_res['difference_spectrum_102'])} 102-band points", flush=True)

    print("5. Testing create_timelapse() for Barnard's Star...", flush=True)
    tl_res = create_timelapse(TimeLapseRequest(ra=269.452075, dec=4.693364, fov_arcmin=15.0))
    tl_frames = tl_res["frames"]
    assert len(tl_frames) > 0
    print(f"   -> Timelapse OK: {len(tl_frames)} frames, baseline = {tl_res.get('time_baseline_days')} days", flush=True)

    print("6. Testing create_share_link() & get_shared_investigation()...", flush=True)
    req = ShareInvestigationRequest(
        ra=269.452075,
        dec=4.693364,
        fov_arcmin=15.0,
        detector="D1",
        selected_obs_id="SPX_TEST_123",
        earlier_epoch="2025-S2",
        later_epoch="2026-S1",
        overlays_enabled=["gaia", "wise"],
        active_view="viewer",
    )
    share_res = create_share_link(req)
    share_id = share_res["share_id"]
    assert share_id
    print(f"   -> Created share investigation: ID = {share_id}", flush=True)

    restored = get_shared_investigation(share_id)
    state = restored["state"]
    assert abs(state["ra"] - 269.452075) < 1e-4
    assert state["detector"] == "D1"
    print(f"   -> Restored investigation: RA={state['ra']}, Dec={state['dec']}, detector={state['detector']}", flush=True)

    print("\n>>> ALL 6 BACKEND MODULE INTEGRATION TESTS PASSED CLEANLY! <<<", flush=True)

if __name__ == "__main__":
    run_tests()
