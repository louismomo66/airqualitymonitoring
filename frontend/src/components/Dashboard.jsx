import { useState, useEffect, useCallback } from "react";
import { fetchLatestReading, fetchReadings } from "../api";
import StatCard from "./StatCard";
import TimeSeriesChart from "./TimeSeriesChart";
import ReadingsTable from "./ReadingsTable";
import DateRangeFilter from "./DateRangeFilter";
import DeviceEditModal from "./DeviceEditModal";
import { getAqiLabel, getAqiColor } from "../utils/aqi";
import "./Dashboard.css";

const POLL_INTERVAL = 30_000;
const CHART_LIMIT   = 500; // max points fetched for charts

// WHO 24-h PM reference lines
const PM25_REFS = [{ value: 15,  label: "WHO 15",  color: "#f59e0b" }];
const PM10_REFS = [{ value: 45,  label: "WHO 45",  color: "#f59e0b" }];

function fmtTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return `${(d.getMonth()+1).toString().padStart(2,"0")}/${d.getDate().toString().padStart(2,"0")} `
       + `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}`;
}

// Default: last 24 h
function defaultRange() {
  const now = new Date();
  return {
    from: new Date(now.getTime() - 24 * 3600 * 1000).toISOString(),
    to:   now.toISOString(),
  };
}

export default function Dashboard({ device, onDeviceUpdated }) {
  const [latest,          setLatest]          = useState(null);
  const [readings,        setReadings]        = useState([]);
  const [total,           setTotal]           = useState(0);
  const [tablePage,       setTablePage]       = useState(0);
  const [tableReadings,   setTableReadings]   = useState([]);
  const [tableTotal,      setTableTotal]      = useState(0);
  const [loadingLatest,   setLoadingLatest]   = useState(true);
  const [loadingChart,    setLoadingChart]    = useState(true);
  const [loadingTable,    setLoadingTable]    = useState(true);
  const [editOpen,        setEditOpen]        = useState(false);
  const [dateRange,       setDateRange]       = useState(defaultRange);

  const TABLE_LIMIT = 50;

  // ── Latest reading ────────────────────────────────────────
  const loadLatest = useCallback(async () => {
    try { setLatest(await fetchLatestReading(device.imei)); } catch (_) {}
    setLoadingLatest(false);
  }, [device.imei]);

  // ── Chart data (date-filtered, up to CHART_LIMIT points) ─
  const loadChart = useCallback(async () => {
    setLoadingChart(true);
    try {
      const data = await fetchReadings(
        device.imei, CHART_LIMIT, 0, dateRange.from, dateRange.to
      );
      setReadings(data.readings || []);
      setTotal(data.total || 0);
    } catch (_) {}
    setLoadingChart(false);
  }, [device.imei, dateRange]);

  // ── Table data (paginated, same date filter) ──────────────
  const loadTable = useCallback(async () => {
    setLoadingTable(true);
    try {
      const data = await fetchReadings(
        device.imei, TABLE_LIMIT, tablePage * TABLE_LIMIT,
        dateRange.from, dateRange.to
      );
      setTableReadings(data.readings || []);
      setTableTotal(data.total || 0);
    } catch (_) {}
    setLoadingTable(false);
  }, [device.imei, tablePage, dateRange]);

  // Reset on device change
  useEffect(() => {
    setTablePage(0);
    setLatest(null);
    setLoadingLatest(true);
    setDateRange(defaultRange());
  }, [device.imei]);

  useEffect(() => {
    loadLatest();
    const iv = setInterval(loadLatest, POLL_INTERVAL);
    return () => clearInterval(iv);
  }, [loadLatest]);

  useEffect(() => {
    loadChart();
  }, [loadChart]);

  useEffect(() => {
    loadTable();
  }, [loadTable]);

  // Auto-refresh chart + table when date range is "live" (to = now-ish)
  useEffect(() => {
    const iv = setInterval(() => {
      const toTime = dateRange.to ? new Date(dateRange.to).getTime() : null;
      const isLive = !toTime || Date.now() - toTime < 5 * 60 * 1000;
      if (isLive) {
        loadChart();
        if (tablePage === 0) loadTable();
      }
    }, POLL_INTERVAL);
    return () => clearInterval(iv);
  }, [loadChart, loadTable, tablePage, dateRange]);

  // ── Chart data transform ──────────────────────────────────
  const chartData = readings.map((r) => ({
    time:        fmtTime(r.received_at),
    pm1_0:       r.pm1_0,
    pm2_5:       r.pm2_5,
    pm10:        r.pm10,
    shield_temp: r.shield_temp,
    shield_hum:  r.shield_hum,
    board_temp:  r.board_temp,
    board_hum:   r.board_hum,
  }));

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

      {/* ── KPI tiles ── */}
      <div className="stat-grid">
        <StatCard label="PM1.0"         value={latest?.pm1_0}       unit="μg/m³" icon="🔵" loading={loadingLatest} />
        <StatCard label="PM2.5"         value={latest?.pm2_5}       unit="μg/m³" icon="🟡" loading={loadingLatest} color={aqiColor} />
        <StatCard label="PM10"          value={latest?.pm10}        unit="μg/m³" icon="🔴" loading={loadingLatest} />
        <StatCard label="Shield Temp"   value={latest?.shield_temp} unit="°C"    icon="🌡️" loading={loadingLatest} />
        <StatCard label="Shield Hum"    value={latest?.shield_hum}  unit="%"     icon="💧" loading={loadingLatest} />
        <StatCard label="Board Temp"    value={latest?.board_temp}  unit="°C"    icon="🔧" loading={loadingLatest} />
      </div>

      {/* ── Date filter ── */}
      <DateRangeFilter
        from={dateRange.from}
        to={dateRange.to}
        onChange={(r) => { setDateRange(r); setTablePage(0); }}
      />

      {/* ── Time-series charts ── */}
      <div className="charts-grid">
        <ChartCard title="PM1.0" subtitle="Particulate Matter < 1μm" loading={loadingChart}>
          <TimeSeriesChart data={chartData} dataKey="pm1_0" label="PM1.0" color="#60a5fa" unit="μg/m³" />
        </ChartCard>

        <ChartCard title="PM2.5" subtitle="Particulate Matter < 2.5μm" loading={loadingChart}>
          <TimeSeriesChart data={chartData} dataKey="pm2_5" label="PM2.5" color="#fbbf24" unit="μg/m³" referenceLines={PM25_REFS} />
        </ChartCard>

        <ChartCard title="PM10" subtitle="Particulate Matter < 10μm" loading={loadingChart}>
          <TimeSeriesChart data={chartData} dataKey="pm10" label="PM10" color="#f87171" unit="μg/m³" referenceLines={PM10_REFS} />
        </ChartCard>

        <ChartCard title="Temperature" subtitle="Shield sensor" loading={loadingChart}>
          <TimeSeriesChart data={chartData} dataKey="shield_temp" label="Temp" color="#34d399" unit="°C" />
        </ChartCard>

        <ChartCard title="Humidity" subtitle="Shield sensor" loading={loadingChart}>
          <TimeSeriesChart data={chartData} dataKey="shield_hum" label="Hum" color="#818cf8" unit="%" />
        </ChartCard>

        <ChartCard title="Board Temperature" subtitle="Internal sensor" loading={loadingChart}>
          <TimeSeriesChart data={chartData} dataKey="board_temp" label="Board Temp" color="#fb923c" unit="°C" />
        </ChartCard>
      </div>

      {/* ── Table ── */}
      <div className="section">
        <div className="section-header">
          <h3 className="section-title">
            Readings <span className="count-badge">{tableTotal.toLocaleString()}</span>
          </h3>
          <div className="pagination">
            <button className="btn-page" disabled={tablePage === 0} onClick={() => setTablePage(p => p - 1)}>← Prev</button>
            <span className="page-info">Page {tablePage + 1} / {Math.max(1, Math.ceil(tableTotal / TABLE_LIMIT))}</span>
            <button className="btn-page" disabled={(tablePage + 1) * TABLE_LIMIT >= tableTotal} onClick={() => setTablePage(p => p + 1)}>Next →</button>
          </div>
        </div>
        <ReadingsTable readings={tableReadings} loading={loadingTable} />
      </div>

      {editOpen && (
        <DeviceEditModal
          device={device}
          onClose={() => setEditOpen(false)}
          onSaved={() => { setEditOpen(false); onDeviceUpdated(); }}
        />
      )}
    </div>
  );
}

// ── Small wrapper card for each chart ───────────────────────
function ChartCard({ title, subtitle, loading, children }) {
  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <div>
          <div className="chart-card-title">{title}</div>
          {subtitle && <div className="chart-card-sub">{subtitle}</div>}
        </div>
        {loading && <span className="chart-loading">↻</span>}
      </div>
      {children}
    </div>
  );
}
