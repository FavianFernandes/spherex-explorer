import os
from pathlib import Path

_base = Path(__file__).resolve().parent.parent
_astropy_cfg = _base / ".astropy" / "config"
_astropy_cache = _base / ".astropy" / "cache"
_mpl_cfg = _base / ".matplotlib"

_astropy_cfg.mkdir(parents=True, exist_ok=True)
_astropy_cache.mkdir(parents=True, exist_ok=True)
_mpl_cfg.mkdir(parents=True, exist_ok=True)

os.environ.setdefault("ASTROPY_CONFIG_DIR", str(_astropy_cfg))
os.environ.setdefault("ASTROPY_CACHE_DIR", str(_astropy_cache))
os.environ.setdefault("MPLCONFIGDIR", str(_mpl_cfg))
