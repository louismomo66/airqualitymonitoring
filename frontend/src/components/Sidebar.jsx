import "./Sidebar.css";
import { getAqiColor, getAqiLabel } from "../utils/aqi";

export default function Sidebar({ devices, selectedImei, onSelect, loading, backendUp }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-logo">🌬️</span>
        <div>
          <h1 className="sidebar-title">AQ Monitor</h1>
          <p className="sidebar-subtitle">Air Quality Network</p>
        </div>
      </div>
      <div className="sidebar-backend-status">
        <span className={`status-dot ${backendUp ? "status-dot--online" : ""}`} />
        <span className="sidebar-backend-label">
          {backendUp ? "Backend connected" : "Demo mode"}
        </span>
      </div>

      <div className="sidebar-section-label">Devices</div>

      {loading && <div className="sidebar-loading">Loading devices…</div>}

      {!loading && devices.length === 0 && (
        <div className="sidebar-empty">No devices yet</div>
      )}

      <ul className="device-list">
        {devices.map((device) => (
          <DeviceItem
            key={device.imei}
            device={device}
            active={device.imei === selectedImei}
            onClick={() => onSelect(device.imei)}
          />
        ))}
      </ul>

      <div className="sidebar-footer">
        <span className="sidebar-footer-text">
          {devices.length} device{devices.length !== 1 ? "s" : ""} registered
        </span>
      </div>
    </aside>
  );
}

function DeviceItem({ device, active, onClick }) {
  const isOnline = isRecentlySeen(device.last_seen);
  const name = device.name || `Node ${device.imei.slice(-6)}`;

  return (
    <li
      className={`device-item ${active ? "device-item--active" : ""}`}
      onClick={onClick}
    >
      <div className="device-item-row">
        <span className={`status-dot ${isOnline ? "status-dot--online" : ""}`} />
        <span className="device-name">{name}</span>
      </div>
      <div className="device-imei">IMEI: {device.imei}</div>
      {device.location && (
        <div className="device-location">📍 {device.location}</div>
      )}
      <div className="device-last-seen">
        Last seen: {formatRelative(device.last_seen)}
      </div>
    </li>
  );
}

function isRecentlySeen(ts) {
  if (!ts) return false;
  return Date.now() - new Date(ts).getTime() < 10 * 60 * 1000; // 10 min
}

function formatRelative(ts) {
  if (!ts) return "never";
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
