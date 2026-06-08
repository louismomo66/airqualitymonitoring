import { useState, useEffect, useCallback } from "react";
import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import DeviceMap from "./components/DeviceMap";
import { fetchDevices } from "./api";
import "./App.css";

const DUMMY_DEVICES = [
  {
    id: 1,
    imei: "000000000000000",
    name: "Demo Node — Kampala",
    location: "Nakasero Hill",
    lat: 0.3476,
    lng: 32.5825,
    registered_at: new Date(Date.now() - 7 * 86400_000).toISOString(),
    last_seen:     new Date(Date.now() - 4 * 60_000).toISOString(),
  },
  {
    id: 2,
    imei: "000000000000001",
    name: "Demo Node — Entebbe",
    location: "Airport Road",
    lat: 0.0512,
    lng: 32.4432,
    registered_at: new Date(Date.now() - 3 * 86400_000).toISOString(),
    last_seen:     new Date(Date.now() - 18 * 60_000).toISOString(),
  },
];

export default function App() {
  const [devices,      setDevices]      = useState(DUMMY_DEVICES);
  const [selectedImei, setSelectedImei] = useState(DUMMY_DEVICES[0].imei);
  const [view,         setView]         = useState("dashboard"); // "dashboard" | "map"
  const [loading,      setLoading]      = useState(false);
  const [backendUp,    setBackendUp]    = useState(false);

  const loadDevices = useCallback(async () => {
    try {
      const data = await fetchDevices();
      if (Array.isArray(data)) {
        setDevices(data.length > 0 ? data : DUMMY_DEVICES);
        setSelectedImei((prev) => prev ?? (data[0] ?? DUMMY_DEVICES[0]).imei);
        setBackendUp(true);
      }
    } catch (_) {
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

  const selectedDevice = devices.find((d) => d.imei === selectedImei) ?? devices[0];

  function handleSelectFromMap(imei) {
    setSelectedImei(imei);
    setView("dashboard");
  }

  return (
    <div className="app-layout">
      <Sidebar
        devices={devices}
        selectedImei={selectedImei}
        onSelect={(imei) => { setSelectedImei(imei); setView("dashboard"); }}
        loading={loading}
        backendUp={backendUp}
        view={view}
        onViewChange={setView}
      />
      <main className="app-main">
        {view === "map" && (
          <DeviceMap
            devices={devices}
            onSelectDevice={handleSelectFromMap}
          />
        )}
        {view === "dashboard" && selectedDevice && (
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
