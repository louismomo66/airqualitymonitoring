const BASE = "/api";

export async function fetchDevices() {
  const res = await fetch(`${BASE}/devices`);
  if (!res.ok) throw new Error("Failed to fetch devices");
  return res.json();
}

export async function fetchDevice(imei) {
  const res = await fetch(`${BASE}/devices/${imei}`);
  if (!res.ok) throw new Error("Failed to fetch device");
  return res.json();
}

export async function updateDevice(imei, { name, location, lat, lng }) {
  const res = await fetch(`${BASE}/devices/${imei}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, location, lat, lng }),
  });
  if (!res.ok) throw new Error("Failed to update device");
  return res.json();
}

export async function fetchReadings(imei, limit = 500, offset = 0, from = null, to = null) {
  let url = `${BASE}/devices/${imei}/readings?limit=${limit}&offset=${offset}`;
  if (from) url += `&from=${encodeURIComponent(from)}`;
  if (to)   url += `&to=${encodeURIComponent(to)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch readings");
  return res.json();
}

export async function fetchLatestReading(imei) {
  const res = await fetch(`${BASE}/devices/${imei}/readings/latest`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch latest reading");
  return res.json();
}

export async function fetchWeatherReadings(imei, limit = 500, offset = 0, from = null, to = null) {
  let url = `${BASE}/devices/${imei}/weather?limit=${limit}&offset=${offset}`;
  if (from) url += `&from=${encodeURIComponent(from)}`;
  if (to)   url += `&to=${encodeURIComponent(to)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch weather readings");
  return res.json();
}

export async function fetchLatestWeatherReading(imei) {
  const res = await fetch(`${BASE}/devices/${imei}/weather/latest`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch latest weather reading");
  return res.json();
}
