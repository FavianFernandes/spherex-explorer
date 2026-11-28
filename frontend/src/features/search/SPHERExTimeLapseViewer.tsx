import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE_URL } from "@/api/baseUrl";

export interface PixelPoint {
  x: number;
  y: number;
}

export interface TimeLapseFrameMetadata {
  frame_index: number;
  obs_id: string;
  epoch_id: string;
  detector: string;
  date_iso: string;
  mjd: number;
  wavelength_um: number;
  bandwidth_um: number;
  usable_pixel_fraction: number;
  background_mjy_sr: number;
  noise_std_mjy_sr: number;
  object_ra_deg: number;
  object_dec_deg: number;
  flux_mjy_sr: number | null;
  flux_ujy: number | null;
  snr: number | null;
  quality_flag: number;
  flag_labels: string[];
  target_px: PixelPoint;
  cutout_fits_url: string;
  frame_png_url: string;
}

export interface TimeLapseResponse {
  query_ra_deg: number;
  query_dec_deg: number;
  fov_arcmin: number;
  detector: string;
  available_detectors: string[];
  alignment_mode: "fixed_sky" | "follow_object";
  sampling_mode: "epoch_best" | "all_compatible";
  isolate_moving_object: boolean;
  can_animate: boolean;
  total_frames: number;
  epochs_covered: string[];
  ordered_dates: string[];
  shape_ny_nx: [number, number];
  pixel_scale_arcsec: number;
  orientation: { north: string; east: string; origin: string };
  flux_unit: string;
  display_scale: {
    vmin: number;
    vmax: number;
    stretch: string;
    colormap: string;
  };
  angular_displacement_arcsec: number;
  time_baseline_days: number;
  frame_duration_ms: number;
  gif_url: string;
  gif_download_url: string;
  download_filename: string;
  scientific_warning: string | null;
  frames: TimeLapseFrameMetadata[];
}

export interface SPHERExTimeLapseViewerProps {
  ra: number | string;
  dec: number | string;
  fovArcmin?: number;
  initialDetector?: string;
  targetName?: string;
  apiBaseUrl?: string;
  onFrameSelect?: (frame: TimeLapseFrameMetadata) => void;
}

const SPEED_OPTIONS = [0.5, 1, 2, 4] as const;

export const SPHERExTimeLapseViewer: React.FC<SPHERExTimeLapseViewerProps> = ({
  ra,
  dec,
  fovArcmin = 15.0,
  initialDetector = "auto",
  targetName,
  apiBaseUrl = API_BASE_URL,
  onFrameSelect,
}) => {
  const baseUrl = apiBaseUrl.replace(/\/$/, "");
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [loop, setLoop] = useState<boolean>(true);
  const [detector, setDetector] = useState<string>(initialDetector);
  const [alignmentMode, setAlignmentMode] = useState<"fixed_sky" | "follow_object">("fixed_sky");
  const [samplingMode, setSamplingMode] = useState<"epoch_best" | "all_compatible">("epoch_best");
  const [isolateObject, setIsolateObject] = useState<boolean>(false);
  const [showReticle, setShowReticle] = useState<boolean>(true);

  const hasCoords = ra !== undefined && dec !== undefined && ra !== "" && dec !== "";
  const requestKey = hasCoords
    ? `${ra}|${dec}|${fovArcmin}|${detector}|${alignmentMode}|${samplingMode}|${isolateObject}|${targetName ?? ""}|${baseUrl}`
    : "";

  const [fetchState, setFetchState] = useState<{
    completedKey: string;
    data: TimeLapseResponse | null;
    preloading: boolean;
    error: string | null;
  }>({ completedKey: "", data: null, preloading: false, error: null });

  const loading = Boolean(requestKey && fetchState.completedKey !== requestKey);
  const data = fetchState.completedKey === requestKey ? fetchState.data : null;
  const preloadingImages = fetchState.completedKey === requestKey && fetchState.preloading;
  const error = fetchState.completedKey === requestKey ? fetchState.error : null;

  const timerRef = useRef<number | null>(null);
  const playbackConfigRef = useRef({ playbackSpeed, loop });
  useEffect(() => {
    playbackConfigRef.current = { playbackSpeed, loop };
  }, [playbackSpeed, loop]);

  const resolveUrl = useCallback(
    (relativePath: string): string => {
      if (!relativePath) return "";
      if (relativePath.startsWith("http://") || relativePath.startsWith("https://")) {
        return relativePath;
      }
      return `${baseUrl}${relativePath.startsWith("/") ? "" : "/"}${relativePath}`;
    },
    [baseUrl],
  );

  useEffect(() => {
    if (!requestKey) return;

    const controller = new AbortController();
    const { playbackSpeed: speed, loop: loopEnabled } = playbackConfigRef.current;

    fetch(`${baseUrl}/api/images/timelapse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        ra,
        dec,
        fov_arcmin: fovArcmin,
        detector,
        alignment_mode: alignmentMode,
        sampling_mode: samplingMode,
        isolate_moving_object: isolateObject,
        playback_speed: speed,
        loop: loopEnabled,
        target_name: targetName,
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.detail || `HTTP ${res.status}`);
        }
        return res.json() as Promise<TimeLapseResponse>;
      })
      .then(async (payload) => {
        setIsPlaying(false);
        setCurrentIndex(0);
        setFetchState({ completedKey: requestKey, data: payload, preloading: true, error: null });
        await Promise.all(
          payload.frames.map(
            (frame) =>
              new Promise<void>((resolve) => {
                const img = new Image();
                img.onload = () => resolve();
                img.onerror = () => resolve();
                img.src = resolveUrl(frame.frame_png_url);
              })
          )
        );
        if (!controller.signal.aborted) {
          setFetchState((prev) =>
            prev.completedKey === requestKey ? { ...prev, preloading: false } : prev,
          );
        }
      })
      .catch((err: Error) => {
        if (err.name !== "AbortError") {
          setIsPlaying(false);
          setFetchState({
            completedKey: requestKey,
            data: null,
            preloading: false,
            error: err.message || "Unable to generate SPHEREx time-lapse.",
          });
        }
      });

    return () => controller.abort();
  }, [ra, dec, fovArcmin, detector, alignmentMode, samplingMode, isolateObject, targetName, baseUrl, requestKey, resolveUrl]);

  useEffect(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!isPlaying || !data || data.frames.length < 2) {
      return;
    }

    const intervalMs = Math.max(120, Math.round(650 / playbackSpeed));
    timerRef.current = window.setTimeout(() => {
      if (currentIndex + 1 < data.frames.length) {
        setCurrentIndex(currentIndex + 1);
      } else if (loop) {
        setCurrentIndex(0);
      } else {
        setIsPlaying(false);
      }
    }, intervalMs);

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isPlaying, playbackSpeed, loop, data, currentIndex]);

  const currentFrame: TimeLapseFrameMetadata | null = useMemo(() => {
    if (!data || data.frames.length === 0) return null;
    return data.frames[Math.min(currentIndex, data.frames.length - 1)];
  }, [data, currentIndex]);

  useEffect(() => {
    if (currentFrame && onFrameSelect) {
      onFrameSelect(currentFrame);
    }
  }, [currentFrame, onFrameSelect]);

  const handlePrevFrame = () => {
    if (!data || data.frames.length === 0) return;
    setIsPlaying(false);
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : loop ? data.frames.length - 1 : 0));
  };

  const handleNextFrame = () => {
    if (!data || data.frames.length === 0) return;
    setIsPlaying(false);
    setCurrentIndex((prev) =>
      prev + 1 < data.frames.length ? prev + 1 : loop ? 0 : data.frames.length - 1
    );
  };

  return (
    <div
      style={{
        background: "#0b1020",
        border: "1px solid #1e293b",
        borderRadius: "10px",
        padding: "16px",
        color: "#e2e8f0",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          marginBottom: "12px",
          borderBottom: "1px solid #1e293b",
          paddingBottom: "10px",
        }}
      >
        <div>
          <div style={{ fontSize: "15px", fontWeight: 700, color: "#38bdf8" }}>
            SPHEREx Six-Month Multi-Epoch Time-Lapse
          </div>
          <div style={{ fontSize: "12px", color: "#94a3b8" }}>
            WCS-Aligned &bull; Global Asinh Flux Normalization &bull;{" "}
            {targetName || `RA ${ra} Dec ${dec}`}
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
          <label style={{ fontSize: "12px", color: "#94a3b8" }}>
            Detector:{" "}
            <select
              value={detector}
              onChange={(e) => setDetector(e.target.value)}
              style={{
                background: "#1e293b",
                color: "#f8fafc",
                border: "1px solid #334155",
                borderRadius: "6px",
                padding: "4px 8px",
                fontSize: "12px",
              }}
            >
              <option value="auto">Auto ({data?.detector || "Best"})</option>
              {(data?.available_detectors || ["D1", "D2", "D3", "D4", "D5", "D6"]).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>

          <div
            style={{
              display: "inline-flex",
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: "6px",
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              onClick={() => setAlignmentMode("fixed_sky")}
              style={{
                padding: "4px 10px",
                fontSize: "12px",
                border: "none",
                cursor: "pointer",
                background: alignmentMode === "fixed_sky" ? "#0284c7" : "transparent",
                color: alignmentMode === "fixed_sky" ? "#ffffff" : "#94a3b8",
              }}
            >
              Fixed Sky (WCS)
            </button>
            <button
              type="button"
              onClick={() => setAlignmentMode("follow_object")}
              style={{
                padding: "4px 10px",
                fontSize: "12px",
                border: "none",
                cursor: "pointer",
                background: alignmentMode === "follow_object" ? "#0284c7" : "transparent",
                color: alignmentMode === "follow_object" ? "#ffffff" : "#94a3b8",
              }}
            >
              Follow Object
            </button>
          </div>

          <select
            value={samplingMode}
            onChange={(e) =>
              setSamplingMode(e.target.value as "epoch_best" | "all_compatible")
            }
            style={{
              background: "#1e293b",
              color: "#f8fafc",
              border: "1px solid #334155",
              borderRadius: "6px",
              padding: "4px 8px",
              fontSize: "12px",
            }}
          >
            <option value="epoch_best">6-Month Epoch Representatives</option>
            <option value="all_compatible">All Compatible Exposures</option>
          </select>

          <label style={{ fontSize: "12px", color: "#cbd5e1", display: "flex", gap: "4px", alignItems: "center" }}>
            <input
              type="checkbox"
              checked={isolateObject}
              onChange={(e) => setIsolateObject(e.target.checked)}
            />
            Isolate Source
          </label>
        </div>
      </div>

      {(loading || preloadingImages) && (
        <div
          style={{
            padding: "28px",
            textAlign: "center",
            background: "#0f172a",
            borderRadius: "8px",
            color: "#38bdf8",
            fontSize: "13px",
          }}
        >
          {loading
            ? "Retrieving NASA/IPAC IRSA SPHEREx FITS cutouts & aligning WCS across 6-month epochs..."
            : "Preloading aligned frame sequence..."}
        </div>
      )}

      {error && !loading && (
        <div
          style={{
            padding: "14px",
            background: "rgba(239, 68, 68, 0.15)",
            border: "1px solid #ef4444",
            borderRadius: "8px",
            color: "#fca5a5",
            fontSize: "13px",
          }}
        >
          <strong>Time-Lapse Unavailable:</strong> {error}
        </div>
      )}

      {data?.scientific_warning && !loading && (
        <div
          style={{
            marginBottom: "10px",
            padding: "8px 12px",
            background: "rgba(245, 158, 11, 0.14)",
            border: "1px solid #f59e0b",
            borderRadius: "6px",
            color: "#fcd34d",
            fontSize: "12px",
          }}
        >
          <strong>Scientific Notice:</strong> {data.scientific_warning}
        </div>
      )}

      {data && currentFrame && !loading && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(280px, 1fr) 270px",
            gap: "14px",
            alignItems: "start",
          }}
        >
          <div>
            <div
              style={{
                position: "relative",
                width: "100%",
                aspectRatio: "16 / 9",
                background: "#050811",
                border: "1px solid #334155",
                borderRadius: "8px",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  position: "relative",
                  height: "100%",
                  aspectRatio: `${data.shape_ny_nx[1]} / ${data.shape_ny_nx[0]}`,
                }}
              >
                <img
                  src={resolveUrl(currentFrame.frame_png_url)}
                  alt={`SPHEREx ${currentFrame.obs_id}`}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    imageRendering: "pixelated",
                    display: "block",
                  }}
                />

                {showReticle && (
                  <svg
                    viewBox={`0 0 ${data.shape_ny_nx[1]} ${data.shape_ny_nx[0]}`}
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      pointerEvents: "none",
                    }}
                  >
                    <circle
                      cx={currentFrame.target_px.x}
                      cy={currentFrame.target_px.y}
                      r={4.2}
                      fill="none"
                      stroke="#00e5ff"
                      strokeWidth={0.9}
                    />
                  </svg>
                )}
              </div>

              <div
                style={{
                  position: "absolute",
                  top: "10px",
                  left: "10px",
                  background: "rgba(15, 23, 42, 0.85)",
                  padding: "5px 10px",
                  borderRadius: "6px",
                  border: "1px solid #334155",
                  fontSize: "12px",
                }}
              >
                <span style={{ color: "#38bdf8", fontWeight: 700 }}>
                  {currentFrame.epoch_id}
                </span>{" "}
                &bull; {currentFrame.date_iso.replace("T", " ").slice(0, 19)} UTC
              </div>

              <div
                style={{
                  position: "absolute",
                  top: "10px",
                  right: "10px",
                  background: "rgba(15, 23, 42, 0.85)",
                  padding: "5px 10px",
                  borderRadius: "6px",
                  border: "1px solid #334155",
                  fontSize: "12px",
                  color: "#cbd5e1",
                }}
              >
                Frame <strong>{currentIndex + 1}</strong> / {data.total_frames} &bull; N&uarr; E&larr;
              </div>
            </div>

            <div
              style={{
                marginTop: "10px",
                padding: "10px 12px",
                background: "#0f172a",
                border: "1px solid #1e293b",
                borderRadius: "8px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "11px", color: "#94a3b8", minWidth: "75px" }}>
                  {data.ordered_dates[0]?.slice(0, 10)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, data.frames.length - 1)}
                  value={currentIndex}
                  onChange={(e) => {
                    setIsPlaying(false);
                    setCurrentIndex(Number(e.target.value));
                  }}
                  style={{ flex: 1, accentColor: "#38bdf8", cursor: "pointer" }}
                />
                <span
                  style={{
                    fontSize: "11px",
                    color: "#94a3b8",
                    minWidth: "75px",
                    textAlign: "right",
                  }}
                >
                  {data.ordered_dates[data.ordered_dates.length - 1]?.slice(0, 10)}
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={handlePrevFrame}
                    disabled={data.frames.length < 2}
                    style={{
                      background: "#1e293b",
                      color: "#f8fafc",
                      border: "1px solid #334155",
                      borderRadius: "6px",
                      padding: "6px 10px",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                  >
                    &#9664;&#9664; Prev
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!isPlaying && data && currentIndex >= data.frames.length - 1) {
                        setCurrentIndex(0);
                      }
                      setIsPlaying((p) => !p);
                    }}
                    disabled={data.frames.length < 2}
                    style={{
                      background: isPlaying ? "#f59e0b" : "#0284c7",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "6px",
                      padding: "6px 16px",
                      fontWeight: 700,
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                  >
                    {isPlaying ? "PAUSE" : "PLAY"}
                  </button>

                  <button
                    type="button"
                    onClick={handleNextFrame}
                    disabled={data.frames.length < 2}
                    style={{
                      background: "#1e293b",
                      color: "#f8fafc",
                      border: "1px solid #334155",
                      borderRadius: "6px",
                      padding: "6px 10px",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                  >
                    Next &#9654;&#9654;
                  </button>
                </div>

                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                    <span style={{ fontSize: "11px", color: "#94a3b8" }}>Speed:</span>
                    {SPEED_OPTIONS.map((spd) => (
                      <button
                        key={spd}
                        type="button"
                        onClick={() => setPlaybackSpeed(spd)}
                        style={{
                          padding: "3px 7px",
                          fontSize: "11px",
                          borderRadius: "4px",
                          border: "1px solid #334155",
                          cursor: "pointer",
                          background: playbackSpeed === spd ? "#38bdf8" : "#1e293b",
                          color: playbackSpeed === spd ? "#0f172a" : "#cbd5e1",
                          fontWeight: playbackSpeed === spd ? 700 : 400,
                        }}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>

                  <label
                    style={{
                      fontSize: "12px",
                      color: "#cbd5e1",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={loop}
                      onChange={(e) => setLoop(e.target.checked)}
                    />
                    LOOP
                  </label>

                  <label
                    style={{
                      fontSize: "12px",
                      color: "#cbd5e1",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={showReticle}
                      onChange={(e) => setShowReticle(e.target.checked)}
                    />
                    Reticle
                  </label>

                  <a
                    href={resolveUrl(data.gif_download_url)}
                    download={data.download_filename}
                    style={{
                      background: "#10b981",
                      color: "#052e16",
                      textDecoration: "none",
                      fontWeight: 700,
                      fontSize: "12px",
                      padding: "6px 12px",
                      borderRadius: "6px",
                    }}
                  >
                    Download GIF
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              background: "#0f172a",
              border: "1px solid #1e293b",
              borderRadius: "8px",
              padding: "12px",
              fontSize: "12px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div style={{ fontWeight: 700, color: "#38bdf8", borderBottom: "1px solid #1e293b", paddingBottom: "6px" }}>
              Frame Telemetry &amp; Calibration
            </div>

            <div>
              <span style={{ color: "#94a3b8" }}>Observation ID:</span>{" "}
              <code style={{ color: "#f8fafc" }}>{currentFrame.obs_id}</code>
            </div>
            <div>
              <span style={{ color: "#94a3b8" }}>Survey Epochs:</span>{" "}
              {data.epochs_covered.join(" → ")} ({data.time_baseline_days} d)
            </div>
            <div>
              <span style={{ color: "#94a3b8" }}>Detector / LVF Band:</span>{" "}
              {currentFrame.detector} &bull; {currentFrame.wavelength_um.toFixed(3)} &mu;m (&plusmn;
              {currentFrame.bandwidth_um.toFixed(3)} &mu;m)
            </div>
            <div>
              <span style={{ color: "#94a3b8" }}>Target Flux:</span>{" "}
              {currentFrame.flux_mjy_sr !== null
                ? `${currentFrame.flux_mjy_sr.toFixed(3)} MJy/sr (${currentFrame.flux_ujy?.toFixed(1)} µJy, SNR ${currentFrame.snr})`
                : "N/A"}
            </div>
            <div>
              <span style={{ color: "#94a3b8" }}>Target Centroid:</span>{" "}
              RA {currentFrame.object_ra_deg.toFixed(5)}&deg;, Dec{" "}
              {currentFrame.object_dec_deg.toFixed(5)}&deg;
            </div>
            <div>
              <span style={{ color: "#94a3b8" }}>Net Displacement:</span>{" "}
              <strong style={{ color: "#38bdf8" }}>
                {data.angular_displacement_arcsec.toFixed(2)}&Prime;
              </strong>{" "}
              across sequence
            </div>
            <div>
              <span style={{ color: "#94a3b8" }}>Global Scale:</span> [{data.display_scale.vmin},{" "}
              {data.display_scale.vmax}] {data.flux_unit} ({data.display_scale.stretch})
            </div>
            <div>
              <span style={{ color: "#94a3b8" }}>Quality Flags:</span>{" "}
              {currentFrame.flag_labels.length > 0
                ? currentFrame.flag_labels.join(", ")
                : "CLEAN (0)"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SPHERExTimeLapseViewer;