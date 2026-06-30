import { useState } from "react";
import { exportCsv } from "../utils/export";
import DateRangeFilter from "./DateRangeFilter";
import "./ExportModal.css";

// All exportable columns with friendly labels
// AQ Columns
const AQ_COLUMNS = [
  { key: "received_at",  label: "Timestamp",         group: "meta" },
  { key: "imei",         label: "IMEI",               group: "meta" },
  { key: "pm1_0",        label: "PM1.0 (μg/m³)",      group: "pm"   },
  { key: "pm2_5",        label: "PM2.5 (μg/m³)",      group: "pm"   },
  { key: "pm10",         label: "PM10 (μg/m³)",       group: "pm"   },
  { key: "shield_temp",  label: "Ambient Temp (°C)",   group: "env"  },
  { key: "shield_hum",   label: "Ambient Hum (%)",     group: "env"  },
  { key: "board_temp",   label: "Internal Temp (°C)",  group: "env"  },
  { key: "board_hum",    label: "Internal Hum (%)",    group: "env"  },
];

const AQ_GROUPS = [
  { key: "meta", label: "Info"          },
  { key: "pm",   label: "Air Quality"   },
  { key: "env",  label: "Temp & Hum"    },
];

// Weather Columns
const WEATHER_COLUMNS = [
  { key: "received_at",     label: "Timestamp",            group: "meta" },
  { key: "imei",            label: "IMEI",                 group: "meta" },
  { key: "wind_speed",       label: "Wind Speed (kph)",     group: "wind" },
  { key: "wind_direction",   label: "Wind Dir (deg)",       group: "wind" },
  { key: "total_rainfall",   label: "Total Rain (mm)",      group: "rain" },
  { key: "rainfall_rate",    label: "Rain Rate (mm/hr)",    group: "rain" },
  { key: "bme0_temp",        label: "CH0 BME Temp (°C)",     group: "ch0"  },
  { key: "bme0_hum",         label: "CH0 BME Hum (%)",       group: "ch0"  },
  { key: "htu0_temp",        label: "CH0 HTU Temp (°C)",     group: "ch0"  },
  { key: "htu0_hum",         label: "CH0 HTU Hum (%)",       group: "ch0"  },
  { key: "sht0_temp",        label: "CH0 SHT Temp (°C)",     group: "ch0"  },
  { key: "sht0_hum",         label: "CH0 SHT Hum (%)",       group: "ch0"  },
  { key: "aht0_temp",        label: "CH0 AHT Temp (°C)",     group: "ch0"  },
  { key: "aht0_hum",         label: "CH0 AHT Hum (%)",       group: "ch0"  },
  { key: "bme1_temp",        label: "CH1 BME Temp (°C)",     group: "ch1"  },
  { key: "bme1_hum",         label: "CH1 BME Hum (%)",       group: "ch1"  },
  { key: "htu1_temp",        label: "CH1 HTU Temp (°C)",     group: "ch1"  },
  { key: "htu1_hum",         label: "CH1 HTU Hum (%)",       group: "ch1"  },
  { key: "sht1_temp",        label: "CH1 SHT Temp (°C)",     group: "ch1"  },
  { key: "sht1_hum",         label: "CH1 SHT Hum (%)",       group: "ch1"  },
  { key: "aht1_temp",        label: "CH1 AHT Temp (°C)",     group: "ch1"  },
  { key: "aht1_hum",         label: "CH1 AHT Hum (%)",       group: "ch1"  },
  { key: "bme2_temp",        label: "CH2 BME Temp (°C)",     group: "ch2"  },
  { key: "bme2_hum",         label: "CH2 BME Hum (%)",       group: "ch2"  },
  { key: "htu2_temp",        label: "CH2 HTU Temp (°C)",     group: "ch2"  },
  { key: "htu2_hum",         label: "CH2 HTU Hum (%)",       group: "ch2"  },
  { key: "sht2_temp",        label: "CH2 SHT Temp (°C)",     group: "ch2"  },
  { key: "sht2_hum",         label: "CH2 SHT Hum (%)",       group: "ch2"  },
  { key: "aht2_temp",        label: "CH2 AHT Temp (°C)",     group: "ch2"  },
  { key: "aht2_hum",         label: "CH2 AHT Hum (%)",       group: "ch2"  },
];

const WEATHER_GROUPS = [
  { key: "meta", label: "Info"           },
  { key: "wind", label: "Wind Sensor"    },
  { key: "rain", label: "Rain Sensor"    },
  { key: "ch0",  label: "MUX Channel 0"  },
  { key: "ch1",  label: "MUX Channel 1"  },
  { key: "ch2",  label: "MUX Channel 2"  },
];

function defaultRange() {
  const now = new Date();
  return { from: new Date(now - 24 * 3600_000).toISOString(), to: now.toISOString() };
}

export default function ExportModal({ readings, deviceName, deviceType, onClose }) {
  const allColumns = deviceType === "weather" ? WEATHER_COLUMNS : AQ_COLUMNS;
  const groups     = deviceType === "weather" ? WEATHER_GROUPS : AQ_GROUPS;

  const [selected,  setSelected]  = useState(allColumns.map((c) => c.key));
  const [dateRange, setDateRange] = useState(defaultRange);

  // Filter rows by date range
  const filtered = readings.filter((r) => {
    const t    = new Date(r.received_at).getTime();
    const from = dateRange.from ? new Date(dateRange.from).getTime() : null;
    const to   = dateRange.to   ? new Date(dateRange.to).getTime()   : null;
    if (from && t < from) return false;
    if (to   && t > to)   return false;
    return true;
  });

  function toggle(key) {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function toggleGroup(groupKey) {
    const groupKeys = allColumns.filter((c) => c.group === groupKey).map((c) => c.key);
    const allOn     = groupKeys.every((k) => selected.includes(k));
    if (allOn) {
      setSelected((prev) => prev.filter((k) => !groupKeys.includes(k)));
    } else {
      setSelected((prev) => [...new Set([...prev, ...groupKeys])]);
    }
  }

  function selectAll()   { setSelected(allColumns.map((c) => c.key)); }
  function deselectAll() { setSelected([]); }

  function handleExport() {
    if (!selected.length || !filtered.length) return;
    const orderedCols = allColumns.filter((c) => selected.includes(c.key));
    const headers = Object.fromEntries(orderedCols.map((c) => [c.key, c.label]));
    const safeName = `${(deviceName || "device").replace(/[^a-z0-9]/gi, "_")}_readings`;
    exportCsv(filtered, orderedCols.map((c) => c.key), headers, safeName);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="export-modal" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="export-modal-header">
          <div>
            <h3 className="export-modal-title">Export Readings</h3>
            <p className="export-modal-sub">CSV download — choose columns and date range</p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Date range */}
        <div className="export-section">
          <div className="export-section-label">Date range</div>
          <DateRangeFilter
            from={dateRange.from}
            to={dateRange.to}
            onChange={setDateRange}
            compact
          />
          <p className="export-row-count">
            {filtered.length.toLocaleString()} rows match this range
          </p>
        </div>

        {/* Column chooser */}
        <div className="export-section">
          <div className="export-section-label-row">
            <span className="export-section-label">Columns</span>
            <div className="export-sel-actions">
              <button className="export-sel-btn" onClick={selectAll}>All</button>
              <button className="export-sel-btn" onClick={deselectAll}>None</button>
            </div>
          </div>

          {groups.map((g) => {
            const cols = allColumns.filter((c) => c.group === g.key);
            const allOn = cols.every((c) => selected.includes(c.key));
            return (
              <div className="export-group" key={g.key}>
                <label className="export-group-label">
                  <input
                    type="checkbox"
                    checked={allOn}
                    onChange={() => toggleGroup(g.key)}
                  />
                  {g.label}
                </label>
                <div className="export-col-list">
                  {cols.map((c) => (
                    <label key={c.key} className="export-col-item">
                      <input
                        type="checkbox"
                        checked={selected.includes(c.key)}
                        onChange={() => toggle(c.key)}
                      />
                      {c.label}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="export-modal-actions">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button
            className="btn-save"
            onClick={handleExport}
            disabled={!selected.length || !filtered.length}
          >
            ⬇ Download CSV ({filtered.length.toLocaleString()} rows)
          </button>
        </div>

      </div>
    </div>
  );
}
