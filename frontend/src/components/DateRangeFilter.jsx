import { useState } from "react";
import "./DateRangeFilter.css";

const PRESETS = [
  { label: "1h",  hours: 1 },
  { label: "6h",  hours: 6 },
  { label: "24h", hours: 24 },
  { label: "7d",  hours: 168 },
  { label: "30d", hours: 720 },
  { label: "All", hours: null },
];

function toLocalInput(isoString) {
  if (!isoString) return "";
  return isoString.slice(0, 16);
}

function toISO(localValue) {
  if (!localValue) return null;
  return new Date(localValue).toISOString();
}

export default function DateRangeFilter({ from, to, onChange, compact = false }) {
  const [activePreset, setActivePreset] = useState("24h");

  function applyPreset(preset) {
    setActivePreset(preset.label);
    if (preset.hours === null) {
      onChange({ from: null, to: null });
    } else {
      const now   = new Date();
      const start = new Date(now.getTime() - preset.hours * 3600 * 1000);
      onChange({ from: start.toISOString(), to: now.toISOString() });
    }
  }

  function handleFrom(e) {
    setActivePreset(null);
    onChange({ from: toISO(e.target.value), to });
  }

  function handleTo(e) {
    setActivePreset(null);
    onChange({ from, to: toISO(e.target.value) });
  }

  return (
    <div className={`drf ${compact ? "drf--compact" : ""}`}>
      <div className="drf-presets">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            className={`drf-preset ${activePreset === p.label ? "drf-preset--active" : ""}`}
            onClick={() => applyPreset(p)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="drf-custom">
        <span className="drf-label">From</span>
        <input
          type="datetime-local"
          value={toLocalInput(from)}
          onChange={handleFrom}
          className="drf-input"
        />
        <span className="drf-label">To</span>
        <input
          type="datetime-local"
          value={toLocalInput(to)}
          onChange={handleTo}
          className="drf-input"
        />
      </div>
    </div>
  );
}
