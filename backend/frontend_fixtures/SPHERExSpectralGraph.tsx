// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from "react";

const LINE_COLORS = ["#38bdf8", "#f59e0b", "#10b981", "#a855f7", "#ec4899"];

function usePlotlyLoaded(): boolean {
  const [ready, setReady] = useState<boolean>(() => Boolean((window as any).Plotly));
  useEffect(() => {
    if ((window as any).Plotly) {
      setReady(true);
      return;
    }
    const existing = document.getElementById("plotly-cdn-script") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => setReady(true));
      return;
    }
    const script = document.createElement("script");
    script.id = "plotly-cdn-script";
    script.src = "https://cdn.plot.ly/plotly-2.35.2.min.js";
    script.async = true;
    script.onload = () => setReady(true);
    document.head.appendChild(script);
  }, []);
  return ready;
}

function getEpochXY(ep: any) {
  if (!ep) return { x: [], y: [] };
  const x: number[] = [];
  const y: (number | null)[] = [];
  if (ep.channels_102 && ep.channels_102.length === 102) {
    for (const ch of ep.channels_102) {
      x.push(ch.wavelength_um);
      y.push(ch.measured && ch.flux !== null ? ch.flux : null);
    }
  } else if (ep.raw_points && ep.raw_points.length > 0) {
    for (const pt of ep.raw_points) {
      x.push(pt.wavelength_um);
      y.push(pt.flux);
    }
  }
  return { x, y };
}

export const SPHERExSpectralGraph = ({
  ra,
  dec,
  targetName,
  apiBaseUrl = import.meta.env?.VITE_API_BASE_URL || "http://127.0.0.1:8000",
}: any) => {
  const plotlyReady = usePlotlyLoaded();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedSingleEpoch, setSelectedSingleEpoch] = useState<string>("");
  const [comparedEpochs, setComparedEpochs] = useState<string[]>([]);
  const [hiddenEpochs, setHiddenEpochs] = useState<Record<string, boolean>>({});
  const [diffEarlyEpoch, setDiffEarlyEpoch] = useState<string>("");
  const [diffLateEpoch, setDiffLateEpoch] = useState<string>("");
  const [epochToAdd, setEpochToAdd] = useState<string>("");

  const singleChartRef = useRef<HTMLDivElement | null>(null);
  const compareChartRef = useRef<HTMLDivElement | null>(null);
  const diffChartRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (ra === undefined || dec === undefined || ra === "" || dec === "") return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`${apiBaseUrl.replace(/\/$/, "")}/api/spectra/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({ ra, dec, max_exposures_per_epoch: 24 }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((payload) => {
        setData(payload);
        const epochs = payload.available_epochs || [];
        setSelectedSingleEpoch(epochs[0] || "");
        setComparedEpochs(epochs);
        setHiddenEpochs({});
        setDiffEarlyEpoch(epochs[0] || "");
        setDiffLateEpoch(epochs[epochs.length - 1] || epochs[0] || "");
        setEpochToAdd(epochs[0] || "");
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [ra, dec, apiBaseUrl]);

  const epochMap = useMemo(() => {
    const map: Record<string, any> = {};
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

  useEffect(() => {
    const Plotly = (window as any).Plotly;
    if (!plotlyReady || !Plotly || !singleChartRef.current || !data) return;
    const ep = epochMap[selectedSingleEpoch] || data.epoch_spectra?.[0];
    if (!ep) return;
    const { x, y } = getEpochXY(ep);
    Plotly.react(
      singleChartRef.current,
      [{
        x, y, type: "scatter", mode: "lines+markers", connectgaps: true,
        name: `${ep.epoch_id} (${ep.observation_date})`,
        line: { color: "#38bdf8", width: 2 }, marker: { size: 6, color: "#38bdf8" },
        hovertemplate: `<b>${ep.epoch_id} (${ep.observation_date})</b><br>?: %{x:.4f} ?m<br>Flux: %{y:.4f} ${data.flux_unit}<extra></extra>`,
      }],
      {
        title: { text: `1. Single Observation Spectrum ? ${ep.epoch_id} (${ep.observation_date})`, font: { color: "#f8fafc", size: 14 } },
        paper_bgcolor: "#0f172a", plot_bgcolor: "#0f172a", margin: { t: 40, r: 24, b: 45, l: 60 },
        xaxis: { title: "Wavelength (?m)", color: "#cbd5e1", gridcolor: "#1e293b", range: [0.7, 5.05] },
        yaxis: { title: `Flux (${data.flux_unit})`, color: "#cbd5e1", gridcolor: "#1e293b" },
        legend: { font: { color: "#e2e8f0" } },
      },
      { responsive: true, displaylogo: false }
    );
  }, [plotlyReady, data, epochMap, selectedSingleEpoch]);

  useEffect(() => {
    const Plotly = (window as any).Plotly;
    if (!plotlyReady || !Plotly || !compareChartRef.current || !data) return;
    const traces = comparedEpochs
      .filter((eid) => !hiddenEpochs[eid] && epochMap[eid])
      .map((eid, idx) => {
        const ep = epochMap[eid];
        const { x, y } = getEpochXY(ep);
        const color = LINE_COLORS[idx % LINE_COLORS.length];
        return {
          x, y, type: "scatter", mode: "lines+markers", connectgaps: true,
          name: `${ep.epoch_id} (${ep.observation_date})`,
          line: { color, width: 2 }, marker: { size: 5, color },
          hovertemplate: `<b>${ep.epoch_id} (${ep.observation_date})</b><br>?: %{x:.4f} ?m<br>Flux: %{y:.4f} ${data.flux_unit}<extra></extra>`,
        };
      });
    Plotly.react(
      compareChartRef.current,
      traces,
      {
        title: { text: "2. Multi-Observation Spectral Comparison", font: { color: "#f8fafc", size: 14 } },
        paper_bgcolor: "#0f172a", plot_bgcolor: "#0f172a", margin: { t: 40, r: 24, b: 45, l: 60 },
        xaxis: { title: "Wavelength (?m)", color: "#cbd5e1", gridcolor: "#1e293b", range: [0.7, 5.05] },
        yaxis: { title: `Flux (${data.flux_unit})`, color: "#cbd5e1", gridcolor: "#1e293b" },
        legend: { font: { color: "#e2e8f0" } },
      },
      { responsive: true, displaylogo: false }
    );
  }, [plotlyReady, data, epochMap, comparedEpochs, hiddenEpochs]);

  useEffect(() => {
    const Plotly = (window as any).Plotly;
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
      [{
        x: diffX, y: diffY, type: "scatter", mode: "lines+markers", connectgaps: true,
        name: `${lateEp.epoch_id} ? ${earlyEp.epoch_id}`,
        line: { color: "#10b981", width: 2 }, marker: { size: 6, color: "#10b981" },
        hovertemplate: `<b>${lateEp.epoch_id} ? ${earlyEp.epoch_id}</b><br>?: %{x:.4f} ?m<br>? Flux: %{y:+.4f} ${data.flux_unit}<extra></extra>`,
      }],
      {
        title: { text: `3. Difference Spectrum (${lateEp.epoch_id} ? ${earlyEp.epoch_id})`, font: { color: "#f8fafc", size: 14 } },
        paper_bgcolor: "#0f172a", plot_bgcolor: "#0f172a", margin: { t: 40, r: 24, b: 45, l: 60 },
        xaxis: { title: "Wavelength (?m)", color: "#cbd5e1", gridcolor: "#1e293b", range: [0.7, 5.05] },
        yaxis: { title: `Difference in Flux (${data.flux_unit})`, color: "#cbd5e1", gridcolor: "#1e293b", zeroline: true, zerolinecolor: "#64748b" },
        legend: { font: { color: "#e2e8f0" } },
      },
      { responsive: true, displaylogo: false }
    );
  }, [plotlyReady, data, epochMap, diffEarlyEpoch, diffLateEpoch]);

  return (
    <div style={{ background: "#0b1020", border: "1px solid #1e293b", borderRadius: 10, padding: 16, color: "#e2e8f0", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#38bdf8" }}>
          SPHEREx 102-Band Spectral Graphs ? {targetName || `${ra}, ${dec}`}
        </div>
        <button onClick={handleReset} style={{ background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", borderRadius: 6, padding: "5px 12px", cursor: "pointer" }}>
          Reset Graph
        </button>
      </div>
      {loading && <div style={{ padding: 20, color: "#38bdf8" }}>Loading SPHEREx 102-band spectra...</div>}
      {error && <div style={{ padding: 12, color: "#fca5a5" }}>{error}</div>}
      {data && !loading && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", background: "#0f172a", padding: 10, borderRadius: 8 }}>
            <label style={{ fontSize: 12 }}>
              Single Date:{" "}
              <select value={selectedSingleEpoch} onChange={(e) => setSelectedSingleEpoch(e.target.value)} style={{ background: "#1e293b", color: "#fff", padding: 4, borderRadius: 4 }}>
                {data.epoch_spectra.map((ep: any) => <option key={ep.epoch_id} value={ep.epoch_id}>{ep.epoch_id} ({ep.observation_date})</option>)}
              </select>
            </label>
            <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
              <span>Compare:</span>
              {comparedEpochs.map((eid) => (
                <span key={eid} style={{ background: "#1e293b", padding: "2px 6px", borderRadius: 4, display: "inline-flex", gap: 4, alignItems: "center" }}>
                  <input type="checkbox" checked={!hiddenEpochs[eid]} onChange={() => setHiddenEpochs((p) => ({ ...p, [eid]: !p[eid] }))} />
                  {eid}
                  <button onClick={() => setComparedEpochs((p) => p.filter((x) => x !== eid))} style={{ background: "none", border: "none", color: "#fca5a5", cursor: "pointer" }}>&times;</button>
                </span>
              ))}
              <select value={epochToAdd} onChange={(e) => setEpochToAdd(e.target.value)} style={{ background: "#1e293b", color: "#fff", padding: 4, borderRadius: 4 }}>
                {data.epoch_spectra.map((ep: any) => <option key={ep.epoch_id} value={ep.epoch_id}>{ep.epoch_id}</option>)}
              </select>
              <button onClick={() => !comparedEpochs.includes(epochToAdd) && setComparedEpochs((p) => [...p, epochToAdd])} style={{ background: "#0284c7", color: "#fff", border: "none", borderRadius: 4, padding: "4px 8px", cursor: "pointer" }}>+ Add</button>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
              <span>Diff:</span>
              <select value={diffLateEpoch} onChange={(e) => setDiffLateEpoch(e.target.value)} style={{ background: "#1e293b", color: "#fff", padding: 4, borderRadius: 4 }}>
                {data.epoch_spectra.map((ep: any) => <option key={ep.epoch_id} value={ep.epoch_id}>{ep.epoch_id}</option>)}
              </select>
              <span>&minus;</span>
              <select value={diffEarlyEpoch} onChange={(e) => setDiffEarlyEpoch(e.target.value)} style={{ background: "#1e293b", color: "#fff", padding: 4, borderRadius: 4 }}>
                {data.epoch_spectra.map((ep: any) => <option key={ep.epoch_id} value={ep.epoch_id}>{ep.epoch_id}</option>)}
              </select>
            </div>
          </div>
          <div ref={singleChartRef} style={{ width: "100%", height: 280 }} />
          <div ref={compareChartRef} style={{ width: "100%", height: 280 }} />
          <div ref={diffChartRef} style={{ width: "100%", height: 260 }} />
        </>
      )}
    </div>
  );
};

export default SPHERExSpectralGraph;
