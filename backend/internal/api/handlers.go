package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"

	"github.com/airquality/backend/internal/db"
)

// Handler holds shared dependencies for HTTP handlers.
type Handler struct {
	db *sql.DB
}

// respond writes a JSON response with the given status code.
func respond(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// Health godoc
// GET /health
func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	respond(w, http.StatusOK, map[string]string{"status": "ok"})
}

// ListDevices godoc
// GET /api/devices
func (h *Handler) ListDevices(w http.ResponseWriter, r *http.Request) {
	devices, err := db.ListDevices(h.db)
	if err != nil {
		respond(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if devices == nil {
		devices = []db.Device{}
	}
	respond(w, http.StatusOK, devices)
}

// GetDevice godoc
// GET /api/devices/{imei}
func (h *Handler) GetDevice(w http.ResponseWriter, r *http.Request) {
	imei := mux.Vars(r)["imei"]
	device, err := db.GetDevice(h.db, imei)
	if err != nil {
		respond(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if device == nil {
		respond(w, http.StatusNotFound, map[string]string{"error": "device not found"})
		return
	}
	respond(w, http.StatusOK, device)
}

// UpdateDevice godoc
// POST /api/devices/{imei}
// Body: { "name": "...", "location": "...", "lat": 0.0, "lng": 0.0 }
func (h *Handler) UpdateDevice(w http.ResponseWriter, r *http.Request) {
	imei := mux.Vars(r)["imei"]

	var body struct {
		Name     *string  `json:"name"`
		Location *string  `json:"location"`
		Lat      *float64 `json:"lat"`
		Lng      *float64 `json:"lng"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respond(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}

	_, err := h.db.Exec(`
		UPDATE devices SET name = $1, location = $2, lat = $3, lng = $4
		WHERE imei = $5
	`, body.Name, body.Location, body.Lat, body.Lng, imei)
	if err != nil {
		respond(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	device, _ := db.GetDevice(h.db, imei)
	respond(w, http.StatusOK, device)
}

// ListReadings godoc
// GET /api/devices/{imei}/readings?limit=50&offset=0&from=2026-01-01T00:00:00Z&to=2026-12-31T23:59:59Z
func (h *Handler) ListReadings(w http.ResponseWriter, r *http.Request) {
	imei := mux.Vars(r)["imei"]

	limit := queryInt(r, "limit", 500)
	offset := queryInt(r, "offset", 0)
	if limit > 2000 {
		limit = 2000
	}

	filter := db.ReadingFilter{}
	if v := r.URL.Query().Get("from"); v != "" {
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			respond(w, http.StatusBadRequest, map[string]string{"error": "invalid 'from' — use RFC3339 e.g. 2026-01-01T00:00:00Z"})
			return
		}
		filter.From = &t
	}
	if v := r.URL.Query().Get("to"); v != "" {
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			respond(w, http.StatusBadRequest, map[string]string{"error": "invalid 'to' — use RFC3339 e.g. 2026-12-31T23:59:59Z"})
			return
		}
		filter.To = &t
	}

	readings, err := db.ListReadings(h.db, imei, limit, offset, filter)
	if err != nil {
		respond(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	total, _ := db.CountReadings(h.db, imei, filter)

	if readings == nil {
		readings = []db.Reading{}
	}

	respond(w, http.StatusOK, map[string]interface{}{
		"total":    total,
		"limit":    limit,
		"offset":   offset,
		"readings": readings,
	})
}

// LatestReading godoc
// GET /api/devices/{imei}/readings/latest
func (h *Handler) LatestReading(w http.ResponseWriter, r *http.Request) {
	imei := mux.Vars(r)["imei"]

	reading, err := db.LatestReading(h.db, imei)
	if err != nil {
		respond(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if reading == nil {
		respond(w, http.StatusNotFound, map[string]string{"error": "no readings yet"})
		return
	}
	respond(w, http.StatusOK, reading)
}

// queryInt reads an integer query parameter with a default fallback.
func queryInt(r *http.Request, key string, def int) int {
	v := r.URL.Query().Get(key)
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil || n < 0 {
		return def
	}
	return n
}

// ListWeatherReadings godoc
// GET /api/devices/{imei}/weather?limit=500&offset=0&from=...&to=...
func (h *Handler) ListWeatherReadings(w http.ResponseWriter, r *http.Request) {
	imei := mux.Vars(r)["imei"]
	limit := queryInt(r, "limit", 500)
	offset := queryInt(r, "offset", 0)
	if limit > 2000 {
		limit = 2000
	}
	filter := db.ReadingFilter{}
	if v := r.URL.Query().Get("from"); v != "" {
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			respond(w, http.StatusBadRequest, map[string]string{"error": "invalid 'from'"})
			return
		}
		filter.From = &t
	}
	if v := r.URL.Query().Get("to"); v != "" {
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			respond(w, http.StatusBadRequest, map[string]string{"error": "invalid 'to'"})
			return
		}
		filter.To = &t
	}
	readings, err := db.ListWeatherReadings(h.db, imei, limit, offset, filter)
	if err != nil {
		respond(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	total, _ := db.CountWeatherReadings(h.db, imei, filter)
	if readings == nil {
		readings = []db.WeatherReading{}
	}
	respond(w, http.StatusOK, map[string]interface{}{
		"total": total, "limit": limit, "offset": offset, "readings": readings,
	})
}

// LatestWeatherReading godoc
// GET /api/devices/{imei}/weather/latest
func (h *Handler) LatestWeatherReading(w http.ResponseWriter, r *http.Request) {
	imei := mux.Vars(r)["imei"]
	reading, err := db.LatestWeatherReading(h.db, imei)
	if err != nil {
		respond(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if reading == nil {
		respond(w, http.StatusNotFound, map[string]string{"error": "no weather readings yet"})
		return
	}
	respond(w, http.StatusOK, reading)
}
