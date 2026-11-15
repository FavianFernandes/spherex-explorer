"""
test_5_targets.py

Run from the backend directory:
    .\.venv\Scripts\python.exe .\test_5_targets.py

This script calls the FastAPI application directly through TestClient.
It does not start Uvicorn or make HTTP requests to localhost.

Note: the application may still make outbound requests to NASA/IRSA and other
archives from inside its connector. TestClient only avoids the local HTTP hop.
"""

from __future__ import annotations

import json
import sys
import traceback
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

# Ensure "from app.main import app" works when this script is run from backend/.
BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

try:
    from fastapi.testclient import TestClient
    from astropy.coordinates import SkyCoord
    import astropy.units as u
    from app.main import app
except Exception:
    print("Could not import the backend application or test dependencies.")
    traceback.print_exc()
    raise SystemExit(1)


TARGETS = [
    {
        "name": "WISE 0855-0714",
        "ra": "08h55m10.831s",
        "dec": "-07d14m42.53s",
        "proper_motion_arcsec_yr": 8.1,
    },
    {
        "name": "Barnard's Star",
        "ra": "17h57m48.498s",
        "dec": "+04d41m36.11s",
        "proper_motion_arcsec_yr": 10.3,
    },
    {
        "name": "Epsilon Indi Ba/Bb",
        "ra": "22h04m10.52s",
        "dec": "-56d46m57.7s",
        "proper_motion_arcsec_yr": None,
    },
    {
        "name": "RW Aurigae",
        "ra": "05h07m49.568s",
        "dec": "+30d24m05.16s",
        "proper_motion_arcsec_yr": None,
    },
    {
        "name": "R Draconis",
        "ra": "16h32m40.227s",
        "dec": "+66d45m17.86s",
        "proper_motion_arcsec_yr": None,
    },
]

FOV_ARCMIN = 15.0

# Candidate FITS URL field names that may occur in the search response.
FITS_URL_KEYS = (
    "cutout_fits_url",
    "fits_cutout_url",
    "fits_url",
    "download_fits_url",
    "file_url",
    "data_url",
)

OBSERVATION_ID_KEYS = (
    "observation_id",
    "obs_id",
    "obsid",
    "observation",
    "id",
)

DETECTOR_KEYS = (
    "detector_id",
    "detector",
    "array_id",
    "array",
)

EPOCH_KEYS = (
    "survey_epoch",
    "epoch_label",
    "epoch",
    "survey",
    "season",
)

DATE_KEYS = (
    "observation_time",
    "observation_date",
    "obs_time",
    "date_obs",
    "mjd",
    "timestamp",
)


results: list[dict[str, str]] = []


def record_result(target: str, feature: str, status: str, detail: str = "") -> None:
    results.append(
        {
            "target": target,
            "feature": feature,
            "status": status,
            "detail": detail.replace("\n", " ")[:180],
        }
    )


def print_response_failure(label: str, response) -> None:
    print(f"\n[HTTP FAILURE] {label}")
    print(f"Status: {response.status_code}")
    try:
        print("Response body:")
        print(json.dumps(response.json(), indent=2, default=str))
    except Exception:
        print(response.text[:10000])


def call_api(client: TestClient, method: str, path: str, *, json_body=None, label=""):
    """Call an in-process FastAPI endpoint and raise on non-2xx responses."""
    response = client.request(method, path, json=json_body)
    if response.status_code >= 400:
        print_response_failure(label or f"{method} {path}", response)
        raise RuntimeError(
            f"{label or path} returned HTTP {response.status_code}: "
            f"{response.text[:1500]}"
        )
    return response


def parse_json_response(response) -> Any:
    try:
        return response.json()
    except Exception:
        return {}


def walk_dicts(value: Any):
    """Yield every dictionary nested inside a JSON-like response."""
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk_dicts(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk_dicts(child)


def first_value(record: dict, keys: tuple[str, ...]):
    for key in keys:
        value = record.get(key)
        if value not in (None, ""):
            return value
    return None


def survey_epoch_from_date(value: Any) -> str | None:
    """Convert a date/time into a half-year label such as 2025-S1."""
    if value is None:
        return None

    # MJD is commonly around 50000 to 70000.
    if isinstance(value, (int, float)):
        try:
            from astropy.time import Time
            dt = Time(float(value), format="mjd").to_datetime()
            return f"{dt.year}-S{1 if dt.month <= 6 else 2}"
        except Exception:
            return None

    text = str(value).strip()
    if not text:
        return None

    # Already a useful epoch label.
    upper = text.upper().replace("_", "-")
    if "-S1" in upper or "-S2" in upper:
        return upper

    try:
        normalized = text.replace("Z", "+00:00")
        dt = datetime.fromisoformat(normalized)
        return f"{dt.year}-S{1 if dt.month <= 6 else 2}"
    except Exception:
        pass

    # Try common date-only formats.
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y%m%d"):
        try:
            dt = datetime.strptime(text[:10], fmt)
            return f"{dt.year}-S{1 if dt.month <= 6 else 2}"
        except Exception:
            continue

    return None


def normalize_observations(search_data: Any) -> list[dict[str, Any]]:
    """
    Extract observation records from a response without assuming one exact
    nesting structure. FITS URLs must be explicitly present in the response.
    """
    observations: list[dict[str, Any]] = []
    seen: set[tuple] = set()

    for item in walk_dicts(search_data):
        fits_url = first_value(item, FITS_URL_KEYS)

        # Do not treat preview PNGs or arbitrary URLs as FITS downloads.
        if not fits_url or not isinstance(fits_url, str):
            continue
        path = urlparse(fits_url).path.lower()
        if not (path.endswith(".fits") or path.endswith(".fits.gz") or "fits" in path):
            continue

        detector = first_value(item, DETECTOR_KEYS)
        epoch = first_value(item, EPOCH_KEYS)
        date_value = first_value(item, DATE_KEYS)

        if epoch is None:
            epoch = survey_epoch_from_date(date_value)

        observation_id = first_value(item, OBSERVATION_ID_KEYS)
        key = (str(observation_id), str(detector), str(epoch), fits_url)
        if key in seen:
            continue
        seen.add(key)

        observations.append(
            {
                "observation_id": observation_id,
                "detector": str(detector) if detector is not None else "UNKNOWN",
                "epoch": str(epoch) if epoch is not None else None,
                "date": date_value,
                "fits_url": fits_url,
                "raw": item,
            }
        )

    return observations


def count_observations(search_data: Any) -> int:
    """Prefer explicit observation arrays/IDs; fall back to extracted FITS records."""
    for item in walk_dicts(search_data):
        for key in ("observations", "frames", "epochs"):
            value = item.get(key)
            if isinstance(value, list):
                # An epochs list may contain groups rather than individual frames.
                if key == "epochs":
                    nested_count = sum(
                        len(v) if isinstance(v, list) else 1 for v in value
                    )
                    if nested_count:
                        return nested_count
                elif value:
                    return len(value)

    records = []
    for item in walk_dicts(search_data):
        if first_value(item, OBSERVATION_ID_KEYS) is not None:
            records.append(item)
    if records:
        return len(records)
    return 0


def coordinates_degrees(ra_text: str, dec_text: str) -> tuple[float, float]:
    coord = SkyCoord(ra=ra_text, dec=dec_text, unit=(u.hourangle, u.deg), frame="icrs")
    return float(coord.ra.deg), float(coord.dec.deg)


def print_observation_summary(target_name: str, data: Any, records: list[dict[str, Any]]) -> None:
    total = count_observations(data)
    detectors = sorted({r["detector"] for r in records})
    epochs = sorted({r["epoch"] for r in records if r["epoch"]})

    print(f"\n  Total observations reported: {total}")
    print(f"  FITS observations identified: {len(records)}")
    print(f"  Available detectors: {', '.join(detectors) if detectors else 'Not exposed in response'}")
    print(f"  Survey epochs: {', '.join(epochs) if epochs else 'Not identifiable from response'}")

    if len(epochs) < 2:
        print("  MULTI-EPOCH COVERAGE: Not established from the returned FITS observation records.")
    else:
        print(f"  MULTI-EPOCH COVERAGE: Yes, {len(epochs)} distinct epoch label(s) identified.")


def choose_same_detector_epoch_pair(records: list[dict[str, Any]]):
    """
    Select two FITS cutouts from different epochs for the same detector.
    Returns (early_record, late_record), or None.
    """
    grouped: dict[str, dict[str, dict[str, Any]]] = defaultdict(dict)

    for record in records:
        detector = record["detector"]
        epoch = record["epoch"]
        if not epoch:
            continue
        # Keep the first valid FITS cutout for each detector/epoch pair.
        grouped[detector].setdefault(epoch, record)

    candidates = []
    for detector, epochs in grouped.items():
        if len(epochs) >= 2:
            ordered = sorted(epochs.items(), key=lambda pair: pair[0])
            candidates.append((detector, ordered[0][1], ordered[-1][1]))

    if not candidates:
        return None

    # Prefer a named detector over UNKNOWN, all else equal.
    candidates.sort(key=lambda x: (x[0] == "UNKNOWN", x[0]))
    detector, early, late = candidates[0]
    return early, late


def run_endpoint(
    client: TestClient,
    target_name: str,
    feature: str,
    method: str,
    path: str,
    body: dict | None = None,
) -> bool:
    label = f"{target_name} | {feature}"
    print(f"\n  Testing {feature}: {method} {path}")
    try:
        response = call_api(
            client, method, path, json_body=body, label=label
        )
        data = parse_json_response(response)
        print(f"  PASS: HTTP {response.status_code}")
        if isinstance(data, dict):
            # Keep console output concise.
            print(f"  Response keys: {', '.join(list(data.keys())[:20])}")
        record_result(target_name, feature, "PASS", f"HTTP {response.status_code}")
        return True
    except Exception as exc:
        print(f"  FAIL: {type(exc).__name__}: {exc}")
        traceback.print_exc()
        record_result(target_name, feature, "FAIL", f"{type(exc).__name__}: {exc}")
        return False


def main() -> None:
    print("=" * 90)
    print("SPHEREx Explorer: NASA Five-Target Backend Test")
    print("Using FastAPI TestClient directly, without localhost HTTP")
    print("=" * 90)

    # raise_server_exceptions=True allows unhandled Python exceptions in the
    # application to propagate here, where traceback.print_exc() can show them.
    with TestClient(app, raise_server_exceptions=True) as client:
        for target in TARGETS:
            name = target["name"]
            ra = target["ra"]
            dec = target["dec"]
            ra_deg, dec_deg = coordinates_degrees(ra, dec)

            print("\n" + "#" * 90)
            print(f"TARGET: {name}")
            print(f"RA: {ra} ({ra_deg:.8f} deg)")
            print(f"Dec: {dec} ({dec_deg:.8f} deg)")
            print("#" * 90)

            # 1. Search observations.
            search_data = None
            records: list[dict[str, Any]] = []
            print("\n  Testing SPHEREx observation search: POST /api/search")
            try:
                response = call_api(
                    client,
                    "POST",
                    "/api/search",
                    json_body={"ra": ra, "dec": dec, "fov_arcmin": FOV_ARCMIN},
                    label=f"{name} | search",
                )
                search_data = parse_json_response(response)
                records = normalize_observations(search_data)
                print(f"  PASS: HTTP {response.status_code}")
                print_observation_summary(name, search_data, records)
                record_result(
                    name,
                    "search",
                    "PASS",
                    f"HTTP {response.status_code}; {count_observations(search_data)} observations reported",
                )
            except Exception as exc:
                print(f"  FAIL: {type(exc).__name__}: {exc}")
                traceback.print_exc()
                record_result(name, "search", "FAIL", f"{type(exc).__name__}: {exc}")
                # Without search data, downstream tests cannot be prepared safely.
                record_result(name, "overlays", "SKIP", "Search failed")
                record_result(name, "spectra/compare", "SKIP", "Search failed")
                record_result(name, "images/difference", "SKIP", "Search failed")
                record_result(name, "objects/isolate", "SKIP", "Search failed")
                continue

            # 2. Overlay test requires a real FITS cutout URL from search.
            first_fits = records[0]["fits_url"] if records else None
            if first_fits:
                run_endpoint(
                    client,
                    name,
                    "overlays",
                    "POST",
                    "/api/overlays",
                    {
                        "cutout_fits_url": first_fits,
                        "ra": ra_deg,
                        "dec": dec_deg,
                        "fov_arcmin": FOV_ARCMIN,
                    },
                )
            else:
                print("\n  SKIP overlays: search response did not expose a usable FITS URL.")
                record_result(name, "overlays", "SKIP", "No FITS cutout URL found in search response")

            # 3. Spectral comparison test.
            run_endpoint(
                client,
                name,
                "spectra/compare",
                "POST",
                "/api/spectra/compare",
                {"ra": ra, "dec": dec},
            )

            # 4. Difference imaging and isolation need >=2 epochs for one detector.
            pair = choose_same_detector_epoch_pair(records)
            if pair:
                early, late = pair
                print(
                    "\n  Selected comparison pair: "
                    f"detector={early['detector']}, "
                    f"early_epoch={early['epoch']}, late_epoch={late['epoch']}"
                )

                run_endpoint(
                    client,
                    name,
                    "images/difference",
                    "POST",
                    "/api/images/difference",
                    {
                        "early_cutout_fits_url": early["fits_url"],
                        "late_cutout_fits_url": late["fits_url"],
                        "ra": ra_deg,
                        "dec": dec_deg,
                    },
                )

                run_endpoint(
                    client,
                    name,
                    "objects/isolate",
                    "POST",
                    "/api/objects/isolate",
                    {
                        "early_cutout_fits_url": early["fits_url"],
                        "late_cutout_fits_url": late["fits_url"],
                        "object_ra": ra_deg,
                        "object_dec": dec_deg,
                    },
                )
            else:
                print(
                    "\n  SKIP difference/isolation: no two distinct survey epochs "
                    "with FITS cutout URLs were found for the same detector."
                )
                record_result(
                    name,
                    "images/difference",
                    "SKIP",
                    "No same-detector multi-epoch FITS pair found",
                )
                record_result(
                    name,
                    "objects/isolate",
                    "SKIP",
                    "No same-detector multi-epoch FITS pair found",
                )

    # Final summary.
    print("\n\n" + "=" * 110)
    print("FINAL PASS / FAIL SUMMARY")
    print("=" * 110)
    headers = ("TARGET", "FEATURE", "STATUS", "DETAIL")
    widths = (24, 22, 10, 48)
    print(
        f"{headers[0]:<{widths[0]}} "
        f"{headers[1]:<{widths[1]}} "
        f"{headers[2]:<{widths[2]}} "
        f"{headers[3]:<{widths[3]}}"
    )
    print("-" * 110)

    for item in results:
        print(
            f"{item['target']:<{widths[0]}} "
            f"{item['feature']:<{widths[1]}} "
            f"{item['status']:<{widths[2]}} "
            f"{item['detail']:<{widths[3]}}"
        )

    counts = {
        status: sum(1 for item in results if item["status"] == status)
        for status in ("PASS", "FAIL", "SKIP")
    }
    print("-" * 110)
    print(
        f"TOTAL: {counts['PASS']} PASS | "
        f"{counts['FAIL']} FAIL | {counts['SKIP']} SKIP"
    )
    print("=" * 110)

    if counts["FAIL"]:
        print("RESULT: One or more endpoint tests failed. Review the tracebacks above.")
        raise SystemExit(1)
    if counts["SKIP"]:
        print("RESULT: No endpoint test failed, but some tests were skipped because suitable data was unavailable.")
    else:
        print("RESULT: All requested endpoint tests passed.")


if __name__ == "__main__":
    main()
