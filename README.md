# Air Quality Monitor — Full Stack

## Stack

| Layer | Tech |
|-------|------|
| IoT nodes | ESP32 + SIM7000G (MQTT over GSM) |
| Broker | Eclipse Mosquitto 2 |
| Backend | Go 1.22, PubSubClient, gorilla/mux, lib/pq |
| Database | PostgreSQL 16 |
| Frontend | React 18, Recharts, Vite |
| Infra | Docker Compose |

## Project layout

```
project/
├── docker-compose.yml
├── mosquitto/
│   └── config/mosquitto.conf
├── backend/
│   ├── Dockerfile
│   ├── go.mod
│   ├── cmd/server/main.go
│   └── internal/
│       ├── db/          # schema, models, queries
│       ├── mqtt/        # MQTT subscriber + auto-registration
│       └── api/         # REST handlers
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    └── src/
        ├── App.jsx
        ├── api.js        # fetch wrappers
        ├── utils/aqi.js  # EPA PM2.5 breakpoints
        └── components/
            ├── Sidebar           # device list
            ├── Dashboard         # per-device view
            ├── StatCard          # KPI tiles
            ├── ReadingsChart     # Recharts line chart
            ├── ReadingsTable     # paginated table
            └── DeviceEditModal   # rename / set location
```

## Quick start

```bash
# 1. Clone / enter the project folder
cd project

# 2. Build and start everything
docker compose up --build

# Frontend → http://localhost:3000
# Backend  → http://localhost:8080
# MQTT     → localhost:1883
```

## How device auto-registration works

1. ESP32 node powers on, joins GSM network, reads IMEI, publishes JSON to
   `airquality/data`.
2. Go backend is subscribed to that topic. On each message it runs:
   ```sql
   INSERT INTO devices (imei, last_seen)
   VALUES ($1, NOW())
   ON CONFLICT (imei) DO UPDATE SET last_seen = NOW()
   ```
3. The device appears in the sidebar immediately.
4. Click **Edit Device** to give it a friendly name and location.

## REST API

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/devices | List all devices |
| GET | /api/devices/:imei | Get one device |
| POST | /api/devices/:imei | Update name/location |
| GET | /api/devices/:imei/readings | Paginated readings (`?limit=50&offset=0`) |
| GET | /api/devices/:imei/readings/latest | Most recent reading |
| GET | /health | Health check |

## MQTT payload format

```json
{
  "imei":        "123456789012345",
  "pm1_0":       5.0,
  "pm2_5":       8.0,
  "pm10":        12.0,
  "shield_temp": 25.10,
  "shield_hum":  60.50,
  "board_temp":  26.00,
  "board_hum":   58.30
}
```

Fields with value `-1` (sensor error) are stored as NULL.

## Adding broker authentication

1. Edit `mosquitto/config/mosquitto.conf` — set `allow_anonymous false` and
   add a `password_file`.
2. Set `MQTT_USER` / `MQTT_PASS` in `docker-compose.yml` under the backend
   service and update `subscriber.go` to pass them in `opts`.
# airqualitymonitoring
