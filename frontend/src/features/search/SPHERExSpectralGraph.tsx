import React, { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE_URL } from "@/api/baseUrl";
import type { components } from "@/api/schema";

type SpectrumCompareResponse = components["schemas"]["SpectrumCompareResponse"];
type EpochSpectrumBundle = components["schemas"]["EpochSpectrumBundle"];

interface PlotlyLike {
  react: (
    root: HTMLElement,
    data: Array<Record<string, unknown>>,
    layout: Record<string, unknown>,
    config?: Record<string, unknown>,
  ) => void;
}

type WindowWithPlotly = Window & { Plotly?: PlotlyLike };

export interface SPHERExSpectralGraphProps {
  ra: number | string;
  dec: number | string;
  targetName?: string;
  apiBaseUrl?: string;
}

const LINE_COLORS = ["#38bdf8", "#f59e0b", "#10b981", "#a855f7", "#ec4899", "#06b6d4"];

const DETECTOR_BANDS = [
  { name: "D1", min: 0.75, max: 1.11, color: "#38bdf8" },
  { name: "D2", min: 1.11, max: 1.64, color: "#818cf8" },
  { name: "D3", min: 1.64, max: 2.42, color: "#a855f7" },
  { name: "D4", min: 2.42, max: 3.82, color: "#ec4899" },
  { name: "D5", min: 3.82, max: 4.42, color: "#f97316" },
  { name: "D6", min: 4.42, max: 5.00, color: "#eab308" },
];

function usePlotlyLoaded(): boolean {
  const [ready, setReady] = useState<boolean>(() =>
    Boolean((window as WindowWithPlotly).Plotly),
  );
  useEffect(() => {
    if ((window as WindowWithPlotly).Plotly) {
      return;
    }
    const existing = document.getElementById("plotly-cdn-script") as HTMLScriptElement | null;
    if (existing) {
      const onLoad = () => setReady(true);
      existing.addEventListener("load", onLoad);
      return () => existing.removeEventListener("load", onLoad);
    }
    const script = document.createElement("script");
    script.id = "plotly-cdn-script";
    script.src = "https://cdn.plot.ly/plotly-2.35.2.min.js";
    script.async = true;
    script.onload = () => setReady(true);
    script.onerror = () => {
      // Fallback: Plotly CDN could not be loaded, SVG renderer will remain active
      console.warn("Plotly CDN could not be reached; utilizing native SVG spectrophotometric chart renderer.");
    };
    document.head.appendChild(script);
  }, []);
  return ready;
}

function getEpochXY(ep?: EpochSpectrumBundle | null) {
  if (!ep) return { x: [] as number[], y: [] as (number | null)[] };
  const x: number[] = [];
  const y: (number | null)[] = [];
  if (ep.channels_102 && ep.channels_102.length === 102) {
    for (const ch of ep.channels_102) {
      x.push(Number(ch.wavelength_um));
      y.push(ch.measured && ch.flux !== null && ch.flux !== undefined ? Number(ch.flux) : null);
    }
  } else if (ep.raw_points && ep.raw_points.length > 0) {
    for (const pt of ep.raw_points) {
      x.push(Number(pt.wavelength_um));
      y.push(pt.flux !== null ? Number(pt.flux) : null);
    }
  }
  return { x, y };
}

// Lightweight, responsive native SVG spectrum renderer as a fail-safe fallback
function SvgSpectrumChart({
  series,
  width = 800,
  height = 240,
  title,
  yLabel = "Flux (MJy/sr)",
  isDifference = false,
}: {
  series: Array<{ name: string; x: number[]; y: (number | null)[]; color: string }>;
  width?: number;
  height?: number;
  title?: string;
  yLabel?: string;
  isDifference?: boolean;
}) {
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; name: string } | null>(null);

  const padLeft = 60;
  const padRight = 20;
  const padTop = 32;
  const padBottom = 34;

  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const minX = 0.75;
  const maxX = 5.0;

  const allY = series.flatMap((s) => s.y.filter((v): v is number => v !== null && isFinite(v)));
  let minY = allY.length ? Math.min(...allY) : 0;
  let maxY = allY.length ? Math.max(...allY) : 1;

  if (isDifference) {
    const absMax = Math.max(Math.abs(minY), Math.abs(maxY), 0.01);
    minY = -absMax * 1.1;
    maxY = absMax * 1.1;
  } else {
    minY = Math.min(0, minY);
    maxY = maxY > minY ? maxY * 1.1 : minY + 1;
  }

  const scaleX = (x: number) => padLeft + ((x - minX) / (maxX - minX)) * plotW;
  const scaleY = (y: number) => padTop + plotH - ((y - minY) / (maxY - minY)) * plotH;

  const yZero = isDifference ? scaleY(0) : null;

  return (
    <div style={{ position: "relative", width: "100%", overflowX: "auto" }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", height: "auto", display: "block", background: "#0f172a", borderRadius: 8 }}
      >
        {/* Title */}
        {title && (
          <text x={padLeft} y={20} fill="#f8fafc" fontSize={13} fontWeight="bold">
            {title}
          </text>
        )}

        {/* Detector Band Background Labels */}
        {DETECTOR_BANDS.map((det) => {
          const x1 = scaleX(det.min);
          const x2 = scaleX(det.max);
          return (
            <g key={det.name}>
              <line x1={x1} y1={padTop} x2={x1} y2={padTop + plotH} stroke="#1e293b" strokeDasharray="3 3" />
              <text x={(x1 + x2) / 2} y={padTop + 14} fill="#64748b" fontSize={10} textAnchor="middle">
                {det.name}
              </text>
            </g>
          );
        })}

        {/* Zero Line for Difference */}
        {yZero !== null && (
          <line x1={padLeft} y1={yZero} x2={padLeft + plotW} y2={yZero} stroke="#64748b" strokeWidth={1.5} />
        )}

        {/* Axes */}
        <line x1={padLeft} y1={padTop + plotH} x2={padLeft + plotW} y2={padTop + plotH} stroke="#334155" />
        <line x1={padLeft} y1={padTop} x2={padLeft} y2={padTop + plotH} stroke="#334155" />

        {/* X Axis Ticks */}
        {[1.0, 2.0, 3.0, 4.0, 5.0].map((tick) => (
          <g key={tick} transform={`translate(${scaleX(tick)}, ${padTop + plotH})`}>
            <line y2={5} stroke="#475569" />
            <text y={18} fill="#94a3b8" fontSize={10} textAnchor="middle">
              {tick.toFixed(1)} µm
            </text>
          </g>
        ))}

        {/* Y Axis Ticks */}
        {[minY, (minY + maxY) / 2, maxY].map((val, idx) => (
          <g key={idx} transform={`translate(${padLeft}, ${scaleY(val)})`}>
            <line x2={-4} stroke="#475569" />
            <text x={-8} y={3} fill="#94a3b8" fontSize={10} textAnchor="end">
              {val.toFixed(3)}
            </text>
          </g>
        ))}

        {/* Y-Axis Label */}
        <text
          transform={`rotate(-90) translate(${-(padTop + plotH / 2)}, 14)`}
          fill="#94a3b8"
          fontSize={10}
          textAnchor="middle"
        >
          {yLabel}
        </text>

        {/* Data Series */}
        {series.map((s) => {
          const validPoints: Array<{ x: number; y: number }> = [];
          for (let i = 0; i < s.x.length; i++) {
            const vy = s.y[i];
            if (vy !== null && isFinite(vy)) {
              validPoints.push({ x: s.x[i], y: vy });
            }
          }

          if (validPoints.length === 0) return null;

          const pathD = validPoints
            .map((pt, i) => `${i === 0 ? "M" : "L"} ${scaleX(pt.x).toFixed(1)} ${scaleY(pt.y).toFixed(1)}`)
            .join(" ");

          return (
            <g key={s.name}>
              <path d={pathD} fill="none" stroke={s.color} strokeWidth={1.8} strokeOpacity={0.9} />
              {validPoints.map((pt, i) => (
                <circle
                  key={i}
                  cx={scaleX(pt.x)}
                  cy={scaleY(pt.y)}
                  r={3}
                  fill={isDifference && pt.y < 0 ? "#ef4444" : s.color}
                  stroke="#0f172a"
                  strokeWidth={0.8}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHoveredPoint({ x: pt.x, y: pt.y, name: s.name })}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
              ))}
            </g>
          );
        })}

        {/* Tooltip on SVG */}
        {hoveredPoint && (
          <g transform={`translate(${Math.min(scaleX(hoveredPoint.x) + 10, width - 180)}, ${Math.max(scaleY(hoveredPoint.y) - 30, padTop + 5)})`}>
            <rect width={170} height={38} rx={4} fill="#020617" stroke="#38bdf8" strokeWidth={1} fillOpacity={0.95} />
            <text x={8} y={15} fill="#38bdf8" fontSize={10} fontWeight="bold">
              {hoveredPoint.name}
            </text>
            <text x={8} y={29} fill="#f8fafc" fontSize={10}>
              λ: {hoveredPoint.x.toFixed(4)} µm | Flux: {hoveredPoint.y.toFixed(4)}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

export const SPHERExSpectralGraph: React.FC<SPHERExSpectralGraphProps> = ({
  ra,
  dec,
  targetName,
  apiBaseUrl = API_BASE_URL,
}) => {
  const plotlyReady = usePlotlyLoaded();
  const baseUrl = apiBaseUrl.replace(/\/$/, "");
  const hasCoords = ra !== undefined && dec !== undefined && ra !== "" && dec !== "";
  const requestKey = hasCoords ? `${ra}|${dec}|${baseUrl}` : "";

  const [fetchState, setFetchState] = useState<{
    completedKey: string;
    data: SpectrumCompareResponse | null;
    error: string | null;
  }>({ completedKey: "", data: null, error: null });

  const loading = Boolean(requestKey && fetchState.completedKey !== requestKey);
  const data = fetchState.completedKey === requestKey ? fetchState.data : null;
  const error = fetchState.completedKey === requestKey ? fetchState.error : null;

  const [selectedSingleEpoch, setSelectedSingleEpoch] = useState<string>("");
  const [comparedEpochs, setComparedEpochs] = useState<string[]>([]);
  const [hiddenEpochs, setHiddenEpochs] = useState<Record<string, boolean>>({});
  const [diffEarlyEpoch, setDiffEarlyEpoch] = useState<string>("");
  const [diffLateEpoch, setDiffLateEpoch] = useState<string>("");
  const [epochToAdd, setEpochToAdd] = useState<string>("");
  const [viewMode, setViewMode] = useState<"interactive" | "publication">("interactive");

  const singleChartRef = useRef<HTMLDivElement | null>(null);
  const compareChartRef = useRef<HTMLDivElement | null>(null);
  const diffChartRef = useRef<HTMLDivElement | null>(null);

  const resolveUrl = (url?: string | null) => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `${baseUrl}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  useEffect(() => {
    if (!requestKey) return;
    const controller = new AbortController();

    fetch(`${baseUrl}/api/spectra/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({ ra: Number(ra), dec: Number(dec), max_exposures_per_epoch: 24 }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as SpectrumCompareResponse;
      })
      .then((payload) => {
        setFetchState({ completedKey: requestKey, data: payload, error: null });
        const epochs = payload.available_epochs || [];
        setSelectedSingleEpoch(epochs[0] || "");
        setComparedEpochs(epochs);
        setHiddenEpochs({});
        setDiffEarlyEpoch(epochs[0] || "");
        setDiffLateEpoch(epochs[epochs.length - 1] || epochs[0] || "");
        setEpochToAdd(epochs[0] || "");
      })
      .catch((err: Error) => {
        if (err.name !== "AbortError") {
          setFetchState({
            completedKey: requestKey,
            data: null,
            error: err.message || "Failed to load SPHEREx spectral data.",
          });
        }
      });

    return () => controller.abort();
  }, [ra, dec, baseUrl, requestKey]);

  const epochMap = useMemo(() => {
    const map: Record<string, EpochSpectrumBundle> = {};
    for (const ep of data?.epoch_spectra || []) map[ep.epoch_id] = ep;
    return map;
  }, [data]);

  const handleReset = () => {
    if (!data) return;
    const epochs = data.available_epochs || [];
    setSelectedSingleEpoch(epochs[0] || "");
    setComparedEpochs(epochs);
    setHiddenEpochs({});
    setDiffEarlyEpoch(epochs[0] || "");
    setDiffLateEpoch(epochs[epochs.length - 1] || epochs[0] || "");
  };

  // Plotly Graph 1: Individual Spectrum
  useEffect(() => {
    const Plotly = (window as WindowWithPlotly).Plotly;
    if (!plotlyReady || !Plotly || !singleChartRef.current || !data) return;
    const ep = epochMap[selectedSingleEpoch] || data.epoch_spectra?.[0];
    if (!ep) return;
    const { x, y } = getEpochXY(ep);
    Plotly.react(
      singleChartRef.current,
      [
        {
          x,
          y,
          type: "scatter",
          mode: "lines+markers",
          connectgaps: true,
          name: `${ep.epoch_id} (${ep.observation_date ?? ""})`,
          line: { color: "#38bdf8", width: 2 },
          marker: { size: 5, color: "#38bdf8" },
          hovertemplate: `<b>${ep.epoch_id} (${ep.observation_date ?? ""})</b><br>λ: %{x:.4f} µm<br>Flux: %{y:.4f} ${data.flux_unit}<extra></extra>`,
        },
      ],
      {
        title: {
          text: `Graph 1: Individual SPHEREx Spectrum · ${ep.epoch_id} (${ep.observation_date ?? ""})`,
          font: { color: "#f8fafc", size: 13 },
        },
        paper_bgcolor: "#0f172a",
        plot_bgcolor: "#0f172a",
        margin: { t: 40, r: 24, b: 45, l: 65 },
        xaxis: { title: "Wavelength (µm)", color: "#cbd5e1", gridcolor: "#1e293b", range: [0.72, 5.05] },
        yaxis: { title: `Flux (${data.flux_unit})`, color: "#cbd5e1", gridcolor: "#1e293b" },
        legend: { font: { color: "#e2e8f0" } },
      },
      { responsive: true, displaylogo: false }
    );
  }, [plotlyReady, data, epochMap, selectedSingleEpoch]);

  // Plotly Graph 2: Multi-Epoch Spectral Comparison
  useEffect(() => {
    const Plotly = (window as WindowWithPlotly).Plotly;
    if (!plotlyReady || !Plotly || !compareChartRef.current || !data) return;
    const traces = comparedEpochs
      .filter((eid) => !hiddenEpochs[eid] && epochMap[eid])
      .map((eid, idx) => {
        const ep = epochMap[eid];
        const { x, y } = getEpochXY(ep);
        const color = LINE_COLORS[idx % LINE_COLORS.length];
        return {
          x,
          y,
          type: "scatter",
          mode: "lines+markers",
          connectgaps: true,
          name: `${ep.epoch_id} (${ep.observation_date ?? ""})`,
          line: { color, width: 2 },
          marker: { size: 4, color },
          hovertemplate: `<b>${ep.epoch_id} (${ep.observation_date ?? ""})</b><br>λ: %{x:.4f} µm<br>Flux: %{y:.4f} ${data.flux_unit}<extra></extra>`,
        };
      });
    Plotly.react(
      compareChartRef.current,
      traces,
      {
        title: {
          text: `Graph 2: Multi-Epoch Spectral Comparison (${traces.length} Epochs)`,
          font: { color: "#f8fafc", size: 13 },
        },
        paper_bgcolor: "#0f172a",
        plot_bgcolor: "#0f172a",
        margin: { t: 40, r: 24, b: 45, l: 65 },
        xaxis: { title: "Wavelength (µm)", color: "#cbd5e1", gridcolor: "#1e293b", range: [0.72, 5.05] },
        yaxis: { title: `Flux (${data.flux_unit})`, color: "#cbd5e1", gridcolor: "#1e293b" },
        legend: { font: { color: "#e2e8f0" } },
      },
      { responsive: true, displaylogo: false }
    );
  }, [plotlyReady, data, epochMap, comparedEpochs, hiddenEpochs]);

  // Plotly Graph 3: Difference Spectrum
  useEffect(() => {
    const Plotly = (window as WindowWithPlotly).Plotly;
    if (!plotlyReady || !Plotly || !diffChartRef.current || !data) return;
    const earlyEp = epochMap[diffEarlyEpoch] || data.earlier_epoch;
    const lateEp = epochMap[diffLateEpoch] || data.later_epoch;
    if (!earlyEp || !lateEp) return;
    const earlyXY = getEpochXY(earlyEp);
    const lateXY = getEpochXY(lateEp);
    const diffX: number[] = [];
    const diffY: (number | null)[] = [];
    const len = Math.min(earlyXY.x.length, lateXY.x.length);
    for (let i = 0; i < len; i++) {
      diffX.push(earlyXY.x[i]);
      const vE = earlyXY.y[i];
      const vL = lateXY.y[i];
      diffY.push(vE != null && vL != null ? Number((vL - vE).toFixed(5)) : null);
    }
    Plotly.react(
      diffChartRef.current,
      [
        {
          x: diffX,
          y: diffY,
          type: "scatter",
          mode: "lines+markers",
          connectgaps: true,
          name: `${lateEp.epoch_id} − ${earlyEp.epoch_id}`,
          line: { color: "#10b981", width: 2 },
          marker: { size: 5, color: "#10b981" },
          hovertemplate: `<b>${lateEp.epoch_id} − ${earlyEp.epoch_id}</b><br>λ: %{x:.4f} µm<br>Δ Flux: %{y:+.4f} ${data.flux_unit}<extra></extra>`,
        },
      ],
      {
        title: {
          text: `Graph 3: Difference Spectrum (${lateEp.epoch_id} minus ${earlyEp.epoch_id})`,
          font: { color: "#f8fafc", size: 13 },
        },
        paper_bgcolor: "#0f172a",
        plot_bgcolor: "#0f172a",
        margin: { t: 40, r: 24, b: 45, l: 65 },
        xaxis: { title: "Wavelength (µm)", color: "#cbd5e1", gridcolor: "#1e293b", range: [0.72, 5.05] },
        yaxis: {
          title: `Δ Flux (${data.flux_unit})`,
          color: "#cbd5e1",
          gridcolor: "#1e293b",
          zeroline: true,
          zerolinecolor: "#64748b",
        },
        legend: { font: { color: "#e2e8f0" } },
      },
      { responsive: true, displaylogo: false }
    );
  }, [plotlyReady, data, epochMap, diffEarlyEpoch, diffLateEpoch]);

  // Compute series for SVG fallback
  const singleEp = epochMap[selectedSingleEpoch] || data?.epoch_spectra?.[0];
  const singleXY = useMemo(() => getEpochXY(singleEp), [singleEp]);

  const compareSeries = useMemo(() => {
    return comparedEpochs
      .filter((eid) => !hiddenEpochs[eid] && epochMap[eid])
      .map((eid, idx) => {
        const ep = epochMap[eid];
        const { x, y } = getEpochXY(ep);
        return {
          name: `${ep.epoch_id} (${ep.observation_date})`,
          x,
          y,
          color: LINE_COLORS[idx % LINE_COLORS.length],
        };
      });
  }, [comparedEpochs, hiddenEpochs, epochMap]);

  const diffSeries = useMemo(() => {
    const earlyEp = epochMap[diffEarlyEpoch] || data?.earlier_epoch;
    const lateEp = epochMap[diffLateEpoch] || data?.later_epoch;
    if (!earlyEp || !lateEp) return [];
    const earlyXY = getEpochXY(earlyEp);
    const lateXY = getEpochXY(lateEp);
    const diffX: number[] = [];
    const diffY: (number | null)[] = [];
    const len = Math.min(earlyXY.x.length, lateXY.x.length);
    for (let i = 0; i < len; i++) {
      diffX.push(earlyXY.x[i]);
      const vE = earlyXY.y[i];
      const vL = lateXY.y[i];
      diffY.push(vE != null && vL != null ? Number((vL - vE).toFixed(5)) : null);
    }
    return [
      {
        name: `Δ Flux (${lateEp.epoch_id} − ${earlyEp.epoch_id})`,
        x: diffX,
        y: diffY,
        color: "#10b981",
      },
    ];
  }, [diffEarlyEpoch, diffLateEpoch, epochMap, data]);

  return (
    <div
      style={{
        background: "#0b1020",
        border: "1px solid #1e293b",
        borderRadius: 12,
        padding: 18,
        color: "#e2e8f0",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#38bdf8" }}>
            SPHEREx 102-Band Spectral Analysis · {targetName || `RA ${Number(ra).toFixed(4)}°, Dec ${Number(dec).toFixed(4)}°`}
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
            Contiguous spectrophotometry across all 6 LVF detector arrays (0.75 – 5.00 µm)
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ display: "inline-flex", background: "#0f172a", border: "1px solid #334155", borderRadius: 6, overflow: "hidden" }}>
            <button
              onClick={() => setViewMode("interactive")}
              style={{
                padding: "5px 12px",
                fontSize: 12,
                border: "none",
                cursor: "pointer",
                background: viewMode === "interactive" ? "#0284c7" : "transparent",
                color: viewMode === "interactive" ? "#ffffff" : "#94a3b8",
                fontWeight: viewMode === "interactive" ? 700 : 400,
              }}
            >
              Interactive Charts
            </button>
            <button
              onClick={() => setViewMode("publication")}
              style={{
                padding: "5px 12px",
                fontSize: 12,
                border: "none",
                cursor: "pointer",
                background: viewMode === "publication" ? "#0284c7" : "transparent",
                color: viewMode === "publication" ? "#ffffff" : "#94a3b8",
                fontWeight: viewMode === "publication" ? 700 : 400,
              }}
            >
              Publication Plot (PNG)
            </button>
          </div>

          <button
            onClick={handleReset}
            style={{
              background: "#1e293b",
              color: "#f8fafc",
              border: "1px solid #334155",
              borderRadius: 6,
              padding: "5px 12px",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Reset Graphs
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ padding: 24, textAlign: "center", color: "#38bdf8", background: "#0f172a", borderRadius: 8 }}>
          Extracting aperture-calibrated spectra across 102 SPHEREx channels…
        </div>
      )}

      {error && !loading && (
        <div style={{ padding: 14, color: "#fca5a5", background: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444", borderRadius: 8, fontSize: 13 }}>
          <strong>Spectroscopy Notice:</strong> {error}
        </div>
      )}

      {data && !loading && (
        <>
          {/* Controls Bar */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 14,
              alignItems: "center",
              background: "#0f172a",
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #1e293b",
            }}
          >
            <label style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ color: "#94a3b8" }}>Single Epoch:</span>
              <select
                value={selectedSingleEpoch}
                onChange={(e) => setSelectedSingleEpoch(e.target.value)}
                style={{ background: "#1e293b", color: "#fff", border: "1px solid #334155", padding: "4px 8px", borderRadius: 4, fontSize: 12 }}
              >
                {data.epoch_spectra.map((ep) => (
                  <option key={ep.epoch_id} value={ep.epoch_id}>
                    {ep.epoch_id} ({ep.observation_date ?? ""})
                  </option>
                ))}
              </select>
            </label>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", fontSize: 12 }}>
              <span style={{ color: "#94a3b8" }}>Compare Epochs:</span>
              {comparedEpochs.map((eid) => (
                <span
                  key={eid}
                  style={{
                    background: "#1e293b",
                    border: "1px solid #334155",
                    padding: "2px 8px",
                    borderRadius: 4,
                    display: "inline-flex",
                    gap: 6,
                    alignItems: "center",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!hiddenEpochs[eid]}
                    onChange={() => setHiddenEpochs((p) => ({ ...p, [eid]: !p[eid] }))}
                  />
                  <span>{eid}</span>
                  <button
                    onClick={() => setComparedEpochs((p) => p.filter((x) => x !== eid))}
                    style={{ background: "none", border: "none", color: "#fca5a5", cursor: "pointer", fontWeight: "bold" }}
                  >
                    &times;
                  </button>
                </span>
              ))}

              <select
                value={epochToAdd}
                onChange={(e) => setEpochToAdd(e.target.value)}
                style={{ background: "#1e293b", color: "#fff", border: "1px solid #334155", padding: "4px 8px", borderRadius: 4, fontSize: 12 }}
              >
                {data.epoch_spectra.map((ep) => (
                  <option key={ep.epoch_id} value={ep.epoch_id}>
                    {ep.epoch_id}
                  </option>
                ))}
              </select>
              <button
                onClick={() => !comparedEpochs.includes(epochToAdd) && setComparedEpochs((p) => [...p, epochToAdd])}
                style={{ background: "#0284c7", color: "#fff", border: "none", borderRadius: 4, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}
              >
                + Add Epoch
              </button>
            </div>

            <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
              <span style={{ color: "#94a3b8" }}>Difference Pair:</span>
              <select
                value={diffLateEpoch}
                onChange={(e) => setDiffLateEpoch(e.target.value)}
                style={{ background: "#1e293b", color: "#fff", border: "1px solid #334155", padding: "4px 8px", borderRadius: 4, fontSize: 12 }}
              >
                {data.epoch_spectra.map((ep) => (
                  <option key={ep.epoch_id} value={ep.epoch_id}>
                    Later: {ep.epoch_id}
                  </option>
                ))}
              </select>
              <span style={{ color: "#94a3b8" }}>minus</span>
              <select
                value={diffEarlyEpoch}
                onChange={(e) => setDiffEarlyEpoch(e.target.value)}
                style={{ background: "#1e293b", color: "#fff", border: "1px solid #334155", padding: "4px 8px", borderRadius: 4, fontSize: 12 }}
              >
                {data.epoch_spectra.map((ep) => (
                  <option key={ep.epoch_id} value={ep.epoch_id}>
                    Earlier: {ep.epoch_id}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {viewMode === "publication" ? (
            <div style={{ textAlign: "center", background: "#0f172a", padding: 16, borderRadius: 8, border: "1px solid #1e293b" }}>
              <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>
                High-Resolution Publication Spectrum Generated via SPHEREx Science Pipeline:
              </p>
              <img
                src={resolveUrl(data.spectrum_png_url)}
                alt="NASA SPHEREx 102-Band Multi-Epoch Spectrum"
                style={{ maxWidth: "100%", maxHeight: 540, objectFit: "contain", borderRadius: 6, margin: "0 auto" }}
              />
              <div style={{ marginTop: 12 }}>
                <a
                  href={resolveUrl(data.spectrum_png_url)}
                  download={`SPHEREx_Spectrum_RA${Number(ra).toFixed(4)}_DEC${Number(dec).toFixed(4)}.png`}
                  style={{
                    background: "#0284c7",
                    color: "#fff",
                    textDecoration: "none",
                    padding: "6px 14px",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  Download Publication Image (PNG)
                </a>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Graph 1: Individual Spectrum */}
              <div style={{ background: "#0f172a", borderRadius: 8, border: "1px solid #1e293b", padding: 10 }}>
                {plotlyReady ? (
                  <div ref={singleChartRef} style={{ width: "100%", height: 280 }} />
                ) : (
                  <SvgSpectrumChart
                    series={[
                      {
                        name: `${singleEp?.epoch_id || "Selected"} (${singleEp?.observation_date || ""})`,
                        x: singleXY.x,
                        y: singleXY.y,
                        color: "#38bdf8",
                      },
                    ]}
                    title={`Graph 1: Individual Spectrum · ${singleEp?.epoch_id || "Epoch"} (${singleEp?.observation_date || ""})`}
                    yLabel={`Flux (${data.flux_unit})`}
                  />
                )}
              </div>

              {/* Graph 2: Multi-Epoch Comparison */}
              <div style={{ background: "#0f172a", borderRadius: 8, border: "1px solid #1e293b", padding: 10 }}>
                {plotlyReady ? (
                  <div ref={compareChartRef} style={{ width: "100%", height: 280 }} />
                ) : (
                  <SvgSpectrumChart
                    series={compareSeries}
                    title={`Graph 2: Multi-Epoch Spectral Comparison (${compareSeries.length} Epochs)`}
                    yLabel={`Flux (${data.flux_unit})`}
                  />
                )}
              </div>

              {/* Graph 3: Difference Spectrum */}
              <div style={{ background: "#0f172a", borderRadius: 8, border: "1px solid #1e293b", padding: 10 }}>
                {plotlyReady ? (
                  <div ref={diffChartRef} style={{ width: "100%", height: 260 }} />
                ) : (
                  <SvgSpectrumChart
                    series={diffSeries}
                    title={`Graph 3: Difference Spectrum (${diffLateEpoch} minus ${diffEarlyEpoch})`}
                    yLabel={`Δ Flux (${data.flux_unit})`}
                    isDifference={true}
                  />
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SPHERExSpectralGraph;
