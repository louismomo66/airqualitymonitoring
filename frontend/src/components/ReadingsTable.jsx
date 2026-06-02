import { getAqiColor, getAqiLabel } from "../utils/aqi";
import "./ReadingsTable.css";

function fmtNum(v, d = 1) {
  if (v == null) return <span className="null-val">—</span>;
  return Number(v).toFixed(d);
}

function fmtDate(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

export default function ReadingsTable({ readings, loading }) {
  if (loading) {
    return <div className="table-state">Loading…</div>;
  }
  if (!readings || readings.length === 0) {
    return <div className="table-state">No readings recorded yet.</div>;
  }

  return (
    <div className="table-wrapper">
      <table className="readings-table">
        <thead>
          <tr>
            <th>Received At</th>
            <th>PM1.0 (μg/m³)</th>
            <th>PM2.5 (μg/m³)</th>
            <th>PM10 (μg/m³)</th>
            <th>AQI</th>
            <th>Shield Temp (°C)</th>
            <th>Shield Hum (%)</th>
            <th>Board Temp (°C)</th>
            <th>Board Hum (%)</th>
          </tr>
        </thead>
        <tbody>
          {readings.map((r) => {
            const aqi = r.pm2_5 != null ? getAqiLabel(r.pm2_5) : null;
            const aqiColor = r.pm2_5 != null ? getAqiColor(r.pm2_5) : "#64748b";
            return (
              <tr key={r.id}>
                <td className="mono">{fmtDate(r.received_at)}</td>
                <td>{fmtNum(r.pm1_0)}</td>
                <td>{fmtNum(r.pm2_5)}</td>
                <td>{fmtNum(r.pm10)}</td>
                <td>
                  {aqi ? (
                    <span className="aqi-badge" style={{ color: aqiColor, borderColor: aqiColor }}>
                      {aqi}
                    </span>
                  ) : (
                    <span className="null-val">—</span>
                  )}
                </td>
                <td>{fmtNum(r.shield_temp, 2)}</td>
                <td>{fmtNum(r.shield_hum, 2)}</td>
                <td>{fmtNum(r.board_temp, 2)}</td>
                <td>{fmtNum(r.board_hum, 2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
