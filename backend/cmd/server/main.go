package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/airquality/backend/internal/api"
	"github.com/airquality/backend/internal/db"
	"github.com/airquality/backend/internal/mqtt"
	"github.com/gorilla/mux"
	"github.com/rs/cors"
)

func main() {
	// ── Database ──────────────────────────────────────────────
	databaseURL := getEnv("DATABASE_URL",
		"postgres://aquser:aqpass@localhost:5432/airquality?sslmode=disable")

	database, err := db.Connect(databaseURL)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer database.Close()

	if err := db.Migrate(database); err != nil {
		log.Fatalf("failed to run migrations: %v", err)
	}

	// ── MQTT subscriber ───────────────────────────────────────
	brokerURL := getEnv("MQTT_BROKER", "tcp://localhost:1883")
	topic := getEnv("MQTT_TOPIC", "airquality/data")

	subscriber := mqtt.NewSubscriber(brokerURL, topic, database)
	if err := subscriber.Connect(); err != nil {
		log.Fatalf("failed to connect to MQTT broker: %v", err)
	}
	defer subscriber.Disconnect()

	// ── HTTP API ──────────────────────────────────────────────
	router := mux.NewRouter()
	api.RegisterRoutes(router, database)

	handler := cors.New(cors.Options{
		AllowedOrigins: []string{"*"},
		AllowedMethods: []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders: []string{"Content-Type"},
	}).Handler(router)

	port := getEnv("PORT", "8080")
	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	log.Printf("🚀 API server listening on :%s", port)
	if err := srv.ListenAndServe(); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
