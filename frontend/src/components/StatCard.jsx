import "./StatCard.css";

export default function StatCard({ label, value, unit, icon, loading, color }) {
  const display =
    loading ? "—" : value != null ? Number(value).toFixed(1) : "N/A";

  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div className="stat-label">{label}</div>
      <div
        className="stat-value"
        style={color && value != null ? { color } : undefined}
      >
        {display}
        {!loading && value != null && (
          <span className="stat-unit">{unit}</span>
        )}
      </div>
    </div>
  );
}
