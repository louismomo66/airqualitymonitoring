import { useState, useEffect, useCallback } from "react";
import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import { fetchDevices } from "./api";
import "./App.css";

export default function App() {
  const [devices, setDevices] = useState([]);
  const [selectedImei, setSelectedImei] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadDevices = useCallback(async () => {
    try {
      const data = await fetchDevices();
      setDevices(data);
      // Auto-select first device
      if (data.length > 0 && !selectedImei) {
        setSelectedImei(data[0].imei);
      }
      setError(null);
    } catch (e) {
      setError("Cannot reach backend. Is it running?");
    } finally {
      setLoading(false);
    }
  }, [selectedImei]);

  // Initial load + poll for new devices every 30 s
  useEffect(() => {
    loadDevices();
    const interval = setInterval(loadDevices, 30_000);
    return () => clearInterval(interval);
  }, [loadDevices]);

  const selectedDevice = devices.find((d) => d.imei === selectedImei) || null;

  return (
    <div className="app-layout">
      <Sidebar
        devices={devices}
        selectedImei={selectedImei}
        onSelect={setSelectedImei}
        loading={loading}
      />
      <main className="app-main">
        {error && <div className="banner banner--error">{error}</div>}
        {!loading && !selectedDevice && !error && (
          <div className="empty-state">
            <span className="empty-icon">📡</span>
            <p>No devices registered yet.</p>
            <p className="muted">Power on a node to auto-register it.</p>
          </div>
        )}
        {selectedDevice && (
          <Dashboard device={selectedDevice} onDeviceUpdated={loadDevices} />
        )}
      </main>
    </div>
  );
}
