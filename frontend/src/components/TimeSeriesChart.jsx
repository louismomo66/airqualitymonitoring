import { useState, useMemo, useRef } from "react";
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Brush, ResponsiveContainer, ReferenceLine,
} from "recharts";
import DateRangeFilter from "./DateRangeFilter";
import { exportPng, exportCsv } from "../utils/export";
import "./TimeSeriesChart.css";

// ── Tooltip ───────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="ts-tooltip">
      <p className="ts-tooltip-time">{label}</p>
      {payload.map((p) =>
        p.value != null ? (
          <p key={p.dataKey} style={{ color: p.color }}>
            {p.name}: <strong>{Number(p.value).toFixed(2)}</strong> {p.unit}
          </p>
        ) : null
      )}
    </div>
  );
};

// ── Series toggle buttons ─────────────────────────────────────
function SeriesToggle({ series, active, onToggle }) {
  return (
    <div className="ts-toggles">
      {series.map((s) => {
        const on = active.includes(s.key);
        return (
          <button
            key={s.key}
            className={`ts-toggle ${on ? "ts-toggle--on" : ""}`}
            style={on ? { borderColor: s.color, color: s.color, background: `${s.color}18` } : {}}
            onClick={() => onToggle(s.key)}
          >
            <span className="ts-toggle-dot" style={{ background: on ? s.color : "#475569" }} />
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function TimeSeriesChart({
  data = [], series = [], yUnit = "", title, subtitle, loading = false,
}) {
  const cardRef = useRef(null);
  const [active,    setActive]    = useState(() => series.map((s) => s.key));
  // Default to no date bounds so all data is always visible
  const [dateRange, setDateRange] = useState({ from: null, to: null });
  const [exporting, setExporting] = useState(false);

  // Filter by date
  const filtered = useMemo(() => {
    if (!data.length) return [];
    const from = dateRange.from ? new Date(dateRange.from).getTime() : null;
    const to   = dateRange.to   ? new Date(dateRange.to).getTime()   : null;
    return data.filter((d) => {
      const t = new Date(d.rawTime || d.time).getTime();
      if (from && t < from) return false;
      if (to   && t > to)   return false;
      return true;
    });
  }, [data, dateRange]);

  function toggleSeries(key) {
    setActive((prev) =>
      prev.includes(key)
        ? prev.length > 1 ? prev.filter((k) => k !== key) : prev
        : [...prev, key]
    );
  }

  // ── PNG export ───────────────────────────────────────────
  async function handleExportPng() {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      const safeName = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      await exportPng(cardRef.current, safeName);
    } finally {
      setExporting(false);
    }
  }

  // ── CSV export — only active series, current date filter ─
  function handleExportCsv() {
    const activeSeries = series.filter((s) => active.includes(s.key));
    const columns = ["time", ...activeSeries.map((s) => s.key)];
    const headers = {
      time: "Timestamp",
      ...Object.fromEntries(activeSeries.map((s) => [s.key, `${s.label} (${s.unit || yUnit})`])),
    };
    const safeName = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    exportCsv(filtered, columns, headers, safeName);
  }

  const refLines = series
    .filter((s) => active.includes(s.key) && s.referenceLines)
    .flatMap((s) => s.referenceLines);

  return (
    <div className="ts-card" ref={cardRef}>
      {/* Header row */}
      <div className="ts-card-header">
        <div>
          <div className="ts-card-title">{title}</div>
          {subtitle && <div className="ts-card-sub">{subtitle}</div>}
        </div>
        {/* Export buttons */}
        <div className="ts-export-btns">
          <button className="ts-export-btn" onClick={handleExportCsv} title="Export visible data as CSV">
            ⬇ CSV
          </button>
          <button className="ts-export-btn" onClick={handleExportPng} disabled={exporting} title="Save chart as PNG">
            {exporting ? "…" : "🖼 PNG"}
          </button>
        </div>
      </div>

      {/* Series toggles */}
      <SeriesToggle series={series} active={active} onToggle={toggleSeries} />

      {/* Per-chart date filter */}
      <DateRangeFilter from={dateRange.from} to={dateRange.to} onChange={setDateRange} compact />

      {/* Chart */}
      {loading ? (
        <div className="ts-empty">⏳ Loading data…</div>
      ) : filtered.length === 0 ? (
        <div className="ts-empty">No data in selected range</div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={filtered} margin={{ top: 6, right: 20, left: -4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2235" vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fill: "#64748b", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={55}
            />
            <YAxis
              tick={{ fill: "#64748b", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              unit={yUnit ? ` ${yUnit}` : ""}
              width={54}
            />
            <Tooltip content={<CustomTooltip />} />

            {refLines.map((rl) => (
              <ReferenceLine
                key={`${rl.label}-${rl.value}`}
                y={rl.value}
                stroke={rl.color || "#f59e0b"}
                strokeDasharray="4 3"
                label={{ value: rl.label, fill: rl.color || "#f59e0b", fontSize: 10, position: "insideTopRight" }}
              />
            ))}

            {series.map((s) =>
              active.includes(s.key) ? (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  unit={s.unit || yUnit}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: s.color }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ) : null
            )}

            <Brush
              dataKey="time"
              height={24}
              stroke="#2e3248"
              fill="#0f1117"
              travellerWidth={8}
              tickFormatter={() => ""}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
