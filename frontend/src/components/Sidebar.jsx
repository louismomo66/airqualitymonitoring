import { useState } from "react";
import "./Sidebar.css";

export default function Sidebar({
  devices, selectedImei, onSelect, loading, backendUp, view, onViewChange,
}) {
  const [deviceTab, setDeviceTab] = useState("aq"); // "aq" | "weather"

  const aqDevices      = devices.filter((d) => d.device_type !== "weather");
  const weatherDevices = devices.filter((d) => d.device_type === "weather");
  const visibleDevices = deviceTab === "aq" ? aqDevices : weatherDevices;

  // If the selected device isn't in the current tab, don't highlight anything
  const selectedDevice = devices.find((d) => d.imei === selectedImei);
  const selectedInTab  = selectedDevice?.device_type === (deviceTab === "aq" ? "aq" : "weather")
                      || (deviceTab === "aq" && selectedDevice?.device_type !== "weather");

  return (
    <aside className="sidebar">

      {/* ── Header ── */}
      <div className="sidebar-header">
        <span className="sidebar-logo">🌬️</span>
        <div>
          <h1 className="sidebar-title">AQ Monitor</h1>
          <p className="sidebar-subtitle">Air Quality Network</p>
        </div>
      </div>

      {/* ── Backend status ── */}
      <div className="sidebar-backend-status">
        <span className={`status-dot ${backendUp ? "status-dot--online" : ""}`} />
        <span className="sidebar-backend-label">
          {backendUp ? "Connected" : "Demo mode"}
        </span>
      </div>

      {/* ── View nav ── */}
      <div className="sidebar-nav">
        <button
          className={`sidebar-nav-btn ${view === "dashboard" ? "sidebar-nav-btn--active" : ""}`}
          onClick={() => onViewChange("dashboard")}
        >
          📊 Dashboard
        </button>
        <button
          className={`sidebar-nav-btn ${view === "map" ? "sidebar-nav-btn--active" : ""}`}
          onClick={() => onViewChange("map")}
        >
          🗺 Map View
        </button>
      </div>

      {/* ── Device type tabs ── */}
      <div className="sidebar-device-tabs">
        <button
          className={`sdt-tab ${deviceTab === "aq" ? "sdt-tab--active" : ""}`}
          onClick={() => setDeviceTab("aq")}
        >
          🌫️ Air Quality
          <span className="sdt-badge">{aqDevices.length}</span>
        </button>
        <button
          className={`sdt-tab ${deviceTab === "weather" ? "sdt-tab--active" : ""}`}
          onClick={() => setDeviceTab("weather")}
        >
          🌤 Weather
          <span className="sdt-badge">{weatherDevices.length}</span>
        </button>
      </div>

      {/* ── Device list ── */}
      {loading && <div className="sidebar-loading">Loading…</div>}

      {!loading && visibleDevices.length === 0 && (
        <div className="sidebar-empty">
          {deviceTab === "aq" ? "No air quality nodes yet" : "No weather stations yet"}
        </div>
      )}

      <ul className="device-list">
        {visibleDevices.map((device) => (
          <DeviceItem
            key={device.imei}
            device={device}
            active={device.imei === selectedImei && view === "dashboard" && selectedInTab}
            onClick={() => onSelect(device.imei)}
          />
        ))}
      </ul>

      <div className="sidebar-footer">
        <span className="sidebar-footer-text">
          {aqDevices.length} AQ · {weatherDevices.length} weather
        </span>
      </div>

    </aside>
  );
}

function DeviceItem({ device, active, onClick }) {
  const isOnline = isRecentlySeen(device.last_seen);
  const name     = device.name || `Node ${device.imei.slice(-6)}`;

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
      {device.lat != null && device.lng != null && (
        <div className="device-coords">
          🎯 {Number(device.lat).toFixed(4)}, {Number(device.lng).toFixed(4)}
        </div>
      )}
      <div className="device-last-seen">Last seen: {formatRelative(device.last_seen)}</div>
    </li>
  );
}

function isRecentlySeen(ts) {
  if (!ts) return false;
  return Date.now() - new Date(ts).getTime() < 10 * 60 * 1000;
}

function formatRelative(ts) {
  if (!ts) return "never";
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
