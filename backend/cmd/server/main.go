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

	// ── MQTT subscribers ──────────────────────────────────────
	brokerURL := getEnv("MQTT_BROKER", "tcp://localhost:1883")

	// AQ subscriber  → airquality/data
	aqTopic := getEnv("MQTT_TOPIC", "airquality/data")
	aqSub := mqtt.NewSubscriber(brokerURL, aqTopic, database)
	if err := aqSub.Connect(); err != nil {
		log.Fatalf("failed to connect AQ MQTT subscriber: %v", err)
	}
	defer aqSub.Disconnect()

	// Weather subscriber → weather/data
	weatherSub := mqtt.NewWeatherSubscriber(brokerURL, "weather/data", database)
	if err := weatherSub.Connect(); err != nil {
		log.Printf("⚠️  Weather MQTT subscriber failed to connect: %v", err)
	} else {
		defer weatherSub.Disconnect()
	}

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
