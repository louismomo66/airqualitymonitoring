package api

import (
	"database/sql"

	"github.com/gorilla/mux"
)

// RegisterRoutes wires all HTTP endpoints to the router.
func RegisterRoutes(r *mux.Router, database *sql.DB) {
	h := &Handler{db: database}

	// Health check
	r.HandleFunc("/health", h.Health).Methods("GET")

	// Device endpoints
	r.HandleFunc("/api/devices", h.ListDevices).Methods("GET")
	r.HandleFunc("/api/devices/{imei}", h.GetDevice).Methods("GET")
	r.HandleFunc("/api/devices/{imei}", h.UpdateDevice).Methods("POST")

	// Reading endpoints
	r.HandleFunc("/api/devices/{imei}/readings", h.ListReadings).Methods("GET")
	r.HandleFunc("/api/devices/{imei}/readings/latest", h.LatestReading).Methods("GET")
}
