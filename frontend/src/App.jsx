import { useState, useEffect, useCallback } from "react";
import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import { fetchDevices } from "./api";
import "./App.css";

// Dummy devices shown when the backend is unreachable
const DUMMY_DEVICES = [
  {
    id: 1,
    imei: "123456789012345",
    name: "Demo Node — Kampala",
    location: "Nakasero Hill",
    registered_at: new Date(Date.now() - 7 * 86400_000).toISOString(),
    last_seen: new Date(Date.now() - 4 * 60_000).toISOString(),
  },
  {
    id: 2,
    imei: "987654321098765",
    name: "Demo Node — Entebbe",
    location: "Airport Road",
    registered_at: new Date(Date.now() - 3 * 86400_000).toISOString(),
    last_seen: new Date(Date.now() - 18 * 60_000).toISOString(),
  },
];

export default function App() {
  const [devices, setDevices]           = useState(DUMMY_DEVICES);
  const [selectedImei, setSelectedImei] = useState(DUMMY_DEVICES[0].imei);
  const [loading, setLoading]           = useState(false);
  const [backendUp, setBackendUp]       = useState(false);

  const loadDevices = useCallback(async () => {
    try {
      const data = await fetchDevices();
      if (Array.isArray(data)) {
        setDevices(data.length > 0 ? data : DUMMY_DEVICES);
        setSelectedImei((prev) => prev ?? (data[0] ?? DUMMY_DEVICES[0]).imei);
        setBackendUp(true);
      }
    } catch (_) {
      // Backend unreachable — keep showing dummy data silently
      setBackendUp(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDevices();
    const iv = setInterval(loadDevices, 30_000);
    return () => clearInterval(iv);
  }, [loadDevices]);

  const selectedDevice =
    devices.find((d) => d.imei === selectedImei) ?? devices[0];

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
        {selectedDevice && (
          <Dashboard
            device={selectedDevice}
            onDeviceUpdated={loadDevices}
            backendUp={backendUp}
          />
        )}
      </main>
    </div>
  );
}
