import { useState, useEffect, useCallback } from "react";
import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import { fetchDevices } from "./api";
import "./App.css";

export default function App() {
  const [devices,      setDevices]      = useState([]);
  const [selectedImei, setSelectedImei] = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [backendUp,    setBackendUp]    = useState(false);
  const [error,        setError]        = useState(null);

  const loadDevices = useCallback(async () => {
    try {
      const data = await fetchDevices();
      if (Array.isArray(data)) {
        setDevices(data);
        // Auto-select first device if nothing is selected yet
        setSelectedImei((prev) => prev ?? data[0]?.imei ?? null);
        setBackendUp(true);
        setError(null);
      }
    } catch (e) {
      setBackendUp(false);
      setError("Cannot reach the backend. Make sure it is running.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDevices();
    const iv = setInterval(loadDevices, 30_000);
    return () => clearInterval(iv);
  }, [loadDevices]);

  const selectedDevice = devices.find((d) => d.imei === selectedImei) ?? null;

  return (
    <div className="app-layout">
      <Sidebar
        devices={devices}
        selectedImei={selectedImei}
        onSelect={setSelectedImei}
        loading={loading}
        backendUp={backendUp}
      />

      <main className="app-main">
        {/* Backend unreachable */}
        {!backendUp && !loading && (
          <div className="empty-state">
            <span className="empty-icon">🔌</span>
            <p>{error ?? "Connecting to backend…"}</p>
            <p className="muted">
              Run <code>make dev</code> in the backend folder, then refresh.
            </p>
          </div>
        )}

        {/* Backend up, no devices yet */}
        {backendUp && !loading && devices.length === 0 && (
          <div className="empty-state">
            <span className="empty-icon">📡</span>
            <p>No devices registered yet.</p>
            <p className="muted">Power on a node — it will appear here automatically.</p>
          </div>
        )}

        {/* Normal view */}
        {backendUp && selectedDevice && (
          <Dashboard
            device={selectedDevice}
            onDeviceUpdated={loadDevices}
          />
        )}
      </main>
    </div>
  );
}
