import { useState, useEffect, useCallback } from "react";
import { fetchLatestReading, fetchReadings } from "../api";
import StatCard from "./StatCard";
import TimeSeriesChart from "./TimeSeriesChart";
import ReadingsTable from "./ReadingsTable";
import DeviceEditModal from "./DeviceEditModal";
import ExportModal from "./ExportModal";
import Analytics from "./Analytics";
import { getAqiLabel, getAqiColor } from "../utils/aqi";
import "./Dashboard.css";

const POLL_INTERVAL = 30_000;
const TABLE_LIMIT   = 50;
const CHART_LIMIT   = 500;

const PM_SERIES = [
  { key: "pm1_0", label: "PM1.0", color: "#60a5fa", unit: "μg/m³" },
  {
    key: "pm2_5", label: "PM2.5", color: "#fbbf24", unit: "μg/m³",
    referenceLines: [{ value: 15, label: "WHO 15 μg", color: "#f59e0b" }],
  },
  {
    key: "pm10", label: "PM10", color: "#f87171", unit: "μg/m³",
    referenceLines: [{ value: 45, label: "WHO 45 μg", color: "#f59e0b" }],
  },
];

const ENV_SERIES = [
  { key: "shield_temp", label: "Shield Temp", color: "#34d399", unit: "°C" },
  { key: "shield_hum",  label: "Shield Hum",  color: "#818cf8", unit: "%"  },
  { key: "board_temp",  label: "Board Temp",  color: "#fb923c", unit: "°C" },
  { key: "board_hum",   label: "Board Hum",   color: "#a78bfa", unit: "%"  },
];

function fmtTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return (
    `${(d.getMonth()+1).toString().padStart(2,"0")}/${d.getDate().toString().padStart(2,"0")} ` +
    `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}`
  );
}

function toChartData(readings) {
  return readings.map((r) => ({
    time:        fmtTime(r.received_at),
    rawTime:     r.received_at,
    // keep received_at so ExportModal can filter by date
    received_at: r.received_at,
    imei:        r.imei,
    pm1_0:       r.pm1_0,
    pm2_5:       r.pm2_5,
    pm10:        r.pm10,
    shield_temp: r.shield_temp,
    shield_hum:  r.shield_hum,
    board_temp:  r.board_temp,
    board_hum:   r.board_hum,
  }));
}

export default function Dashboard({ device, onDeviceUpdated }) {
  const [tab,           setTab]           = useState("overview");
  const [latest,        setLatest]        = useState(null);
  const [chartData,     setChartData]     = useState([]);
  const [tableReadings, setTableReadings] = useState([]);
  const [tableTotal,    setTableTotal]    = useState(0);
  const [tablePage,     setTablePage]     = useState(0);
  const [loadingLatest, setLoadingLatest] = useState(true);
  const [loadingChart,  setLoadingChart]  = useState(true);
  const [loadingTable,  setLoadingTable]  = useState(true);
  const [editOpen,      setEditOpen]      = useState(false);
  const [exportOpen,    setExportOpen]    = useState(false);

  // ── Latest reading (KPI tiles) ───────────────────────────
  const loadLatest = useCallback(async () => {
    setLoadingLatest(true);
    try {
      const data = await fetchLatestReading(device.imei);
      setLatest(data ?? null);
    } catch (_) {
      setLatest(null);
    } finally {
      setLoadingLatest(false);
    }
  }, [device.imei]);

  // ── Chart data ───────────────────────────────────────────
  const loadChart = useCallback(async () => {
    setLoadingChart(true);
    try {
      const data = await fetchReadings(device.imei, CHART_LIMIT, 0);
      setChartData(toChartData(data?.readings ?? []));
    } catch (_) {
      setChartData([]);
    } finally {
      setLoadingChart(false);
    }
  }, [device.imei]);

  // ── Table (paginated) ────────────────────────────────────
  const loadTable = useCallback(async () => {
    setLoadingTable(true);
    try {
      const data = await fetchReadings(device.imei, TABLE_LIMIT, tablePage * TABLE_LIMIT);
      setTableReadings(data?.readings ?? []);
      setTableTotal(data?.total ?? 0);
    } catch (_) {
      setTableReadings([]);
      setTableTotal(0);
    } finally {
      setLoadingTable(false);
    }
  }, [device.imei, tablePage]);

  // Reset everything when the selected device changes
  useEffect(() => {
    setTab("overview");
    setTablePage(0);
    setLatest(null);
    setChartData([]);
    setTableReadings([]);
    setTableTotal(0);
  }, [device.imei]);

  // Initial load + polling
  useEffect(() => {
    loadLatest();
    loadChart();
    const iv = setInterval(() => { loadLatest(); loadChart(); }, POLL_INTERVAL);
    return () => clearInterval(iv);
  }, [loadLatest, loadChart]);

  useEffect(() => { loadTable(); }, [loadTable]);

  // ── Derived values ───────────────────────────────────────
  const displayName = device.name || `Node ${device.imei.slice(-6)}`;
  const aqiLabel    = latest?.pm2_5 != null ? getAqiLabel(latest.pm2_5) : null;
  const aqiColor    = latest?.pm2_5 != null ? getAqiColor(latest.pm2_5) : "#64748b";

  return (
    <div className="dashboard">

      {/* ── Header ── */}
      <div className="dashboard-header">
        <div className="dashboard-title-group">
          <h2 className="dashboard-title">{displayName}</h2>
          <div className="dashboard-meta">
            <span className="tag">IMEI: {device.imei}</span>
            {device.location && <span className="tag">📍 {device.location}</span>}
            {aqiLabel && (
              <span className="tag" style={{ color: aqiColor, borderColor: aqiColor }}>
                {aqiLabel}
              </span>
            )}
          </div>
        </div>
        <button className="btn-edit" onClick={() => setEditOpen(true)}>✏️ Edit Device</button>
      </div>

      {/* ── Tab bar ── */}
      <div className="tab-bar">
        <button
          className={`tab-btn ${tab === "overview" ? "tab-btn--active" : ""}`}
          onClick={() => setTab("overview")}
        >
          📊 Overview
        </button>
        <button
          className={`tab-btn ${tab === "analytics" ? "tab-btn--active" : ""}`}
          onClick={() => setTab("analytics")}
        >
          🔬 Analytics
        </button>
      </div>

      {/* ══ ANALYTICS TAB ══ */}
      {tab === "analytics" && (
        <Analytics data={chartData} loading={loadingChart} />
      )}

      {/* ══ OVERVIEW TAB ══ */}
      {tab === "overview" && (
        <>
          {/* KPI tiles */}
          <div className="stat-grid">
            <StatCard label="PM1.0"       value={latest?.pm1_0}       unit="μg/m³" icon="🔵" loading={loadingLatest} />
            <StatCard label="PM2.5"       value={latest?.pm2_5}       unit="μg/m³" icon="🟡" loading={loadingLatest} color={aqiColor} />
            <StatCard label="PM10"        value={latest?.pm10}        unit="μg/m³" icon="🔴" loading={loadingLatest} />
            <StatCard label="Shield Temp" value={latest?.shield_temp} unit="°C"    icon="🌡️" loading={loadingLatest} />
            <StatCard label="Shield Hum"  value={latest?.shield_hum}  unit="%"     icon="💧" loading={loadingLatest} />
            <StatCard label="Board Temp"  value={latest?.board_temp}  unit="°C"    icon="🔧" loading={loadingLatest} />
          </div>

          {/* Air quality time-series */}
          <TimeSeriesChart
            title="Air Quality — Particulate Matter"
            subtitle="PM1.0 · PM2.5 · PM10 — toggle series, drag brush to pan"
            data={chartData}
            series={PM_SERIES}
            yUnit="μg/m³"
            loading={loadingChart}
          />

          {/* Temp & humidity time-series */}
          <TimeSeriesChart
            title="Temperature & Humidity"
            subtitle="Shield and board sensors — toggle series, drag brush to pan"
            data={chartData}
            series={ENV_SERIES}
            yUnit=""
            loading={loadingChart}
          />

          {/* Readings table */}
          <div className="section">
            <div className="section-header">
              <h3 className="section-title">
                Readings <span className="count-badge">{tableTotal.toLocaleString()}</span>
              </h3>
              <div className="section-header-actions">
                <button
                  className="btn-export"
                  onClick={() => setExportOpen(true)}
                  disabled={chartData.length === 0}
                >
                  ⬇ Export
                </button>
                <div className="pagination">
                  <button className="btn-page" disabled={tablePage === 0} onClick={() => setTablePage((p) => p - 1)}>← Prev</button>
                  <span className="page-info">Page {tablePage + 1} / {Math.max(1, Math.ceil(tableTotal / TABLE_LIMIT))}</span>
                  <button className="btn-page" disabled={(tablePage + 1) * TABLE_LIMIT >= tableTotal} onClick={() => setTablePage((p) => p + 1)}>Next →</button>
                </div>
              </div>
            </div>
            <ReadingsTable readings={tableReadings} loading={loadingTable} />
          </div>
        </>
      )}

      {editOpen && (
        <DeviceEditModal
          device={device}
          onClose={() => setEditOpen(false)}
          onSaved={() => { setEditOpen(false); onDeviceUpdated(); }}
        />
      )}

      {exportOpen && (
        <ExportModal
          readings={chartData}
          deviceName={displayName}
          onClose={() => setExportOpen(false)}
        />
      )}

    </div>
  );
}
