[README (3) (1).md](https://github.com/user-attachments/files/34881321/README.3.1.md)
<div align="center">

# 🌌 SPHEREx Explorer

### *Explore the infrared sky. Discover what moves.*

**An interactive moving-object discovery platform built on NASA's SPHEREx all-sky infrared survey — NASA Space Apps Challenge 2026 · "Planet X and SPHEREx"**

[![Challenge](https://img.shields.io/badge/NASA%20Space%20Apps-2026-0b3d91)](https://www.spaceappschallenge.org/)
[![Python](https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.11x-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://www.typescriptlang.org/)

</div>

---

## 🛰️ What is SPHEREx Explorer?

Since 2025, NASA's **SPHEREx** mission has mapped the entire sky every six months in **102 near-infrared bands** (0.75–5.0 µm), imaging over a billion objects. Anything that *moves* — comets, asteroids, brown dwarfs, even hypothetical Planet X candidates — betrays itself by shifting position between epochs.

**SPHEREx Explorer** turns that archive into a public discovery instrument: enter any sky coordinate, watch a time-lapse *blink* of real SPHEREx epochs, extract a 102-band spectrum on the fly, subtract epochs to reveal motion, and isolate a moving object from its background — all through a clean, web-based observatory interface.

> This is how Pluto was found. This is how citizen scientists found thousands of brown dwarfs. Now it's SPHEREx's turn.

---

## ✨ Features

| Capability | What it does |
| --- | --- |
| 🔭 **Blink Comparator** | Time-lapse playback of every SPHEREx epoch covering your sky patch, grouped by ~6-month survey periods — moving objects literally pop out |
| 🌈 **102-Band Spectra On the Fly** | Sub-pixel centroiding + forced photometry across all 6 detector arrays → a full 0.75–5.0 µm spectrum, comparable across epochs (ΔF(λ) included) |
| ➕➖ **Difference Imaging** | Epochs reprojected onto a common WCS grid; later − earlier reveals new, moved, or vanished sources |
| 🎯 **Object Isolation & Tracking** | Background-erased cutouts of moving sources across epochs, with angular displacement and proper-motion rate (arcsec/yr) |
| 🗺️ **Multi-Mission Overlays** | ESA **Gaia DR3** sources *propagated to the SPHEREx observation epoch* via proper motion, NASA **AllWISE** infrared history, and CSA **NEOSSat** (CADC) — four space telescopes, one view |
| 🔗 **Shareable Discoveries** | Every investigation state is URL-encoded — send a link, and anyone sees the exact same sky, epochs, and analysis |

### 🎯 The five NASA test targets, verified end-to-end

| Target | Class | What it proves |
| --- | --- | --- |
| **WISE 0855** | Y dwarf | Flagship proper-motion blink (fastest brown dwarf known) |
| **Barnard's Star** | High-PM star | Highest proper motion in the sky — Gaia cross-match validation |
| **Epsilon Indi B** | Brown-dwarf binary | Faint-source detection & spectral extraction |
| **RW Aurigae** | Variable star | Epoch-to-epoch spectral variability (ΔF) |
| **R Draconis** | Mira variable | Long-baseline flux change in difference mode |

---

## 🏗️ Architecture

```javascript
┌───────────────────────────────────────────────────────────────┐
│   React 19 + TypeScript + Vite frontend  (shadcn/ui, Plotly)  │
│   Search · SkyViewer · Spectra · Difference · Track · Share   │
└──────────────┬────────────────────────────────────────────────┘
               │  REST/JSON — single OpenAPI contract
┌──────────────▼───────────────────────────────────────────────┐
│              FastAPI backend (async, cached, retrying)       │
│  search │ identify │ spectra │ difference │ stack │ isolate  │
│  overlays (Gaia / AllWISE / NEOSSat)                         │
└──┬──────────┬───────────────┬───────────────┬────────────────┘
   │ SIA2/TAP │ TAP+          │ SIA2          │ CADC VO
┌──▼──────────▼───────────────▼───────────────▼───────────────────┐
│ IRSA SPHEREx DR1+QR3   ESA Gaia DR3   NASA AllWISE  CSA NEOSSat │
│ (weekly-updated)       (epoch-         (WISE       (FITS via    │
│                        propagated)     history)    CADC)        │
└─────────────────────────────────────────────────────────────────┘
```

**Engineering principles:**

- **Server-side cutouts only** — raw 70 MB Multi-Extension FITS files never reach the browser; the backend cuts, calibrates, and renders
- **Zero hardcoded epochs** — collection-driven queries absorb SPHEREx's *weekly* data releases automatically
- **One contract** — Pydantic models ⇄ TypeScript interfaces generated from a single `openapi.json`
- **Every external call** has timeouts, exponential-backoff retries, and disk caching

---

## 🚀 Quickstart

### Backend (Python 3.11+)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

Interactive docs at **http://localhost:8000/docs** · OpenAPI schema at `/openapi.json`

### Frontend (Node 20+)

```bash
npm install
npm run dev                      # http://localhost:5173
```

Set `VITE_API_BASE_URL=http://localhost:8000` (see `.env.example`). A built-in **MSW mock layer** lets the UI run fully offline until the backend is up.

---

## 🔌 API Overview (v1.2.0)

| Endpoint | Description |
| --- | --- |
| `POST /api/search` | Query IRSA for SPHEREx epochs covering (RA, Dec), grouped for the timeline |
| `GET /api/preview` | Download + render a pixel-accurate PNG cutout (z-scale, colormap-aware) |
| `POST /api/objects/identify` | Mouse click → sub-pixel centroid → celestial RA/Dec + flux + S/N + exact LVF wavelength |
| `POST /api/spectra/compare` | 102-band spectra across two epochs → Graph A (comparison) + Graph B (ΔF) |
| `POST /api/images/difference` | WCS-aligned epoch subtraction (later − earlier) |
| `POST /api/images/stack` | Inverse-variance weighted stacking for faint-source S/N |
| `POST /api/objects/isolate` | Background-erased moving-source cutouts + displacement + proper motion |
| `POST /api/overlays` | Gaia DR3 (epoch-propagated) · AllWISE · NEOSSat, projected to image pixels |
| `GET /api/targets` · `GET /api/health` | Preset targets · health check |

Coordinates accepted in **decimal degrees or sexagesimal** (`08h55m10.831s`, `-07d14m42.53s`).

---

## 🌐 Data Sources & Citations

| Archive | Role |
| --- | --- |
| [NASA/IPAC IRSA — SPHEREx DR1 & QR3](https://irsa.ipac.caltech.edu/Missions/spherex.html) | Primary science data (weekly releases) |
| [ESA Gaia DR3](https://gea.esac.esa.int/archive) | Astrometry, parallax, proper motion |
| [NASA AllWISE / unWISE](https://irsa.ipac.caltech.edu/data/WISE/) | Historical mid-infrared context |
| [CSA NEOSSat via CADC](https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/neossat/) | Canada's asteroid-surveillance satellite (challenge partner agency) |

> **Acknowledgement.** *This publication makes use of data products from the Spectro-Photometer for the History of the Universe, Epoch of Reionization and Ices Explorer (SPHEREx), which is a joint project of the Jet Propulsion Laboratory and the California Institute of Technology, and is funded by the National Aeronautics and Space Administration.*
> DOIs: `10.26131/IRSA678` (DR1 images) · `10.26131/IRSA679` (All-Sky Cube) · `10.26131/IRSA662` (QR3)

---

## 👥 Team

Built for the **NASA Space Apps Challenge 2026** — *Planet X and SPHEREx* (partner agency: Canadian Space Agency).



---

<div align="center">

*If it moves between the epochs, it isn't a star. Go find it.* 🔭

</div>
