import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Brush,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

const CustomTooltip = ({ active, payload, label, unit }) => {
  if (!active || !payload?.length) return null;
  const v = payload[0]?.value;
  return (
    <div style={{
      background: "#1a1d27",
      border: "1px solid #2e3248",
      borderRadius: 8,
      padding: "10px 14px",
      fontSize: 12,
    }}>
      <p style={{ color: "#94a3b8", marginBottom: 4 }}>{label}</p>
      <p style={{ color: payload[0]?.color, fontWeight: 600 }}>
        {v != null ? `${Number(v).toFixed(2)} ${unit}` : "N/A"}
      </p>
    </div>
  );
};

export default function TimeSeriesChart({
  data,
  dataKey,
  label,
  color,
  unit,
  referenceLines = [],
}) {
  if (!data || data.length === 0) {
    return (
      <div style={{
        height: 180,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#64748b",
        fontSize: 13,
      }}>
        No data in selected range
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <ComposedChart data={data} margin={{ top: 6, right: 16, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e2235" vertical={false} />
        <XAxis
          dataKey="time"
          tick={{ fill: "#64748b", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={60}
        />
        <YAxis
          tick={{ fill: "#64748b", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          unit={` ${unit}`}
          width={52}
        />
        <Tooltip content={<CustomTooltip unit={unit} />} />

        {/* Reference lines e.g. WHO limits */}
        {referenceLines.map((rl) => (
          <ReferenceLine
            key={rl.value}
            y={rl.value}
            stroke={rl.color || "#f59e0b"}
            strokeDasharray="4 3"
            label={{ value: rl.label, fill: rl.color || "#f59e0b", fontSize: 10, position: "right" }}
          />
        ))}

        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: color }}
          connectNulls={false}
          isAnimationActive={false}
        />

        {/* Brush for panning / zooming */}
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
  );
}
