import { useState, useEffect, useCallback } from "react";
import { fetchLatestReading, fetchReadings } from "../api";
import StatCard from "./StatCard";
import TimeSeriesChart from "./TimeSeriesChart";
import ReadingsTable from "./ReadingsTable";
import DeviceEditModal from "./DeviceEditModal";
import ExportModal from "./ExportModal";
import { getAqiLabel, getAqiColor } from "../utils/aqi";
import { generateDummyReadings } from "../utils/dummyData";
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
  { key: "shield_temp", label: "Shield Temp", color: "#e85d04", unit: "°C", yAxisId: "temp" },
  { key: "board_temp",  label: "Board Temp",  color: "#f48c06", unit: "°C", yAxisId: "temp" },
  { key: "shield_hum",  label: "Shield Hum",  color: "#0096c7", unit: "%",  yAxisId: "hum"  },
  { key: "board_hum",   label: "Board Hum",   color: "#48cae4", unit: "%",  yAxisId: "hum"  },
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

const DUMMY_READINGS = generateDummyReadings(288);
const DUMMY_CHART    = toChartData(DUMMY_READINGS);
const DUMMY_TABLE    = [...DUMMY_READINGS].reverse().slice(0, 50);

export default function Dashboard({ device, onDeviceUpdated, backendUp = false }) {
  const [latest,        setLatest]        = useState(null);
  const [chartData,     setChartData]     = useState(DUMMY_CHART);
  const [tableReadings, setTableReadings] = useState(DUMMY_TABLE);
  const [tableTotal,    setTableTotal]    = useState(DUMMY_READINGS.length);
  const [tablePage,     setTablePage]     = useState(0);
  const [loadingLatest, setLoadingLatest] = useState(false);
  const [loadingChart,  setLoadingChart]  = useState(false);
  const [loadingTable,  setLoadingTable]  = useState(false);
  const [editOpen,      setEditOpen]      = useState(false);
  const [exportOpen,    setExportOpen]    = useState(false);
  const [useDummy,      setUseDummy]      = useState(true);

  const loadLatest = useCallback(async () => {
    if (!backendUp) return;
    setLoadingLatest(true);
    try {
      const data = await fetchLatestReading(device.imei);
      if (data) { setLatest(data); setUseDummy(false); }
    } catch (_) {}
    setLoadingLatest(false);
  }, [device.imei, backendUp]);

  const loadChart = useCallback(async () => {
    if (!backendUp) return;
    setLoadingChart(true);
    try {
      const data = await fetchReadings(device.imei, CHART_LIMIT, 0);
      if (data?.readings?.length) {
        setChartData(toChartData(data.readings));
        setUseDummy(false);
      }
    } catch (_) {}
    setLoadingChart(false);
  }, [device.imei, backendUp]);

  const loadTable = useCallback(async () => {
    if (!backendUp) return;
    setLoadingTable(true);
    try {
      const data = await fetchReadings(device.imei, TABLE_LIMIT, tablePage * TABLE_LIMIT);
      if (data?.readings?.length) {
        setTableReadings(data.readings);
        setTableTotal(data.total ?? 0);
        setUseDummy(false);
      }
    } catch (_) {}
    setLoadingTable(false);
  }, [device.imei, tablePage, backendUp]);

  useEffect(() => {
    setTablePage(0);
    setLatest(null);
    setChartData(DUMMY_CHART);
    setTableReadings(DUMMY_TABLE);
    setTableTotal(DUMMY_READINGS.length);
    setUseDummy(true);
  }, [device.imei]);

  useEffect(() => {
    loadLatest();
    loadChart();
    const iv = setInterval(() => { loadLatest(); loadChart(); }, POLL_INTERVAL);
    return () => clearInterval(iv);
  }, [loadLatest, loadChart]);

  useEffect(() => { loadTable(); }, [loadTable]);

  const displayName = device.name || `Node ${device.imei.slice(-6)}`;
  const kpi         = latest ?? DUMMY_CHART.at(-1);
  const aqiLabel    = kpi?.pm2_5 != null ? getAqiLabel(kpi.pm2_5) : null;
  const aqiColor    = kpi?.pm2_5 != null ? getAqiColor(kpi.pm2_5) : "#64748b";

  return (
    <div className="dashboard">

      {/* Header */}
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
            {useDummy && <span className="tag tag--warn">⚠ Demo data</span>}
          </div>
        </div>
        <button className="btn-edit" onClick={() => setEditOpen(true)}>✏️ Edit Device</button>
      </div>

      {/* KPI tiles */}
      <div className="stat-grid">
        <StatCard label="PM1.0"       value={kpi?.pm1_0}       unit="μg/m³" icon="🔵" loading={loadingLatest} />
        <StatCard label="PM2.5"       value={kpi?.pm2_5}       unit="μg/m³" icon="🟡" loading={loadingLatest} color={aqiColor} />
        <StatCard label="PM10"        value={kpi?.pm10}        unit="μg/m³" icon="🔴" loading={loadingLatest} />
        <StatCard label="Shield Temp" value={kpi?.shield_temp} unit="°C"    icon="🌡️" loading={loadingLatest} />
        <StatCard label="Shield Hum"  value={kpi?.shield_hum}  unit="%"     icon="💧" loading={loadingLatest} />
        <StatCard label="Board Temp"  value={kpi?.board_temp}  unit="°C"    icon="🔧" loading={loadingLatest} />
      </div>

      {/* Air quality chart */}
      <TimeSeriesChart
        title="Air Quality — Particulate Matter"
        subtitle="PM1.0 · PM2.5 · PM10 — toggle series, drag brush to pan"
        data={chartData}
        series={PM_SERIES}
        yUnit="μg/m³"
        loading={loadingChart && !useDummy}
      />

      {/* Temp & humidity chart */}
      <TimeSeriesChart
        title="Temperature & Humidity"
        subtitle="Temperature (left axis °C) · Humidity (right axis %) — toggle series, drag brush to pan"
        data={chartData}
        series={ENV_SERIES}
        yUnit=""
        dualAxis
        loading={loadingChart && !useDummy}
      />

      {/* Readings table */}
      <div className="section">
        <div className="section-header">
          <h3 className="section-title">
            Readings <span className="count-badge">{tableTotal.toLocaleString()}</span>
          </h3>
          <div className="section-header-actions">
            <button className="btn-export" onClick={() => setExportOpen(true)}>
              ⬇ Export
            </button>
            <div className="pagination">
              <button className="btn-page" disabled={tablePage === 0} onClick={() => setTablePage((p) => p - 1)}>← Prev</button>
              <span className="page-info">Page {tablePage + 1} / {Math.max(1, Math.ceil(tableTotal / TABLE_LIMIT))}</span>
              <button className="btn-page" disabled={(tablePage + 1) * TABLE_LIMIT >= tableTotal} onClick={() => setTablePage((p) => p + 1)}>Next →</button>
            </div>
          </div>
        </div>
        <ReadingsTable readings={tableReadings} loading={loadingTable && !useDummy} />
      </div>

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
