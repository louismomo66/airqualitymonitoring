import { useState } from "react";
import { updateDevice } from "../api";
import "./DeviceEditModal.css";

export default function DeviceEditModal({ device, onClose, onSaved }) {
  const [name,     setName]     = useState(device.name     || "");
  const [location, setLocation] = useState(device.location || "");
  const [lat,      setLat]      = useState(device.lat  != null ? String(device.lat)  : "");
  const [lng,      setLng]      = useState(device.lng  != null ? String(device.lng)  : "");
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState(null);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const parsedLat = lat.trim() !== "" ? parseFloat(lat) : null;
    const parsedLng = lng.trim() !== "" ? parseFloat(lng) : null;

    if ((lat.trim() !== "" && isNaN(parsedLat)) ||
        (lng.trim() !== "" && isNaN(parsedLng))) {
      setError("Latitude and longitude must be valid numbers.");
      setSaving(false);
      return;
    }

    try {
      await updateDevice(device.imei, {
        name:     name.trim()     || null,
        location: location.trim() || null,
        lat:      parsedLat,
        lng:      parsedLng,
      });
      onSaved();
    } catch (err) {
      setError("Failed to save. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Device</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-meta">
          <span className="mono-small">IMEI: {device.imei}</span>
        </div>

        <form onSubmit={handleSave}>
          <div className="form-group">
            <label>Friendly Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`Node ${device.imei.slice(-6)}`}
            />
          </div>

          <div className="form-group">
            <label>Location Label</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Kampala — Nakasero"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Latitude</label>
              <input
                type="number"
                step="any"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="e.g. 0.3476"
              />
            </div>
            <div className="form-group">
              <label>Longitude</label>
              <input
                type="number"
                step="any"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="e.g. 32.5825"
              />
            </div>
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-save" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
