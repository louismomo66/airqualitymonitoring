import { useState, useEffect, useCallback } from "react";
import { fetchWeatherReadings, fetchLatestWeatherReading } from "../api";
import { degreesToCompass, windBeaufort } from "../utils/wind";
import StatCard from "./StatCard";
import TimeSeriesChart from "./TimeSeriesChart";
import DeviceEditModal from "./DeviceEditModal";
import ExportModal from "./ExportModal";
import "./WeatherDashboard.css";

const POLL_INTERVAL = 30_000;
const CHART_LIMIT   = 500;
const TABLE_LIMITS  = [10, 25, 50, 100, 200];

const WIND_SERIES = [
  { key: "wind_speed", label: "Wind Speed", color: "#3b82f6", unit: "kph" },
];

const RAIN_SERIES = [
  { key: "total_rainfall", label: "Total Rainfall", color: "#0ea5e9", unit: "mm" },
  { key: "rainfall_rate",  label: "Rainfall Rate",  color: "#06b6d4", unit: "mm/hr" },
];

const TEMP_SERIES_CH = (ch) => [
  { key: `bme${ch}_temp`, label: "BME Temp", color: "#e85d04", unit: "°C", yAxisId: "temp" },
  { key: `htu${ch}_temp`, label: "HTU Temp", color: "#f48c06", unit: "°C", yAxisId: "temp" },
  { key: `sht${ch}_temp`, label: "SHT Temp", color: "#fb8500", unit: "°C", yAxisId: "temp" },
  { key: `aht${ch}_temp`, label: "AHT Temp", color: "#ffb703", unit: "°C", yAxisId: "temp" },
  { key: `bme${ch}_hum`,  label: "BME Hum",  color: "#0096c7", unit: "%",  yAxisId: "hum"  },
  { key: `htu${ch}_hum`,  label: "HTU Hum",  color: "#48cae4", unit: "%",  yAxisId: "hum"  },
  { key: `sht${ch}_hum`,  label: "SHT Hum",  color: "#90e0ef", unit: "%",  yAxisId: "hum"  },
  { key: `aht${ch}_hum`,  label: "AHT Hum",  color: "#ade8f4", unit: "%",  yAxisId: "hum"  },
];

function fmtTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return `${(d.getMonth()+1).toString().padStart(2,"0")}/${d.getDate().toString().padStart(2,"0")} `
       + `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}`;
}

function toChartData(readings) {
  return readings.map((r) => ({ ...r, time: fmtTime(r.received_at), rawTime: r.received_at }));
}

function WindCompass({ deg }) {
  const label = degreesToCompass(deg);
  const angle = deg ?? 0;
  return (
    <div className="wd-compass">
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="36" fill="#f0f4f8" stroke="#d0d7e3" strokeWidth="2" />
        {["N","E","S","W"].map((d, i) => {
          const rad = (i * 90 - 90) * Math.PI / 180;
          return (
            <text key={d} x={40 + 28*Math.cos(rad)} y={40 + 28*Math.sin(rad)}
              textAnchor="middle" dominantBaseline="middle"
              fontSize="10" fontWeight="700" fill="#64748b">{d}</text>
          );
        })}
        <g transform={`rotate(${angle}, 40, 40)`}>
          <polygon points="40,12 43,40 40,34 37,40" fill="#3b82f6" />
          <polygon points="40,68 43,40 40,46 37,40" fill="#94a3b8" />
        </g>
        <circle cx="40" cy="40" r="3" fill="#1e293b" />
      </svg>
      <div className="wd-compass-label">{deg != null ? `${deg}° ${label}` : "—"}</div>
    </div>
  );
}

function WeatherTable({ readings, loading }) {
  if (loading) return <div className="table-state">Loading…</div>;
  if (!readings?.length) return <div className="table-state">No readings yet.</div>;
  return (
    <div className="table-wrapper">
      <table className="readings-table">
        <thead>
          <tr>
            <th>Received At</th>
            <th>Wind (kph)</th>
            <th>Direction</th>
            <th>Rainfall (mm)</th>
            <th>Rate (mm/hr)</th>
            <th>CH0 Temp (°C)</th>
            <th>CH0 Hum (%)</th>
            <th>CH1 Temp (°C)</th>
            <th>CH2 Temp (°C)</th>
          </tr>
        </thead>
        <tbody>
          {readings.map((r) => (
            <tr key={r.id}>
              <td className="mono">{new Date(r.received_at).toLocaleString()}</td>
              <td>{r.wind_speed ?? "—"}</td>
              <td>{r.wind_direction != null ? `${r.wind_direction}° ${degreesToCompass(r.wind_direction)}` : "—"}</td>
              <td>{r.total_rainfall ?? "—"}</td>
              <td>{r.rainfall_rate ?? "—"}</td>
              <td>{r.bme0_temp ?? "—"}</td>
              <td>{r.bme0_hum ?? "—"}</td>
              <td>{r.bme1_temp ?? "—"}</td>
              <td>{r.bme2_temp ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function WeatherDashboard({ device, onDeviceUpdated }) {
  const [latest,        setLatest]        = useState(null);
  const [chartData,     setChartData]     = useState([]);
  const [tableReadings, setTableReadings] = useState([]);
  const [tableTotal,    setTableTotal]    = useState(0);
  const [tablePage,     setTablePage]     = useState(0);
  const [tableLimit,    setTableLimit]    = useState(TABLE_LIMITS[1]);
  const [loadingLatest, setLoadingLatest] = useState(true);
  const [loadingChart,  setLoadingChart]  = useState(true);
  const [loadingTable,  setLoadingTable]  = useState(true);
  const [editOpen,      setEditOpen]      = useState(false);
  const [exportOpen,    setExportOpen]    = useState(false);

  const loadLatest = useCallback(async () => {
    setLoadingLatest(true);
    try {
      const d = await fetchLatestWeatherReading(device.imei);
      setLatest(d ?? null);
    } catch (_) { setLatest(null); }
    setLoadingLatest(false);
  }, [device.imei]);

  const loadChart = useCallback(async () => {
    setLoadingChart(true);
    try {
      const d = await fetchWeatherReadings(device.imei, CHART_LIMIT, 0);
      setChartData(toChartData(d?.readings ?? []));
    } catch (_) { setChartData([]); }
    setLoadingChart(false);
  }, [device.imei]);

  const loadTable = useCallback(async () => {
    setLoadingTable(true);
    try {
      const d = await fetchWeatherReadings(device.imei, tableLimit, tablePage * tableLimit);
      setTableReadings(d?.readings ?? []);
      setTableTotal(d?.total ?? 0);
    } catch (_) { setTableReadings([]); setTableTotal(0); }
    setLoadingTable(false);
  }, [device.imei, tablePage, tableLimit]);

  useEffect(() => {
    setTablePage(0); setLatest(null);
    setChartData([]); setTableReadings([]); setTableTotal(0);
  }, [device.imei]);

  useEffect(() => {
    loadLatest(); loadChart();
    const iv = setInterval(() => { loadLatest(); loadChart(); }, POLL_INTERVAL);
    return () => clearInterval(iv);
  }, [loadLatest, loadChart]);

  useEffect(() => { loadTable(); }, [loadTable]);

  const displayName = device.name || `Weather ${device.imei.slice(-6)}`;
  const beaufort    = windBeaufort(latest?.wind_speed);

  return (
    <div className="wd-wrap">
      <div className="dashboard-header">
        <div className="dashboard-title-group">
          <h2 className="dashboard-title">🌤 {displayName}</h2>
          <div className="dashboard-meta">
            <span className="tag">IMEI: {device.imei}</span>
            {device.location && <span className="tag">📍 {device.location}</span>}
            <span className="tag tag--weather">Weather Station</span>
          </div>
        </div>
        <button className="btn-edit" onClick={() => setEditOpen(true)}>✏️ Edit Device</button>
      </div>

      <div className="wd-kpi-row">
        <div className="wd-compass-wrap">
          <WindCompass deg={latest?.wind_direction} />
        </div>
        <div className="stat-grid wd-stat-grid">
          <StatCard label="Wind Speed"     value={latest?.wind_speed}    unit="kph"    icon="💨" loading={loadingLatest} />
          <StatCard label="Beaufort"       value={beaufort.scale}        unit={beaufort.label} icon="🌬️" loading={loadingLatest} />
          <StatCard label="Total Rainfall" value={latest?.total_rainfall} unit="mm"    icon="🌧️" loading={loadingLatest} />
          <StatCard label="Rainfall Rate"  value={latest?.rainfall_rate}  unit="mm/hr" icon="⏱️" loading={loadingLatest} />
          <StatCard label="CH0 Temp"       value={latest?.bme0_temp}      unit="°C"    icon="🌡️" loading={loadingLatest} />
          <StatCard label="CH0 Humidity"   value={latest?.bme0_hum}       unit="%"     icon="💧" loading={loadingLatest} />
        </div>
      </div>

      <TimeSeriesChart title="Wind Speed" subtitle="kph — drag brush to pan"
        data={chartData} series={WIND_SERIES} yUnit="kph" loading={loadingChart} />

      <TimeSeriesChart title="Rainfall" subtitle="Total (mm) and Rate (mm/hr)"
        data={chartData} series={RAIN_SERIES} yUnit="" loading={loadingChart} />

      <TimeSeriesChart title="Channel 0 — Temperature & Humidity"
        subtitle="Temp left axis (°C) · Humidity right axis (%)"
        data={chartData} series={TEMP_SERIES_CH(0)} yUnit="" dualAxis loading={loadingChart} />

      <TimeSeriesChart title="Channel 1 — Temperature & Humidity"
        subtitle="Temp left axis (°C) · Humidity right axis (%)"
        data={chartData} series={TEMP_SERIES_CH(1)} yUnit="" dualAxis loading={loadingChart} />

      <TimeSeriesChart title="Channel 2 — Temperature & Humidity"
        subtitle="Temp left axis (°C) · Humidity right axis (%)"
        data={chartData} series={TEMP_SERIES_CH(2)} yUnit="" dualAxis loading={loadingChart} />

      <div className="section">
        <div className="section-header">
          <h3 className="section-title">
            Readings <span className="count-badge">{tableTotal.toLocaleString()}</span>
          </h3>
          <div className="section-header-actions">
            <div className="rows-per-page">
              <label className="rows-label">Show</label>
              <select className="rows-select" value={tableLimit}
                onChange={(e) => { setTableLimit(Number(e.target.value)); setTablePage(0); }}>
                {TABLE_LIMITS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <span className="rows-label">rows</span>
            </div>
            <button className="btn-export" onClick={() => setExportOpen(true)} disabled={chartData.length === 0}>⬇ Export</button>
            <div className="pagination">
              <button className="btn-page" disabled={tablePage === 0} onClick={() => setTablePage(p => p - 1)}>← Prev</button>
              <span className="page-info">Page {tablePage + 1} / {Math.max(1, Math.ceil(tableTotal / tableLimit))}</span>
              <button className="btn-page" disabled={(tablePage + 1) * tableLimit >= tableTotal} onClick={() => setTablePage(p => p + 1)}>Next →</button>
            </div>
          </div>
        </div>
        <WeatherTable readings={tableReadings} loading={loadingTable} />
      </div>

      {editOpen && (
        <DeviceEditModal device={device} onClose={() => setEditOpen(false)}
          onSaved={() => { setEditOpen(false); onDeviceUpdated(); }} />
      )}
      {exportOpen && (
        <ExportModal readings={chartData} deviceName={displayName}
          onClose={() => setExportOpen(false)} />
      )}
    </div>
  );
}
