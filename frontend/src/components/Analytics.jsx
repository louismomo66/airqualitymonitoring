import { useMemo, useState } from "react";
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Brush,
} from "recharts";
import DateRangeFilter from "./DateRangeFilter";
import { pearson, interpretR, linearRegression } from "../utils/stats";
import "./Analytics.css";

// ── Air quality parameters the user can choose ─────────────
const AQ_PARAMS = [
  { key: "pm1_0", label: "PM1.0", color: "#60a5fa", unit: "μg/m³",
    desc: "Very fine particles (smaller than 1 µm). Penetrate deep into lungs." },
  { key: "pm2_5", label: "PM2.5", color: "#fbbf24", unit: "μg/m³",
    desc: "Fine particles (smaller than 2.5 µm). Main health concern for air quality." },
  { key: "pm10",  label: "PM10",  color: "#f87171", unit: "μg/m³",
    desc: "Coarse particles (smaller than 10 µm). Dust, pollen, mould spores." },
];

// ── Helpers ─────────────────────────────────────────────────
function fmtTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return (
    `${(d.getMonth()+1).toString().padStart(2,"0")}/${d.getDate().toString().padStart(2,"0")} ` +
    `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}`
  );
}

function defaultRange() {
  const now = new Date();
  return { from: new Date(now - 24*3600_000).toISOString(), to: now.toISOString() };
}

// Plain-English sentence from r and two labels
function plainEnglish(r, envLabel, pmLabel) {
  if (r === null) return "Not enough data to draw a conclusion.";
  const { label } = interpretR(r);
  const abs = Math.abs(r);
  const dir  = r > 0 ? "rises" : "drops";
  const dirInv = r > 0 ? "higher" : "lower";

  if (abs < 0.2) return `${envLabel} has little effect on ${pmLabel} levels in this period.`;
  if (abs < 0.4) return `When ${envLabel} is ${dirInv}, ${pmLabel} tends to be slightly ${r > 0 ? "higher" : "lower"} — but the effect is weak.`;
  if (abs < 0.7) return `There is a moderate link: ${pmLabel} generally ${dir} when ${envLabel} increases.`;
  return `Strong relationship: ${pmLabel} clearly ${dir} as ${envLabel} goes up.`;
}

// Map r to a simple emoji + word
function rToEmoji(r) {
  if (r === null) return { emoji: "❓", word: "Unknown" };
  const abs = Math.abs(r);
  if (abs < 0.2)  return { emoji: "➖", word: "No effect" };
  if (r > 0) {
    if (abs < 0.4) return { emoji: "📈", word: "Weak rise" };
    if (abs < 0.7) return { emoji: "📈", word: "Moderate rise" };
    return             { emoji: "📈", word: "Strong rise" };
  } else {
    if (abs < 0.4) return { emoji: "📉", word: "Weak drop" };
    if (abs < 0.7) return { emoji: "📉", word: "Moderate drop" };
    return             { emoji: "📉", word: "Strong drop" };
  }
}

// ── Tooltip ─────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="an-tooltip">
      <p className="an-tooltip-time">{label}</p>
      {payload.map((p) => p.value != null && (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: <strong>{Number(p.value).toFixed(1)}</strong> {p.unit}
        </p>
      ))}
    </div>
  );
};

// ── Impact card (replaces the "correlation card") ───────────
function ImpactCard({ envLabel, envEmoji, pmLabel, r }) {
  const { emoji, word } = rToEmoji(r);
  const { color }       = interpretR(r);
  const sentence        = plainEnglish(r, envLabel, pmLabel);
  return (
    <div className="an-impact-card">
      <div className="an-impact-top">
        <span className="an-impact-env">{envEmoji} {envLabel}</span>
        <span className="an-impact-arrow">→</span>
        <span className="an-impact-pm">{pmLabel}</span>
      </div>
      <div className="an-impact-result" style={{ color }}>
        {emoji} {word}
      </div>
      <p className="an-impact-sentence">{sentence}</p>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────
export default function Analytics({ data = [], useDummy }) {
  const [selectedParam, setSelectedParam] = useState("pm2_5");
  const [dateRange,     setDateRange]     = useState(defaultRange);

  const param = AQ_PARAMS.find((p) => p.key === selectedParam);

  // Filter by date range
  const filtered = useMemo(() => {
    const from = dateRange.from ? new Date(dateRange.from).getTime() : null;
    const to   = dateRange.to   ? new Date(dateRange.to).getTime()   : null;
    return data.filter((d) => {
      const t = new Date(d.rawTime || d.received_at || d.time).getTime();
      if (from && t < from) return false;
      if (to   && t > to)   return false;
      return true;
    });
  }, [data, dateRange]);

  // Chart data — overlay selected PM + temp + humidity over time
  const chartData = useMemo(() =>
    filtered.map((r) => ({
      time:        fmtTime(r.rawTime || r.received_at),
      [param.key]: r[param.key],
      shield_temp: r.shield_temp,
      shield_hum:  r.shield_hum,
    })),
    [filtered, param.key]
  );

  // Correlation values
  const pmVals   = filtered.map((r) => r[param.key]);
  const tempVals = filtered.map((r) => r.shield_temp);
  const humVals  = filtered.map((r) => r.shield_hum);

  const r_temp = pearson(tempVals, pmVals);
  const r_hum  = pearson(humVals,  pmVals);

  // Regression insight sentence
  const regTemp = linearRegression(tempVals, pmVals);
  const regHum  = linearRegression(humVals,  pmVals);

  function regSentence(reg, envLabel, envUnit) {
    if (!reg || Math.abs(reg.slope) < 0.01)
      return `No clear trend detected between ${envLabel} and ${param.label}.`;
    const dir = reg.slope > 0 ? "increases" : "decreases";
    return `For every 1${envUnit} rise in ${envLabel}, ${param.label} ${dir} by about ${Math.abs(reg.slope).toFixed(1)} μg/m³.`;
  }

  const n = filtered.length;

  return (
    <div className="analytics">

      {/* ── Header ── */}
      <div className="an-header">
        <div>
          <h3 className="an-title">🌡️ How does weather affect air quality?</h3>
          <p className="an-sub">
            See how temperature and humidity influence the pollution level you select.
            {useDummy && <span className="an-demo-badge"> ⚠ Demo data</span>}
          </p>
        </div>
        <span className="an-count">{n.toLocaleString()} readings</span>
      </div>

      {/* ── Pollution parameter selector ── */}
      <div className="an-selector-row">
        <span className="an-selector-label">Show effect on:</span>
        <div className="an-selector-btns">
          {AQ_PARAMS.map((p) => (
            <button
              key={p.key}
              className={`an-param-btn ${selectedParam === p.key ? "an-param-btn--active" : ""}`}
              style={selectedParam === p.key ? { borderColor: p.color, color: p.color, background: `${p.color}18` } : {}}
              onClick={() => setSelectedParam(p.key)}
            >
              <span className="an-param-dot" style={{ background: p.color }} />
              {p.label}
            </button>
          ))}
        </div>
        <p className="an-param-desc">{param.desc}</p>
      </div>

      {/* ── Date filter ── */}
      <DateRangeFilter from={dateRange.from} to={dateRange.to} onChange={setDateRange} />

      {/* ── Plain-English impact summary ── */}
      <div className="an-impact-grid">
        <ImpactCard envLabel="Temperature" envEmoji="🌡️" pmLabel={param.label} r={r_temp} />
        <ImpactCard envLabel="Humidity"    envEmoji="💧" pmLabel={param.label} r={r_hum}  />
      </div>

      {/* ── Regression insight sentences ── */}
      <div className="an-insight-box">
        <p>📐 {regSentence(regTemp, "Temperature", "°C")}</p>
        <p>📐 {regSentence(regHum,  "Humidity", "%")}</p>
      </div>

      {/* ── Overlay chart ── */}
      <div className="an-chart-card">
        <div className="an-chart-header">
          <div className="an-chart-title">
            {param.label}, Temperature &amp; Humidity over time
          </div>
          <div className="an-chart-sub">
            {param.label} on the left axis · Temperature and Humidity on the right axis · Drag the bar at the bottom to zoom in
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="an-empty">No data in the selected time range</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 64, left: -4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2235" vertical={false} />
              <XAxis
                dataKey="time"
                tick={{ fill: "#64748b", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={60}
              />
              {/* Left Y — selected PM */}
              <YAxis
                yAxisId="pm"
                orientation="left"
                tick={{ fill: param.color, fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                unit=" μg"
                width={50}
              />
              {/* Right Y — temp & humidity */}
              <YAxis
                yAxisId="env"
                orientation="right"
                tick={{ fill: "#64748b", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={46}
              />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8", paddingTop: 8 }} />

              <Line
                yAxisId="pm"
                type="monotone"
                dataKey={param.key}
                name={param.label}
                unit={param.unit}
                stroke={param.color}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
              <Line
                yAxisId="env"
                type="monotone"
                dataKey="shield_temp"
                name="Temperature"
                unit="°C"
                stroke="#34d399"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
              <Line
                yAxisId="env"
                type="monotone"
                dataKey="shield_hum"
                name="Humidity"
                unit="%"
                stroke="#818cf8"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
              <Brush
                dataKey="time"
                height={22}
                stroke="#2e3248"
                fill="#0f1117"
                travellerWidth={8}
                tickFormatter={() => ""}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── How to read this page ── */}
      <div className="an-explainer">
        <div className="an-explainer-title">📖 How to read this page</div>
        <div className="an-explainer-grid">
          <div className="an-explainer-item">
            <span className="an-explainer-icon">📈</span>
            <div>
              <strong>Rise</strong>
              <p>When one value goes up, the pollution level also tends to go up.</p>
            </div>
          </div>
          <div className="an-explainer-item">
            <span className="an-explainer-icon">📉</span>
            <div>
              <strong>Drop</strong>
              <p>When one value goes up, the pollution level tends to go down.</p>
            </div>
          </div>
          <div className="an-explainer-item">
            <span className="an-explainer-icon">➖</span>
            <div>
              <strong>No effect</strong>
              <p>The two measurements do not appear to be related in this time period.</p>
            </div>
          </div>
          <div className="an-explainer-item">
            <span className="an-explainer-icon">📐</span>
            <div>
              <strong>The number estimate</strong>
              <p>Shows roughly how many μg/m³ the pollution changes per degree or percent change.</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
