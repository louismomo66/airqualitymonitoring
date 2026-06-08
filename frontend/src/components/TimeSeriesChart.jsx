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
            <span className="ts-toggle-dot" style={{ background: on ? s.color : "#94a3b8" }} />
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
/**
 * Props:
 *   data      – chart points
 *   series    – [{ key, label, color, unit, yAxisId?, referenceLines? }]
 *   yUnit     – fallback unit for single-axis mode
 *   dualAxis  – if true, uses series[].yAxisId ("left"|"right" or any two IDs)
 *   title / subtitle
 *   loading
 */
export default function TimeSeriesChart({
  data = [], series = [], yUnit = "", dualAxis = false,
  title, subtitle, loading = false,
}) {
  const cardRef = useRef(null);
  const [active,    setActive]    = useState(() => series.map((s) => s.key));
  const [dateRange, setDateRange] = useState({ from: null, to: null });
  const [exporting, setExporting] = useState(false);

  // Filter by date range
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

  async function handleExportPng() {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      await exportPng(cardRef.current, title.replace(/[^a-z0-9]/gi, "_").toLowerCase());
    } finally {
      setExporting(false);
    }
  }

  function handleExportCsv() {
    const activeSeries = series.filter((s) => active.includes(s.key));
    const columns = ["time", ...activeSeries.map((s) => s.key)];
    const headers = {
      time: "Timestamp",
      ...Object.fromEntries(activeSeries.map((s) => [s.key, `${s.label} (${s.unit || yUnit})`])),
    };
    exportCsv(filtered, columns, headers, title.replace(/[^a-z0-9]/gi, "_").toLowerCase());
  }

  const refLines = series
    .filter((s) => active.includes(s.key) && s.referenceLines)
    .flatMap((s) => s.referenceLines);

  // In dual-axis mode collect the two unique axis IDs
  const axisIds = dualAxis
    ? [...new Set(series.map((s) => s.yAxisId).filter(Boolean))]
    : [];
  const leftAxisId  = axisIds[0] ?? "left";
  const rightAxisId = axisIds[1] ?? "right";

  // Tick / axis label colours that work on the light theme
  const axisTickColor  = "#64748b";
  const gridColor      = "#e2e8f0";
  const brushBg        = "#f0f4f8";
  const brushStroke    = "#c8d0e0";

  // Find a representative colour for each axis (first active series on that axis)
  const leftColor  = series.find((s) => active.includes(s.key) && s.yAxisId === leftAxisId)?.color  ?? axisTickColor;
  const rightColor = series.find((s) => active.includes(s.key) && s.yAxisId === rightAxisId)?.color ?? axisTickColor;

  // Unit label for each axis
  const leftUnit  = series.find((s) => s.yAxisId === leftAxisId)?.unit  ?? yUnit;
  const rightUnit = series.find((s) => s.yAxisId === rightAxisId)?.unit ?? "";

  return (
    <div className="ts-card" ref={cardRef}>
      {/* Header */}
      <div className="ts-card-header">
        <div>
          <div className="ts-card-title">{title}</div>
          {subtitle && <div className="ts-card-sub">{subtitle}</div>}
        </div>
        <div className="ts-export-btns">
          <button className="ts-export-btn" onClick={handleExportCsv} title="Export CSV">⬇ CSV</button>
          <button className="ts-export-btn" onClick={handleExportPng} disabled={exporting} title="Save PNG">
            {exporting ? "…" : "🖼 PNG"}
          </button>
        </div>
      </div>

      {/* Series toggles */}
      <SeriesToggle series={series} active={active} onToggle={toggleSeries} />

      {/* Date filter */}
      <DateRangeFilter from={dateRange.from} to={dateRange.to} onChange={setDateRange} compact />

      {/* Chart */}
      {loading ? (
        <div className="ts-empty">⏳ Loading data…</div>
      ) : filtered.length === 0 ? (
        <div className="ts-empty">No data in selected range</div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart
            data={filtered}
            margin={{ top: 8, right: dualAxis ? 56 : 20, left: -4, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fill: axisTickColor, fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: gridColor }}
              interval="preserveStartEnd"
              minTickGap={55}
            />

            {dualAxis ? (
              <>
                {/* Left axis — temperature */}
                <YAxis
                  yAxisId={leftAxisId}
                  orientation="left"
                  tick={{ fill: leftColor, fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  unit={` ${leftUnit}`}
                  width={50}
                />
                {/* Right axis — humidity */}
                <YAxis
                  yAxisId={rightAxisId}
                  orientation="right"
                  tick={{ fill: rightColor, fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  unit={` ${rightUnit}`}
                  width={44}
                />
              </>
            ) : (
              <YAxis
                tick={{ fill: axisTickColor, fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                unit={yUnit ? ` ${yUnit}` : ""}
                width={54}
              />
            )}

            <Tooltip content={<CustomTooltip />} />

            {refLines.map((rl) => (
              <ReferenceLine
                key={`${rl.label}-${rl.value}`}
                y={rl.value}
                yAxisId={dualAxis ? leftAxisId : undefined}
                stroke={rl.color || "#f59e0b"}
                strokeDasharray="4 3"
                label={{ value: rl.label, fill: rl.color || "#f59e0b", fontSize: 10, position: "insideTopRight" }}
              />
            ))}

            {series.map((s) =>
              active.includes(s.key) ? (
                <Line
                  key={s.key}
                  yAxisId={dualAxis ? (s.yAxisId ?? leftAxisId) : undefined}
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
              height={22}
              stroke={brushStroke}
              fill={brushBg}
              travellerWidth={8}
              tickFormatter={() => ""}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
