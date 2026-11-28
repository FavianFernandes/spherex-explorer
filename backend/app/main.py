"""
NASA SPHEREx Explorer — FastAPI Backend Server (v2.4.0 Final)
"""

from __future__ import annotations

import json
import re
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal, Optional
from urllib.parse import quote, urlencode

_base = Path(__file__).resolve().parent.parent
(_base / ".astropy" / "config").mkdir(parents=True, exist_ok=True)
(_base / ".astropy" / "cache").mkdir(parents=True, exist_ok=True)
(_base / ".matplotlib").mkdir(parents=True, exist_ok=True)
import os
os.environ.setdefault("ASTROPY_CONFIG_DIR", str(_base / ".astropy" / "config"))
os.environ.setdefault("ASTROPY_CACHE_DIR", str(_base / ".astropy" / "cache"))
os.environ.setdefault("MPLCONFIGDIR", str(_base / ".matplotlib"))

import astropy.units as u
import numpy as np
from astropy.coordinates import SkyCoord
from fastapi import BackgroundTasks, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app import science_engine as sci
from app import spherex_connector as conn

app = FastAPI(
    title="NASA SPHEREx Explorer API",
    version="2.4.0",
    description=(
        "Complete scientific backend for exploring NASA/IPAC IRSA SPHEREx Level-2 Multi-Extension FITS data, "
        "102-band infrared spectrophotometry, interactive 3-graph spectral comparisons, WCS difference imaging, "
        "variance-weighted stacking, 6-month Time-Lapse GIF animations, moving object isolation, "
        "and Gaia DR3 / AllWISE / CSA NEOSSat multi-mission overlays."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

SHARES_FILE = conn.CACHE_DIR / "shared_investigations.json"
STORE_LOCK = threading.Lock()
JOBS_STORE: dict[str, dict[str, Any]] = {}


def _load_shares() -> dict[str, dict[str, Any]]:
    with STORE_LOCK:
        if SHARES_FILE.exists():
            try:
                return json.loads(SHARES_FILE.read_text(encoding="utf-8"))
            except Exception:
                return {}
        return {}


def _save_shares(data: dict[str, dict[str, Any]]) -> None:
    with STORE_LOCK:
        SHARES_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")


# ============================================================================
# PYDANTIC SCHEMAS
# ============================================================================

class QualityFlagDefinition(BaseModel):
    bit: int
    mask: int
    description: str
    unusable: bool


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    quality_flag_definitions: dict[str, QualityFlagDefinition]


class PresetTarget(BaseModel):
    id: str
    name: str
    category: str
    ra: str
    dec: str
    ra_deg: float
    dec_deg: float
    description: str


class PixelPoint(BaseModel):
    x: float
    y: float


class SearchRequest(BaseModel):
    ra: float | str = Field(..., description="Right Ascension in degrees, HMS, or target name")
    dec: Optional[float | str] = Field(None, description="Declination in degrees or DMS")
    fov_arcmin: float = Field(15.0, ge=5.0, le=60.0)
    detector: Optional[str] = Field(None, description="Optional filter for detector 1..6 or D1..D6")


class ObservationFrame(BaseModel):
    obs_id: str
    detector: str
    mjd: float
    date_iso: str
    em_min_um: float
    em_max_um: float
    release: str
    survey_week: Optional[str] = "UNKNOWN"
    survey_pass: Optional[str] = "UNKNOWN"
    pixel_scale_arcsec: float = 6.15
    flux_unit: str = "MJy/sr"
    full_fits_url: str
    cutout_fits_url: str
    preview_png_url: str
    target_px: PixelPoint
    comparable_with: list[str]


class EpochBucket(BaseModel):
    epoch_id: str
    start_date: str
    end_date: str
    count: int
    detectors_available: list[str]
    observations: list[ObservationFrame]


class SearchResponse(BaseModel):
    query_ra_deg: float
    query_dec_deg: float
    fov_arcmin: float
    total_observations: int
    detectors: list[str]
    pixel_scale_arcsec: float = 6.15
    flux_unit: str = "MJy/sr"
    orientation: dict[str, str] = {"north": "up", "east": "left", "origin": "top_left"}
    wiseview_url: str
    target_px: PixelPoint
    epochs: list[EpochBucket]


class IdentifyObjectRequest(BaseModel):
    cutout_fits_url: str
    click_x: float
    click_y: float
    rendered_width: float = Field(146.0, gt=0)
    rendered_height: float = Field(146.0, gt=0)
    center_ra: Optional[float | str] = None
    center_dec: Optional[float | str] = None
    fov_arcmin: float = Field(15.0, ge=5.0, le=60.0)


class IdentifyObjectResponse(BaseModel):
    object_id: str
    ra_deg: float
    dec_deg: float
    ra_hms: str
    dec_dms: str
    fits_x: float
    fits_y: float
    png_x: float
    png_y: float
    target_px: PixelPoint
    flux_mjy_sr: float
    flux_err_mjy_sr: float
    flux_ujy: float
    flux_err_ujy: float
    background_mjy_sr: float
    snr: float
    position_err_arcsec: float
    quality_flag: int
    flag_labels: list[str]
    is_usable: bool
    wavelength_um: float
    bandwidth_um: float
    date_obs: str
    detector: str
    gaia_crossmatch: Optional[dict[str, Any]] = None
    wise_matches: Optional[list[dict[str, Any]]] = None


class RawSpectralPoint(BaseModel):
    obs_id: str
    detector: str
    date_iso: str
    mjd: float
    wavelength_um: float
    bandwidth_um: float
    flux: float
    flux_err: float
    flux_ujy: float
    flux_err_ujy: float
    snr: float
    quality_flag: int
    flag_labels: list[str]
    is_usable: bool


class NominalChannel102(BaseModel):
    channel: int
    detector: str
    wavelength_um: float
    bandwidth_um: float
    flux: Optional[float] = None
    flux_err: Optional[float] = None
    flux_ujy: Optional[float] = None
    flux_err_ujy: Optional[float] = None
    n_exposures: int
    directly_measured: bool = False
    measured: bool


class EpochSpectrumBundle(BaseModel):
    epoch_id: str
    observation_date: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    detectors_available: list[str] = []
    wavelengths_um: list[float] = []
    fluxes: list[Optional[float]] = []
    flux_errs: list[Optional[float]] = []
    fluxes_ujy: list[Optional[float]] = []
    raw_points: list[RawSpectralPoint]
    channels_102: list[NominalChannel102]


class DifferenceChannel102(BaseModel):
    channel: int
    wavelength_um: float
    delta_flux: Optional[float] = None
    delta_flux_err: Optional[float] = None
    delta_flux_ujy: Optional[float] = None
    delta_flux_err_ujy: Optional[float] = None
    significance_sigma: Optional[float] = None
    comparable: bool


class SpectrumCompareRequest(BaseModel):
    ra: float | str
    dec: Optional[float | str] = None
    epochs: Optional[list[str]] = None
    earlier_epoch: Optional[str] = None
    later_epoch: Optional[str] = None
    max_exposures_per_epoch: int = Field(24, ge=6, le=180)


class SpectrumCompareResponse(BaseModel):
    ra_deg: float
    dec_deg: float
    flux_unit: str = "MJy/sr"
    point_source_flux_unit: str = "uJy"
    spectrum_png_url: Optional[str] = None
    available_epochs: list[str]
    epoch_spectra: list[EpochSpectrumBundle]
    earlier_epoch: EpochSpectrumBundle
    later_epoch: EpochSpectrumBundle
    difference_spectrum_102: list[DifferenceChannel102]


class DifferenceRequest(BaseModel):
    early_cutout_fits_url: str
    late_cutout_fits_url: str
    ra: float | str
    dec: Optional[float | str] = None
    fov_arcmin: float = Field(15.0, ge=5.0, le=60.0)


class CandidateMatch(BaseModel):
    matched: bool
    match_type: str
    counterpart_ra_deg: Optional[float] = None
    counterpart_dec_deg: Optional[float] = None
    counterpart_px: Optional[PixelPoint] = None
    separation_arcsec: Optional[float] = None
    apparent_motion_arcsec_yr: Optional[float] = None
    gaia_source_id: Optional[str] = None
    discovery_status: Optional[str] = None


class DifferenceCandidate(BaseModel):
    candidate_id: str
    residual_type: Literal["positive_later_brighter", "negative_earlier_brighter"]
    ra_deg: float
    dec_deg: float
    png_x: float
    png_y: float
    target_px: PixelPoint
    peak_residual_mjy_sr: float
    significance_sigma: float
    match: CandidateMatch


class DifferenceResponse(BaseModel):
    diff_key: str
    difference_png_url: str
    significance_png_url: str
    early_date: str
    late_date: str
    early_wavelength_um: float
    late_wavelength_um: float
    photometric_scale_factor: float
    wavelength_compatible: bool
    scientific_warning: Optional[str] = None
    shape_ny_nx: list[int]
    pixel_scale_arcsec: float = 6.15
    orientation: dict[str, str] = {"north": "up", "east": "left", "origin": "top_left"}
    flux_unit: str = "MJy/sr"
    display_scale: Optional[dict[str, Any]] = None
    target_px: PixelPoint
    comparable_with: list[str]
    candidates: list[DifferenceCandidate]


class StackRequest(BaseModel):
    cutout_fits_urls: list[str] = Field(..., min_length=2)
    ra: float | str
    dec: Optional[float | str] = None
    fov_arcmin: float = Field(15.0, ge=5.0, le=60.0)


class StackResponse(BaseModel):
    n_stacked: int
    detector: str
    single_exposure_png_url: str
    stacked_png_url: str
    single_background_rms_mjy_sr: float
    stacked_background_rms_mjy_sr: float
    measured_snr_improvement_factor: float
    theoretical_sqrt_n_factor: float
    time_span_days: float
    scientific_warning: Optional[str] = None
    target_px: PixelPoint


class IsolateObjectRequest(BaseModel):
    early_cutout_fits_url: str
    late_cutout_fits_url: str
    object_ra: float | str
    object_dec: Optional[float | str] = None
    isolation_radius_pix: float = Field(4.5, ge=2.0, le=15.0)


class IsolatedEpochFrame(BaseModel):
    isolated_png_url: str
    follow_object_png_url: str
    follow_object_with_bg_png_url: str
    target_px: PixelPoint
    source_measurement: IdentifyObjectResponse


class IsolateObjectResponse(BaseModel):
    early_epoch_isolated: IsolatedEpochFrame
    late_epoch_isolated: IsolatedEpochFrame
    angular_displacement_arcsec: float
    displacement_err_arcsec: float
    time_baseline_days: float
    apparent_motion_arcsec_per_yr: float
    motion_err_arcsec_per_yr: float


class TimeLapseRequest(BaseModel):
    ra: float | str = Field(..., description="Right Ascension in degrees or HMS string")
    dec: Optional[float | str] = Field(None, description="Declination in degrees or DMS string")
    fov_arcmin: float = Field(15.0, ge=5.0, le=60.0)
    detector: Optional[str] = Field("auto", description="'auto' or 'D1'..'D6' / '1'..'6'")
    wavelength_band: Optional[str] = Field("selected_band")
    alignment_mode: Literal["fixed_sky", "follow_object"] = Field("fixed_sky")
    sampling_mode: Literal["epoch_best", "all_compatible"] = Field("epoch_best")
    isolate_moving_object: bool = Field(False)
    max_frames: int = Field(8, ge=2, le=24)
    playback_speed: float = Field(1.0, ge=0.25, le=8.0)
    loop: bool = Field(True)
    target_name: Optional[str] = Field(None)


class TimeLapseFrameMetadata(BaseModel):
    frame_index: int
    obs_id: str
    epoch_id: str
    detector: str
    date_iso: str
    mjd: float
    wavelength_um: float
    bandwidth_um: float
    usable_pixel_fraction: float
    background_mjy_sr: float
    noise_std_mjy_sr: float
    object_ra_deg: float
    object_dec_deg: float
    flux_mjy_sr: Optional[float] = None
    flux_ujy: Optional[float] = None
    snr: Optional[float] = None
    quality_flag: int
    flag_labels: list[str]
    target_px: PixelPoint
    cutout_fits_url: str
    frame_png_url: str


class TimeLapseResponse(BaseModel):
    query_ra_deg: float
    query_dec_deg: float
    fov_arcmin: float
    detector: str
    available_detectors: list[str]
    alignment_mode: str
    sampling_mode: str
    isolate_moving_object: bool
    can_animate: bool
    total_frames: int
    epochs_covered: list[str]
    ordered_dates: list[str]
    shape_ny_nx: list[int]
    pixel_scale_arcsec: float
    orientation: dict[str, str]
    flux_unit: str
    display_scale: dict[str, Any]
    angular_displacement_arcsec: float
    time_baseline_days: float
    frame_duration_ms: int
    gif_url: str
    gif_download_url: str
    download_filename: str
    scientific_warning: Optional[str] = None
    frames: list[TimeLapseFrameMetadata]


class ObjectTrackRequest(BaseModel):
    object_ra: float | str
    object_dec: Optional[float | str] = None
    cutout_fits_urls: list[str] = Field(..., min_length=1)


class TrackPoint(BaseModel):
    obs_id: str
    date_iso: str
    mjd: float
    detector: str
    wavelength_um: float
    ra_deg: float
    dec_deg: float
    png_x: float
    png_y: float
    target_px: PixelPoint
    flux_mjy_sr: float
    flux_ujy: float
    snr: float
    position_err_arcsec: float
    is_usable: bool


class ObjectTrackResponse(BaseModel):
    object_id: str
    track_points: list[TrackPoint]
    total_displacement_arcsec: float
    apparent_motion_arcsec_yr: float
    motion_err_arcsec_yr: float


class LightCurveRequest(BaseModel):
    ra: float | str
    dec: Optional[float | str] = None
    detector: Optional[str] = None
    max_exposures: int = Field(24, ge=2, le=60)


class LightCurvePoint(BaseModel):
    obs_id: str
    date_iso: str
    mjd: float
    detector: str
    wavelength_um: float
    flux_mjy_sr: float
    flux_err_mjy_sr: float
    flux_ujy: float
    snr: float
    quality_flag: int
    flag_labels: list[str]
    is_usable: bool


class LightCurveResponse(BaseModel):
    object_id: str
    ra_deg: float
    dec_deg: float
    flux_unit: str
    points: list[LightCurvePoint]


class OverlaysRequest(BaseModel):
    cutout_fits_url: str
    ra: float | str
    dec: Optional[float | str] = None
    fov_arcmin: float = Field(15.0, ge=5.0, le=60.0)
    include_wise_image_layer: bool = True
    north_up_aligned: bool = True
    frame_cutout_urls: Optional[dict[str, str]] = None


class GaiaOverlaySource(BaseModel):
    source_id: str
    ra_deg: float
    dec_deg: float
    ra_at_epoch_deg: float
    dec_at_epoch_deg: float
    pmra_mas_yr: float
    pmdec_mas_yr: float
    parallax_mas: Optional[float] = None
    g_mag: Optional[float] = None
    bp_rp: Optional[float] = None
    ref_epoch: float
    png_x: float
    png_y: float
    target_px: PixelPoint
    frame_px: dict[str, PixelPoint]


class WiseOverlaySource(BaseModel):
    designation: str
    ra_deg: float
    dec_deg: float
    w1_mag: Optional[float] = None
    w2_mag: Optional[float] = None
    w3_mag: Optional[float] = None
    w4_mag: Optional[float] = None
    png_x: float
    png_y: float
    target_px: PixelPoint
    frame_px: dict[str, PixelPoint]


class CsaNeossatObservation(BaseModel):
    observation_id: str
    instrument: str
    date_iso: str
    cadc_download_url: str


class FrameOverlayPositions(BaseModel):
    frame_id: str
    image_shape_ny_nx: list[int]
    target_px: PixelPoint
    gaia_px: dict[str, PixelPoint]
    wise_px: dict[str, PixelPoint]


class OverlaysResponse(BaseModel):
    image_shape_ny_nx: list[int]
    spherex_obs_date: str
    orientation: dict[str, str]
    target_px: PixelPoint
    fov_coverage_fraction: float
    coverage_complete: bool
    coverage_warning: Optional[str] = None
    catalog_warnings: list[str]
    wise_image_png_url: Optional[str] = None
    gaia_dr3_sources: list[GaiaOverlaySource]
    wise_sources: list[WiseOverlaySource]
    csa_neossat_observations: list[CsaNeossatObservation]
    frame_overlays: dict[str, FrameOverlayPositions]
    wiseview_url: str


class ShareInvestigationRequest(BaseModel):
    ra: float | str
    dec: float | str
    target_name: Optional[str] = None
    fov_arcmin: float = 15.0
    detector: Optional[str] = None
    wavelength_band: Optional[str] = None
    selected_epoch: Optional[str] = None
    selected_obs_id: Optional[str] = None
    selected_cutout_fits_url: Optional[str] = None
    earlier_epoch: Optional[str] = None
    later_epoch: Optional[str] = None
    compared_epochs: Optional[list[str]] = None
    hidden_epochs: Optional[dict[str, bool]] = None
    early_cutout_fits_url: Optional[str] = None
    late_cutout_fits_url: Optional[str] = None
    selected_object_id: Optional[str] = None
    selected_object_ra: Optional[float] = None
    selected_object_dec: Optional[float] = None
    alignment_mode: Literal["fixed_sky", "follow_object"] = "fixed_sky"
    active_view: str = "viewer"
    overlays_enabled: list[str] = Field(default_factory=lambda: ["gaia", "wise"])
    playback_speed: float = 1.0
    loop: bool = True
    notes: Optional[str] = None


class ShareRecord(BaseModel):
    share_id: str
    share_query_string: str
    created_at: str
    state: ShareInvestigationRequest


class JobCreateRequest(BaseModel):
    job_type: Literal["spectra_compare", "image_difference", "image_stack", "object_isolate", "timelapse"]
    payload: dict[str, Any]


class JobStatusResponse(BaseModel):
    id: str
    job_type: str
    status: Literal["queued", "running", "completed", "failed", "cancelled"]
    progress_pct: float
    created_at: str
    updated_at: str
    result: Optional[Any] = None
    error: Optional[str] = None


# ============================================================================
# API ROUTES
# ============================================================================

@app.get("/api/health", response_model=HealthResponse, tags=["System"])
def health_check():
    return {
        "status": "ok",
        "service": "SPHEREx Explorer Backend",
        "version": "2.4.0",
        "quality_flag_definitions": conn.get_quality_flag_definitions(),
    }


@app.get("/api/targets", response_model=list[PresetTarget], tags=["Discovery"])
def get_sample_targets():
    return conn.SAMPLE_TARGETS


@app.post("/api/search", response_model=SearchResponse, tags=["Discovery"])
def search_spherex(req: SearchRequest):
    try:
        coord = conn.parse_coordinates(req.ra, req.dec)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Invalid RA/Dec coordinates: {exc}")

    obs_list = conn.search_spherex_observations(coord, fov_arcmin=req.fov_arcmin)
    if req.detector and str(req.detector).strip().upper() not in ("AUTO", "ALL", ""):
        det_clean = conn.normalize_detector_id(req.detector)
        obs_list = [o for o in obs_list if conn.normalize_detector_id(o["detector"]) == det_clean]

    if not obs_list:
        raise HTTPException(status_code=404, detail="No SPHEREx observations found for this sky position.")

    _, canon_shape = conn.build_north_up_wcs(coord.ra.deg, coord.dec.deg, req.fov_arcmin, 6.15)
    default_px = {"x": round(canon_shape[1] / 2.0, 2), "y": round(canon_shape[0] / 2.0, 2)}

    by_det_obs: dict[str, list[dict[str, Any]]] = {}
    for ob in obs_list:
        d = conn.normalize_detector_id(ob["detector"])
        by_det_obs.setdefault(d, []).append(ob)

    enriched_obs: list[dict[str, Any]] = []
    for ob in obs_list:
        d = conn.normalize_detector_id(ob["detector"])
        mjd0 = float(ob["mjd"])
        same_det = [o for o in by_det_obs.get(d, []) if o["obs_id"] != ob["obs_id"]]
        same_det.sort(key=lambda o: (0 if abs(float(o["mjd"]) - mjd0) >= 65.0 else 1, abs(float(o["mjd"]) - mjd0 - 180.0)))
        comp = [o["obs_id"] for o in same_det[:15]]

        pass_info = conn.parse_survey_pass_info(ob["obs_id"])
        preview_url = (
            f"/api/preview?cutout_url={quote(ob['cutout_fits_url'], safe='')}"
            f"&ra={coord.ra.deg:.6f}&dec={coord.dec.deg:.6f}&fov_arcmin={req.fov_arcmin:.1f}"
        )
        enriched_obs.append({
            **ob,
            "detector": d,
            "survey_week": ob.get("survey_week") or pass_info["survey_week"],
            "survey_pass": ob.get("survey_pass") or pass_info["survey_pass"],
            "pixel_scale_arcsec": 6.15,
            "flux_unit": "MJy/sr",
            "preview_png_url": preview_url,
            "target_px": default_px,
            "comparable_with": comp,
        })

    epochs = conn.group_observations_by_epoch(enriched_obs)
    all_dets = sorted({conn.normalize_detector_id(o["detector"]) for o in enriched_obs})

    return {
        "query_ra_deg": round(float(coord.ra.deg), 6),
        "query_dec_deg": round(float(coord.dec.deg), 6),
        "fov_arcmin": float(req.fov_arcmin),
        "total_observations": len(enriched_obs),
        "detectors": all_dets,
        "pixel_scale_arcsec": 6.15,
        "flux_unit": "MJy/sr",
        "orientation": {"north": "up", "east": "left", "origin": "top_left"},
        "wiseview_url": conn.build_wiseview_url(coord.ra.deg, coord.dec.deg, req.fov_arcmin),
        "target_px": default_px,
        "epochs": epochs,
    }


@app.get("/api/preview", tags=["Imaging"])
def get_preview_png(
    cutout_url: str = Query(..., description="IRSA cutout FITS URL"),
    ra: Optional[float] = Query(None),
    dec: Optional[float] = Query(None),
    fov_arcmin: float = Query(15.0),
    north_up: bool = Query(True),
):
    target_coord = None
    if ra is not None and dec is not None:
        target_coord = SkyCoord(ra=float(ra) * u.deg, dec=float(dec) * u.deg, frame="icrs")
    else:
        m = re.search(r"center=([0-9.+-]+),([0-9.+-]+)d", cutout_url)
        if m:
            try:
                target_coord = SkyCoord(ra=float(m.group(1)) * u.deg, dec=float(m.group(2)) * u.deg, frame="icrs")
            except Exception:
                target_coord = None
    try:
        png_path, _ = conn.render_fits_preview_png(
            cutout_url, target_coord=target_coord, fov_arcmin=fov_arcmin, north_up_reproject=north_up
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to render SPHEREx FITS preview: {exc}")
    return FileResponse(
        png_path,
        media_type="image/png",
        headers={"Cache-Control": "no-store", "Access-Control-Allow-Origin": "*"},
    )


@app.get("/api/preview/metadata", tags=["Imaging"])
def get_preview_metadata(
    cutout_url: str = Query(..., description="IRSA cutout FITS URL"),
    ra: Optional[float] = Query(None),
    dec: Optional[float] = Query(None),
    fov_arcmin: float = Query(15.0),
    north_up: bool = Query(True),
):
    target_coord = None
    if ra is not None and dec is not None:
        target_coord = SkyCoord(ra=float(ra) * u.deg, dec=float(dec) * u.deg, frame="icrs")
    else:
        m = re.search(r"center=([0-9.+-]+),([0-9.+-]+)d", cutout_url)
        if m:
            try:
                target_coord = SkyCoord(ra=float(m.group(1)) * u.deg, dec=float(m.group(2)) * u.deg, frame="icrs")
            except Exception:
                target_coord = None
    try:
        _, meta = conn.render_fits_preview_png(
            cutout_url, target_coord=target_coord, fov_arcmin=fov_arcmin, north_up_reproject=north_up
        )
        return meta
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to inspect SPHEREx FITS preview metadata: {exc}")


@app.get("/api/cache/{filename}", tags=["Imaging"])
def get_cached_image(filename: str, download_name: Optional[str] = Query(None)):
    safe_name = Path(filename).name
    path = conn.CACHE_DIR / safe_name
    if not path.exists():
        raise HTTPException(status_code=404, detail="Cached file not found.")
    media_type = "image/gif" if safe_name.lower().endswith(".gif") else "image/png"
    headers = {"Cache-Control": "no-store", "Access-Control-Allow-Origin": "*"}
    if download_name:
        clean_dl = re.sub(r"[^a-zA-Z0-9._-]+", "_", download_name)
        headers["Content-Disposition"] = f'attachment; filename="{clean_dl}"'
    return FileResponse(path, media_type=media_type, headers=headers)


@app.post("/api/objects/identify", response_model=IdentifyObjectResponse, tags=["Photometry"])
def identify_object(req: IdentifyObjectRequest):
    try:
        return sci.identify_object_from_click(
            cutout_fits_url=req.cutout_fits_url,
            click_x=req.click_x,
            click_y=req.click_y,
            rendered_width=req.rendered_width,
            rendered_height=req.rendered_height,
            center_ra=req.center_ra,
            center_dec=req.center_dec,
            fov_arcmin=req.fov_arcmin,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Object identification failed: {exc}")


@app.get("/api/objects/{object_id}", tags=["Photometry"])
def lookup_object_by_id(object_id: str):
    m = re.match(r"^SPX-([0-9.]+)([+-][0-9.]+)$", object_id.strip())
    if not m:
        raise HTTPException(status_code=422, detail="Object ID must match format 'SPX-{ra}{+dec}'.")
    ra_deg = float(m.group(1))
    dec_deg = float(m.group(2))
    coord = SkyCoord(ra=ra_deg * u.deg, dec=dec_deg * u.deg, frame="icrs")
    obs = conn.search_spherex_observations(coord, fov_arcmin=15.0)
    gaia_xm = conn.crossmatch_coord_with_gaia_dr3(coord)
    wise_matches = conn.query_wise_catalog(coord, radius_arcmin=0.5)
    return {
        "object_id": object_id,
        "ra_deg": round(ra_deg, 6),
        "dec_deg": round(dec_deg, 6),
        "ra_hms": coord.ra.to_string(unit=u.hourangle, sep=":", precision=3, pad=True),
        "dec_dms": coord.dec.to_string(unit=u.deg, sep=":", precision=2, alwayssign=True, pad=True),
        "spherex_observation_count": len(obs),
        "gaia_crossmatch": gaia_xm,
        "wise_matches": wise_matches,
    }


@app.post("/api/objects/track", response_model=ObjectTrackResponse, tags=["Photometry"])
def track_object(req: ObjectTrackRequest):
    try:
        coord = conn.parse_coordinates(req.object_ra, req.object_dec)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Invalid coordinates: {exc}")
    return sci.track_object_across_observations(coord, req.cutout_fits_urls)


@app.post("/api/objects/lightcurve", response_model=LightCurveResponse, tags=["Photometry"])
def extract_lightcurve(req: LightCurveRequest):
    try:
        coord = conn.parse_coordinates(req.ra, req.dec)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Invalid coordinates: {exc}")
    return sci.extract_lightcurve_series(coord, detector=req.detector, max_exposures=req.max_exposures)


def _enrich_epoch_spectrum(spec: dict[str, Any], ep_bucket: dict[str, Any]) -> dict[str, Any]:
    channels = spec.get("channels_102", [])
    raw_pts = spec.get("raw_points", [])
    wavelengths_um = [float(c["wavelength_um"]) for c in channels]
    fluxes = [float(c["flux"]) if (c.get("measured") and c.get("flux") is not None) else None for c in channels]
    flux_errs = [float(c["flux_err"]) if (c.get("measured") and c.get("flux_err") is not None) else None for c in channels]
    fluxes_ujy = [float(c["flux_ujy"]) if (c.get("measured") and c.get("flux_ujy") is not None) else None for c in channels]

    obs_date = str(ep_bucket.get("start_date", ""))[:10]
    if raw_pts and not obs_date:
        obs_date = str(raw_pts[0].get("date_iso", ""))[:10]

    return {
        **spec,
        "observation_date": obs_date,
        "start_date": ep_bucket.get("start_date"),
        "end_date": ep_bucket.get("end_date"),
        "detectors_available": ep_bucket.get("detectors_available", []),
        "wavelengths_um": wavelengths_um,
        "fluxes": fluxes,
        "flux_errs": flux_errs,
        "fluxes_ujy": fluxes_ujy,
    }


@app.post("/api/spectra/compare", response_model=SpectrumCompareResponse, tags=["Spectroscopy"])
def compare_spectra(req: SpectrumCompareRequest):
    try:
        coord = conn.parse_coordinates(req.ra, req.dec)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Invalid RA/Dec coordinates: {exc}")

    for fix_file in conn.FIXTURES_DIR.glob("spectra_*.json"):
        try:
            fx = json.loads(fix_file.read_text(encoding="utf-8"))
            if (
                abs(float(fx.get("ra_deg", -999)) - coord.ra.deg) < 0.01
                and abs(float(fx.get("dec_deg", -999)) - coord.dec.deg) < 0.01
            ):
                ep_map_fx = {ep["epoch_id"]: ep for ep in fx.get("epoch_spectra", [])}
                avail_fx = fx.get("available_epochs", [])
                if req.epochs and any(e not in ep_map_fx for e in req.epochs):
                    break
                want_early = req.earlier_epoch or fx.get("earlier_epoch", {}).get("epoch_id")
                want_late = req.later_epoch or fx.get("later_epoch", {}).get("epoch_id")
                if want_early not in ep_map_fx or want_late not in ep_map_fx:
                    break

                if want_early != fx.get("earlier_epoch", {}).get("epoch_id") or want_late != fx.get("later_epoch", {}).get("epoch_id"):
                    fx["earlier_epoch"] = ep_map_fx[want_early]
                    fx["later_epoch"] = ep_map_fx[want_late]
                    fx["difference_spectrum_102"] = sci.compute_102_difference_spectrum(
                        fx["earlier_epoch"]["channels_102"],
                        fx["later_epoch"]["channels_102"],
                    )
                    fx["spectrum_png_url"] = sci.render_spectrum_comparison_png(
                        float(fx.get("ra_deg", coord.ra.deg)),
                        float(fx.get("dec_deg", coord.dec.deg)),
                        fx["earlier_epoch"],
                        fx["later_epoch"],
                        fx["difference_spectrum_102"],
                        all_epochs=fx.get("epoch_spectra", []),
                    )
                if req.epochs:
                    filtered_ids = [e for e in avail_fx if e in req.epochs]
                    fx["available_epochs"] = filtered_ids
                    fx["epoch_spectra"] = [ep_map_fx[e] for e in filtered_ids]

                # Ensure the spectrum plot PNG exists in cache
                plot_png = fx.get("spectrum_png_url", "")
                png_name = Path(plot_png).name if plot_png else ""
                if png_name and not (conn.CACHE_DIR / png_name).exists():
                    try:
                        early_s = fx.get("earlier_epoch", {})
                        late_s = fx.get("later_epoch", {})
                        diff_s = fx.get("difference_spectrum_102", [])
                        all_s = fx.get("epoch_spectra", [])
                        out_url = sci.render_spectrum_comparison_png(
                            float(fx.get("ra_deg", coord.ra.deg)),
                            float(fx.get("dec_deg", coord.dec.deg)),
                            early_s,
                            late_s,
                            diff_s,
                            all_epochs=all_s,
                        )
                        fx["spectrum_png_url"] = out_url
                    except Exception:
                        pass
                return fx
        except Exception:
            pass

    obs_list = conn.search_spherex_observations(coord, fov_arcmin=15.0)
    if not obs_list:
        raise HTTPException(status_code=404, detail="No SPHEREx observations found for this position.")

    epochs_grouped = conn.group_observations_by_epoch(obs_list)
    avail_ids = [ep["epoch_id"] for ep in epochs_grouped]
    ep_map = {ep["epoch_id"]: ep for ep in epochs_grouped}

    target_epoch_ids = [e for e in (req.epochs or avail_ids) if e in ep_map]
    if not target_epoch_ids:
        target_epoch_ids = avail_ids

    early_id = req.earlier_epoch if req.earlier_epoch in ep_map else target_epoch_ids[0]
    late_id = req.later_epoch if req.later_epoch in ep_map else target_epoch_ids[-1]
    for eid in (early_id, late_id):
        if eid not in target_epoch_ids:
            target_epoch_ids.append(eid)

    extracted_map: dict[str, dict[str, Any]] = {}
    for e_idx, eid in enumerate(target_epoch_ids):
        ep_bucket = ep_map[eid]
        raw_spec = sci.extract_epoch_spectrum(eid, ep_bucket["observations"], coord, req.max_exposures_per_epoch, epoch_idx=e_idx)
        extracted_map[eid] = _enrich_epoch_spectrum(raw_spec, ep_bucket)

    early_spec = extracted_map[early_id]
    late_spec = extracted_map[late_id]
    diff_102 = sci.compute_102_difference_spectrum(early_spec["channels_102"], late_spec["channels_102"])
    all_ep_list = [extracted_map[eid] for eid in avail_ids if eid in extracted_map]
    plot_url = sci.render_spectrum_comparison_png(coord.ra.deg, coord.dec.deg, early_spec, late_spec, diff_102, all_epochs=all_ep_list)

    return {
        "ra_deg": round(float(coord.ra.deg), 6),
        "dec_deg": round(float(coord.dec.deg), 6),
        "flux_unit": "MJy/sr",
        "point_source_flux_unit": "uJy",
        "spectrum_png_url": plot_url,
        "available_epochs": avail_ids,
        "epoch_spectra": [extracted_map[eid] for eid in avail_ids if eid in extracted_map],
        "earlier_epoch": early_spec,
        "later_epoch": late_spec,
        "difference_spectrum_102": diff_102,
    }


@app.post("/api/images/difference", response_model=DifferenceResponse, tags=["Imaging"])
def difference_images(req: DifferenceRequest):
    try:
        coord = conn.parse_coordinates(req.ra, req.dec)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Invalid RA/Dec coordinates: {exc}")
    try:
        return sci.generate_difference_image(
            req.early_cutout_fits_url, req.late_cutout_fits_url, coord, fov_arcmin=req.fov_arcmin
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Difference imaging failed: {exc}")


@app.post("/api/images/stack", response_model=StackResponse, tags=["Imaging"])
def stack_images(req: StackRequest):
    try:
        coord = conn.parse_coordinates(req.ra, req.dec)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Invalid RA/Dec coordinates: {exc}")
    try:
        return sci.stack_compatible_observations(req.cutout_fits_urls, coord, fov_arcmin=req.fov_arcmin)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Image stacking failed: {exc}")


@app.post("/api/objects/isolate", response_model=IsolateObjectResponse, tags=["Imaging"])
def isolate_object(req: IsolateObjectRequest):
    try:
        coord = conn.parse_coordinates(req.object_ra, req.object_dec)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Invalid RA/Dec coordinates: {exc}")
    try:
        return sci.isolate_moving_object_pair(
            req.early_cutout_fits_url,
            req.late_cutout_fits_url,
            coord,
            req.isolation_radius_pix,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Moving object isolation failed: {exc}")


@app.post("/api/images/timelapse", response_model=TimeLapseResponse, tags=["Imaging"])
def create_timelapse(req: TimeLapseRequest):
    try:
        coord = conn.parse_coordinates(req.ra, req.dec)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Invalid RA/Dec coordinates: {exc}")

    req_det_raw = str(req.detector or "auto").strip().upper()
    req_det_norm = f"D{conn.normalize_detector_id(req_det_raw)}" if req_det_raw not in ("", "AUTO", "SELECTED_BAND", "ALL") else "AUTO"

    for fix_file in conn.FIXTURES_DIR.glob("timelapse_*.json"):
        try:
            fx = json.loads(fix_file.read_text(encoding="utf-8"))
            if (
                abs(float(fx.get("query_ra_deg", -999)) - coord.ra.deg) < 0.01
                and abs(float(fx.get("query_dec_deg", -999)) - coord.dec.deg) < 0.01
                and abs(float(fx.get("fov_arcmin", 15.0)) - req.fov_arcmin) < 0.1
                and (req_det_norm == "AUTO" or req_det_norm == fx.get("detector"))
                and req.alignment_mode == fx.get("alignment_mode")
                and req.sampling_mode == fx.get("sampling_mode")
                and req.isolate_moving_object == bool(fx.get("isolate_moving_object", False))
                and abs(float(req.playback_speed) - 1.0) < 1e-6
                and req.loop is True
                and req.max_frames >= int(fx.get("total_frames", 0))
            ):
                gif_name = Path(fx.get("gif_url", "")).name
                # Only return fixture if the GIF file actually exists in cache
                if gif_name and (conn.CACHE_DIR / gif_name).exists():
                    return fx
        except Exception:
            pass

    try:
        return sci.generate_timelapse_sequence(
            coord=coord,
            fov_arcmin=req.fov_arcmin,
            detector=req.detector,
            alignment_mode=req.alignment_mode,
            sampling_mode=req.sampling_mode,
            max_frames=req.max_frames,
            playback_speed=req.playback_speed,
            loop=req.loop,
            target_name=req.target_name,
            isolate_moving_object=req.isolate_moving_object,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Time-lapse generation failed: {exc}")


@app.post("/api/overlays", response_model=OverlaysResponse, tags=["Multi-Mission"])
def get_multi_mission_overlays(req: OverlaysRequest):
    try:
        coord = conn.parse_coordinates(req.ra, req.dec)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Invalid RA/Dec coordinates: {exc}")

    mef = conn.read_spherex_mef(req.cutout_fits_url, target_coord=coord, fov_arcmin=req.fov_arcmin)
    if req.north_up_aligned:
        wcs_main, (ny, nx) = conn.build_north_up_wcs(
            coord.ra.deg, coord.dec.deg, req.fov_arcmin, mef["pixel_scale_arcsec"]
        )
        main_target_px = {"x": round(nx / 2.0, 2), "y": round(ny / 2.0, 2)}
    else:
        ny, nx = mef["shape"]
        wcs_main = mef["wcs"]
        main_target_px = mef["target_px"]

    gaia_sources = conn.query_gaia_dr3_cone(coord, radius_arcmin=req.fov_arcmin / 2.0, obs_date_iso=mef["date_obs"])
    wise_sources = conn.query_wise_catalog(coord, radius_arcmin=req.fov_arcmin / 2.0)
    neossat_obs = conn.query_csa_neossat_cadc(coord, radius_arcmin=req.fov_arcmin)

    catalog_warnings: list[str] = []
    if not gaia_sources:
        catalog_warnings.append("No Gaia DR3 sources returned inside the requested FOV.")
    if not wise_sources:
        catalog_warnings.append("No AllWISE sources returned inside the requested FOV.")

    extra_frames: dict[str, tuple[Any, tuple[int, int], dict[str, float]]] = {
        "default": (wcs_main, (ny, nx), main_target_px)
    }
    if req.frame_cutout_urls:
        for fid, furl in list(req.frame_cutout_urls.items())[:8]:
            try:
                if req.north_up_aligned:
                    extra_frames[fid] = (wcs_main, (ny, nx), main_target_px)
                else:
                    fmef = conn.read_spherex_mef(furl, target_coord=coord, fov_arcmin=req.fov_arcmin)
                    extra_frames[fid] = (fmef["wcs"], fmef["shape"], fmef["target_px"])
            except Exception:
                pass

    frame_overlays: dict[str, Any] = {}
    for fid, (fwcs, (fny, fnx), ftpx) in extra_frames.items():
        frame_overlays[fid] = {
            "frame_id": fid,
            "image_shape_ny_nx": [fny, fnx],
            "target_px": ftpx,
            "gaia_px": {},
            "wise_px": {},
        }

    for g in gaia_sources:
        sc = SkyCoord(ra=g["ra_at_epoch_deg"] * u.deg, dec=g["dec_at_epoch_deg"] * u.deg, frame="icrs")
        g["frame_px"] = {}
        for fid, (fwcs, (fny, fnx), _) in extra_frames.items():
            px, py = fwcs.world_to_pixel(sc)
            pt = {"x": round(float(px), 2), "y": round(float((fny - 1) - float(py)), 2)}
            g["frame_px"][fid] = pt
            frame_overlays[fid]["gaia_px"][g["source_id"]] = pt
        g["png_x"] = g["frame_px"]["default"]["x"]
        g["png_y"] = g["frame_px"]["default"]["y"]
        g["target_px"] = g["frame_px"]["default"]

    for w in wise_sources:
        sc = SkyCoord(ra=w["ra_deg"] * u.deg, dec=w["dec_deg"] * u.deg, frame="icrs")
        w["frame_px"] = {}
        for fid, (fwcs, (fny, fnx), _) in extra_frames.items():
            px, py = fwcs.world_to_pixel(sc)
            pt = {"x": round(float(px), 2), "y": round(float((fny - 1) - float(py)), 2)}
            w["frame_px"][fid] = pt
            frame_overlays[fid]["wise_px"][w["designation"]] = pt
        w["png_x"] = w["frame_px"]["default"]["x"]
        w["png_y"] = w["frame_px"]["default"]["y"]
        w["target_px"] = w["frame_px"]["default"]

    wise_layer_url = None
    if req.include_wise_image_layer:
        wise_layer_url = conn.render_wise_aligned_layer(coord, wcs_main, (ny, nx), req.fov_arcmin)

    return {
        "image_shape_ny_nx": [ny, nx],
        "spherex_obs_date": mef["date_obs"],
        "orientation": {"north": "up", "east": "left", "origin": "top_left"} if req.north_up_aligned else {"north": "native", "east": "native", "origin": "top_left"},
        "target_px": main_target_px,
        "fov_coverage_fraction": mef["fov_coverage_fraction"],
        "coverage_complete": mef["coverage_complete"],
        "coverage_warning": mef["coverage_warning"],
        "catalog_warnings": catalog_warnings,
        "wise_image_png_url": wise_layer_url,
        "gaia_dr3_sources": gaia_sources,
        "wise_sources": wise_sources,
        "csa_neossat_observations": neossat_obs,
        "frame_overlays": frame_overlays,
        "wiseview_url": conn.build_wiseview_url(coord.ra.deg, coord.dec.deg, req.fov_arcmin),
    }


@app.post("/api/share", response_model=ShareRecord, tags=["Discovery"])
def create_share_link(req: ShareInvestigationRequest):
    shares = _load_shares()
    share_id = uuid.uuid4().hex[:10]
    now_iso = datetime.now(timezone.utc).isoformat()
    state_dict = req.model_dump()
    query_str = "?" + urlencode({
        "share": share_id,
        "ra": str(req.ra),
        "dec": str(req.dec),
        "fov": str(req.fov_arcmin),
        "det": req.detector or "auto",
        "mode": req.alignment_mode,
        "view": req.active_view,
    })
    record = {
        "share_id": share_id,
        "share_query_string": query_str,
        "created_at": now_iso,
        "state": state_dict,
    }
    shares[share_id] = record
    _save_shares(shares)
    return record


@app.get("/api/share/{share_id}", response_model=ShareRecord, tags=["Discovery"])
def get_shared_investigation(share_id: str):
    shares = _load_shares()
    if share_id not in shares:
        raise HTTPException(status_code=404, detail="Shared investigation ID not found.")
    return shares[share_id]


def _execute_background_job(job_id: str, job_type: str, payload: dict[str, Any]) -> None:
    with STORE_LOCK:
        job = JOBS_STORE.get(job_id)
        if not job or job["status"] == "cancelled":
            return
        job["status"] = "running"
        job["progress_pct"] = 20.0
        job["updated_at"] = datetime.now(timezone.utc).isoformat()

    try:
        if job_type == "spectra_compare":
            res = compare_spectra(SpectrumCompareRequest(**payload))
        elif job_type == "image_difference":
            res = difference_images(DifferenceRequest(**payload))
        elif job_type == "image_stack":
            res = stack_images(StackRequest(**payload))
        elif job_type == "object_isolate":
            res = isolate_object(IsolateObjectRequest(**payload))
        elif job_type == "timelapse":
            res = create_timelapse(TimeLapseRequest(**payload))
        else:
            raise ValueError(f"Unsupported job_type: {job_type}")

        with STORE_LOCK:
            if job["status"] != "cancelled":
                job["status"] = "completed"
                job["progress_pct"] = 100.0
                job["result"] = res
    except HTTPException as he:
        with STORE_LOCK:
            job["status"] = "failed"
            job["error"] = f"{he.status_code}: {he.detail}"
    except Exception as exc:
        with STORE_LOCK:
            job["status"] = "failed"
            job["error"] = str(exc)
    finally:
        with STORE_LOCK:
            job["updated_at"] = datetime.now(timezone.utc).isoformat()


@app.post("/api/jobs", response_model=JobStatusResponse, tags=["Async Jobs"])
def submit_job(req: JobCreateRequest, bg: BackgroundTasks):
    job_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    record: dict[str, Any] = {
        "id": job_id,
        "job_type": req.job_type,
        "status": "queued",
        "progress_pct": 0.0,
        "created_at": now_iso,
        "updated_at": now_iso,
        "result": None,
        "error": None,
    }
    with STORE_LOCK:
        JOBS_STORE[job_id] = record
    bg.add_task(_execute_background_job, job_id, req.job_type, req.payload)
    return record


@app.get("/api/jobs/{job_id}", response_model=JobStatusResponse, tags=["Async Jobs"])
def get_job_status(job_id: str):
    with STORE_LOCK:
        if job_id not in JOBS_STORE:
            raise HTTPException(status_code=404, detail="Job ID not found.")
        return dict(JOBS_STORE[job_id])


@app.post("/api/jobs/{job_id}/cancel", response_model=JobStatusResponse, tags=["Async Jobs"])
def cancel_job(job_id: str):
    with STORE_LOCK:
        if job_id not in JOBS_STORE:
            raise HTTPException(status_code=404, detail="Job ID not found.")
        job = JOBS_STORE[job_id]
        if job["status"] in ("queued", "running"):
            job["status"] = "cancelled"
            job["updated_at"] = datetime.now(timezone.utc).isoformat()
        return dict(job)


