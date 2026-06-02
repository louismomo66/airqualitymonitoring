package db

import (
	"database/sql"
	"fmt"
	"time"

	_ "github.com/lib/pq"
)

// Connect opens a PostgreSQL connection with retry logic (waits for the
// container to be ready).
func Connect(url string) (*sql.DB, error) {
	var (
		database *sql.DB
		lastErr  error
	)
	for i := 0; i < 10; i++ {
		var openErr error
		database, openErr = sql.Open("postgres", url)
		if openErr != nil {
			lastErr = openErr
			fmt.Printf("⏳ Waiting for database... attempt %d/10 (open: %v)\n", i+1, openErr)
			time.Sleep(3 * time.Second)
			continue
		}
		if pingErr := database.Ping(); pingErr != nil {
			lastErr = pingErr
			fmt.Printf("⏳ Waiting for database... attempt %d/10 (ping: %v)\n", i+1, pingErr)
			database.Close()
			time.Sleep(3 * time.Second)
			continue
		}
		database.SetMaxOpenConns(25)
		database.SetMaxIdleConns(5)
		database.SetConnMaxLifetime(5 * time.Minute)
		return database, nil
	}
	return nil, fmt.Errorf("could not connect to postgres after 10 attempts: %w", lastErr)
}

// Migrate creates the schema on first run.
func Migrate(db *sql.DB) error {
	schema := `
	-- Devices table: auto-registered on first MQTT message
	CREATE TABLE IF NOT EXISTS devices (
		id         SERIAL PRIMARY KEY,
		imei       VARCHAR(20) UNIQUE NOT NULL,
		name       VARCHAR(100),           -- optional friendly name
		location   VARCHAR(200),           -- optional location label
		registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		last_seen  TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	-- Readings table: one row per MQTT message
	CREATE TABLE IF NOT EXISTS readings (
		id          BIGSERIAL PRIMARY KEY,
		device_id   INT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
		imei        VARCHAR(20) NOT NULL,
		pm1_0       NUMERIC(8,2),
		pm2_5       NUMERIC(8,2),
		pm10        NUMERIC(8,2),
		shield_temp NUMERIC(6,2),
		shield_hum  NUMERIC(6,2),
		board_temp  NUMERIC(6,2),
		board_hum   NUMERIC(6,2),
		received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	CREATE INDEX IF NOT EXISTS idx_readings_device_id   ON readings(device_id);
	CREATE INDEX IF NOT EXISTS idx_readings_received_at ON readings(received_at DESC);
	CREATE INDEX IF NOT EXISTS idx_readings_imei        ON readings(imei);
	`
	_, err := db.Exec(schema)
	return err
}
