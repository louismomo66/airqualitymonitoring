import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { getAqiColor, getAqiLabel } from "../utils/aqi";
import "leaflet/dist/leaflet.css";
import "./DeviceMap.css";

// Fix Leaflet's broken default icon paths when bundled with Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Coloured circle marker SVG based on AQI level
function makeIcon(color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
    <circle cx="14" cy="14" r="11" fill="${color}" fill-opacity="0.9" stroke="white" stroke-width="2.5"/>
    <circle cx="14" cy="14" r="4" fill="white" fill-opacity="0.6"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize:   [28, 28],
    iconAnchor: [14, 14],
    popupAnchor:[0, -16],
  });
}

// Fit the map to show all markers
function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    if (positions.length === 1) {
      map.setView(positions[0], 13);
    } else {
      map.fitBounds(positions, { padding: [48, 48] });
    }
  }, [positions, map]);
  return null;
}

// Single device marker — fetches latest reading for the popup
function DeviceMarker({ device, onSelect, backendUp }) {
  const [reading, setReading] = useState(null);

  useEffect(() => {
    if (!backendUp) return;
    const endpoint = device.device_type === "weather"
      ? `/api/devices/${device.imei}/weather/latest`
      : `/api/devices/${device.imei}/readings/latest`;

    fetch(endpoint)
      .then((r) => r.ok ? r.json() : null)
      .then(setReading)
      .catch(() => {});
  }, [device.imei, device.device_type, backendUp]);

  const color = reading?.pm2_5 != null ? getAqiColor(reading.pm2_5) : "#64748b";

  return (
    <Marker
      position={[device.lat, device.lng]}
      icon={makeIcon(
        device.device_type === "weather" ? "#3b82f6" :
        reading?.pm2_5 != null ? getAqiColor(reading.pm2_5) : "#64748b"
      )}
    >
      <Popup className="device-popup" minWidth={200}>
        <div className="dp-header">
          <span className="dp-name">
            {device.device_type === "weather" ? "🌤 " : "🌫️ "}
            {device.name || `Node ${device.imei.slice(-6)}`}
          </span>
          {device.device_type === "aq" && reading?.pm2_5 != null && (
            <span className="dp-aqi" style={{ color: getAqiColor(reading.pm2_5), borderColor: getAqiColor(reading.pm2_5) }}>
              {getAqiLabel(reading.pm2_5)}
            </span>
          )}
        </div>
        {device.location && <p className="dp-location">📍 {device.location}</p>}
        <div className="dp-imei">IMEI: {device.imei}</div>

        {reading ? (
          <div className="dp-readings">
            {device.device_type === "aq" ? (
              <>
                {reading.pm2_5  != null && <span className="dp-chip">PM2.5 <strong>{reading.pm2_5} μg/m³</strong></span>}
                {reading.pm10   != null && <span className="dp-chip">PM10 <strong>{reading.pm10} μg/m³</strong></span>}
                {reading.shield_temp != null && <span className="dp-chip">Temp <strong>{reading.shield_temp}°C</strong></span>}
                {reading.shield_hum  != null && <span className="dp-chip">Hum <strong>{reading.shield_hum}%</strong></span>}
              </>
            ) : (
              <>
                {reading.wind_speed     != null && <span className="dp-chip">Wind <strong>{reading.wind_speed} kph</strong></span>}
                {reading.wind_direction != null && <span className="dp-chip">Dir <strong>{reading.wind_direction}°</strong></span>}
                {reading.total_rainfall != null && <span className="dp-chip">Rain <strong>{reading.total_rainfall} mm</strong></span>}
                {reading.bme0_temp      != null && <span className="dp-chip">Temp <strong>{reading.bme0_temp}°C</strong></span>}
              </>
            )}
          </div>
        ) : (
          <p className="dp-no-data">No readings yet</p>
        )}

        <button className="dp-btn" onClick={() => onSelect(device.imei)}>
          View Dashboard →
        </button>
      </Popup>
    </Marker>
  );
}

export default function DeviceMap({ devices, onSelectDevice, backendUp = false }) {
  // Only devices that have coordinates
  const mapped = devices.filter((d) => d.lat != null && d.lng != null);
  const positions = mapped.map((d) => [d.lat, d.lng]);

  // Default centre — Kampala, Uganda
  const defaultCenter = [0.3476, 32.5825];
  const defaultZoom   = 10;

  return (
    <div className="device-map-wrap">
      <div className="device-map-header">
        <h3 className="device-map-title">🗺 Device Map</h3>
        <p className="device-map-sub">
          {mapped.length} of {devices.length} device{devices.length !== 1 ? "s" : ""} have coordinates.
          {mapped.length < devices.length && (
            <> Use <strong>Edit Device</strong> on any device to add its latitude &amp; longitude.</>
          )}
        </p>
      </div>

      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        className="leaflet-map"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {mapped.length > 0 && <FitBounds positions={positions} />}

        {mapped.map((device) => (
          <DeviceMarker
            key={device.imei}
            device={device}
            onSelect={onSelectDevice}
            backendUp={backendUp}
          />
        ))}
      </MapContainer>

      {mapped.length === 0 && (
        <div className="device-map-empty">
          <span>📍</span>
          <p>No devices have coordinates yet.</p>
          <p>Click <strong>Edit Device</strong> on any device in the sidebar to enter its location.</p>
        </div>
      )}
    </div>
  );
}
