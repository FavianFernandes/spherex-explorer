"""Run `python verify_connection.py` to test NASA SPHEREx, Gaia DR3, WiseView, and CSA CADC."""
from app.spherex_connector import (
    parse_coordinates,
    search_spherex_observations,
    download_spherex_cutout,
    read_spherex_mef,
    save_cutout_png,
    query_gaia_dr3_cone,
    query_csa_neossat_cadc,
    build_wiseview_url,
    CACHE_DIR,
)


def main():
    ra_input = "08h55m10.831s"
    dec_input = "-07d14m42.53s"
    fov_arcmin = 15.0

    print("=" * 70)
    print("1. PARSING TARGET COORDINATES (WISE 0855-0714)")
    coord = parse_coordinates(ra_input, dec_input)
    print(f"   ICRS Decimal Degrees: RA = {coord.ra.deg:.6f} deg, Dec = {coord.dec.deg:.6f} deg")

    print("\n2. QUERYING NASA/IPAC IRSA ARCHIVE FOR SPHEREx OBSERVATIONS...")
    obs_list = search_spherex_observations(coord, fov_arcmin=fov_arcmin)
    print(f"   Found {len(obs_list)} real SPHEREx Level-2 spectral image observations!")
    if not obs_list:
        print("   No observations returned. Check your internet connection.")
        return

    first_obs = obs_list[0]
    latest_obs = obs_list[-1]
    print(f"   Earliest Obs: {first_obs['date_iso']} | Detector: {first_obs['detector']} | Release: {first_obs['release']}")
    print(f"   Latest Obs  : {latest_obs['date_iso']} | Detector: {latest_obs['detector']} | Release: {latest_obs['release']}")

    print("\n3. DOWNLOADING REAL SPHEREx FITS CUTOUT FROM IRSA...")
    fits_path = download_spherex_cutout(first_obs["cutout_fits_url"])
    print(f"   Saved FITS file to: {fits_path} ({fits_path.stat().st_size / 1024:.1f} KB)")

    print("\n4. READING SPHEREx MULTI-EXTENSION FITS (MEF) & WCS-WAVE...")
    mef = read_spherex_mef(fits_path, coord)
    for k, v in mef["metadata"].items():
        print(f"   {k}: {v}")

    png_path = CACHE_DIR / "verified_spherex_cutout.png"
    save_cutout_png(mef, png_path)
    print(f"\n   --> Rendered PNG cutout saved to: {png_path}")

    print("\n5. TESTING PARTNER RESOURCES (Gaia DR3, CSA NEOSSat/CADC, WiseView)...")
    gaia_sources = query_gaia_dr3_cone(coord, radius_arcsec=60.0)
    print(f"   Gaia DR3 sources within 60 arcsec: {len(gaia_sources)}")

    neossat_obs = query_csa_neossat_cadc(coord, radius_deg=0.5)
    print(f"   CSA/CADC NEOSSat observations within 0.5 deg: {len(neossat_obs)}")
    print(f"   WiseView Reference Link: {build_wiseview_url(coord, fov_arcmin)}")
    print("=" * 70)


if __name__ == "__main__":
    main()