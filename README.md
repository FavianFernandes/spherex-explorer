<div align="center">

# 🌌 SPHEREx Explorer

### *Explore the infrared sky. Discover what moves.*

**An interactive moving-object discovery platform built on NASA's SPHEREx all-sky infrared survey — NASA Space Apps Challenge 2026 · "Planet X and SPHEREx"**

[![Challenge](https://img.shields.io/badge/NASA%20Space%20Apps-2026-0b3d91)](https://www.spaceappschallenge.org/)
[![Python](https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.11x-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18%2F19-61DAFB?logo=react)](https://react.dev/)
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
| 🔭 **Blink Comparator & Time-Lapse** | Time-lapse playback of every SPHEREx epoch covering your sky patch, cadence animation, and GIF export |
| 🌈 **102-Band Spectra On the Fly** | Full 0.75–5.0 µm spectra (individual, multi-epoch comparison, and difference spectrum ΔF(λ)) |
| ➕➖ **Difference Imaging** | Epochs reprojected onto a common WCS grid; later − earlier reveals new, moved, or vanished sources |
| 📦 **Variance-Weighted Stacking** | Co-addition of compatible exposures improving signal-to-noise ratio (SNR) with noise RMS metrics |
| 🎯 **Object Isolation & Tracking** | Background-erased cutouts of moving sources across epochs, with angular displacement and proper-motion rate |
| 🗺️ **Multi-Mission Overlays** | ESA **Gaia DR3** sources (epoch-propagated), NASA **AllWISE** infrared history, and CSA **NEOSSat** (CADC) |
| 🔗 **Shareable Discoveries** | Every investigation state is URL-encoded (`/d/:share_id`) — restore exact coordinates, FOV, frames, and overlays |

### 🎯 The five NASA test targets, verified end-to-end

| Target | Class | What it proves |
| --- | --- | --- |
| **WISE 0855** | Y dwarf | Flagship proper-motion blink (fastest brown dwarf known) |
| **Barnard's Star** | High-PM star | Highest proper motion in the sky — Gaia cross-match validation |
| **Epsilon Indi B** | Brown-dwarf binary | Faint-source detection & spectral extraction |
| **RW Aurigae** | Variable star | Epoch-to-epoch spectral variability (ΔF) |
| **R Draconis** | Mira variable | Long-baseline flux change in difference mode |

---

## 🏗️ Repository Architecture

```
spherex-explorer/
├── backend/                   # FastAPI Scientific Processing Engine
│   ├── app/
│   │   ├── main.py            # API routes (search, spectra, timelapse, overlays, share)
│   │   ├── spherex_connector.py # NASA/IPAC IRSA archive connector, WCS, FITS handling
│   │   └── science_engine.py  # Astrometry, aperture photometry, stacking, difference imaging
│   ├── frontend_fixtures/     # Scientific calibration benchmarks for predefined targets
│   ├── test_backend_e2e.py    # Complete backend integration test suite
│   └── requirements.txt       # Python dependencies (Astropy, Astroquery, Photutils, Reproject)
│
├── frontend/                  # React + TypeScript + Vite Observatory Dashboard
│   ├── src/
│   │   ├── features/search/   # 3-column observation workspace, viewers, spectra, timelapse
│   │   ├── api/               # React Query hooks and OpenAPI client
│   │   └── components/        # Layout, navigation, UI primitives
│   └── package.json           # Frontend dependencies (Plotly, Tailwind CSS v4, Lucide icons)
│
└── openapi.json               # Full OpenAPI 3.1 schema specification
```

---

## 🚀 Quickstart Guide

### 1. Backend Setup (FastAPI)

```bash
cd backend
python -m venv .venv

# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Interactive docs at **http://localhost:8000/docs** · OpenAPI schema at `/openapi.json`

### 2. Frontend Setup (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

Frontend application will be accessible at **http://localhost:5173**.

### 3. Run Automated Tests

- **Backend Integration Tests**:
  ```bash
  cd backend
  python test_backend_e2e.py
  ```

- **Frontend Unit Tests**:
  ```bash
  cd frontend
  npm test
  ```

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
