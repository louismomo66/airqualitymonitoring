package db

import (
	"database/sql"
	"fmt"
	"time"

	_ "github.com/lib/pq"
)

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

func Migrate(db *sql.DB) error {
	schema := `
	-- Devices table
	CREATE TABLE IF NOT EXISTS devices (
		id            SERIAL PRIMARY KEY,
		imei          VARCHAR(25) UNIQUE NOT NULL,
		name          VARCHAR(100),
		location      VARCHAR(200),
		lat           DOUBLE PRECISION,
		lng           DOUBLE PRECISION,
		device_type   VARCHAR(10) NOT NULL DEFAULT 'aq',
		registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		last_seen     TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	-- Air quality readings
	CREATE TABLE IF NOT EXISTS readings (
		id          BIGSERIAL PRIMARY KEY,
		device_id   INT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
		imei        VARCHAR(25) NOT NULL,
		pm1_0       NUMERIC(8,2),
		pm2_5       NUMERIC(8,2),
		pm10        NUMERIC(8,2),
		shield_temp NUMERIC(6,2),
		shield_hum  NUMERIC(6,2),
		board_temp  NUMERIC(6,2),
		board_hum   NUMERIC(6,2),
		received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	-- Weather station readings
	CREATE TABLE IF NOT EXISTS weather_readings (
		id               BIGSERIAL PRIMARY KEY,
		device_id        INT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
		imei             VARCHAR(25) NOT NULL,
		wind_speed       NUMERIC(7,2),
		wind_direction   INT,
		total_rainfall   NUMERIC(8,2),
		rainfall_rate    NUMERIC(8,2),
		bme0_temp NUMERIC(6,2), bme0_hum NUMERIC(6,2),
		htu0_temp NUMERIC(6,2), htu0_hum NUMERIC(6,2),
		sht0_temp NUMERIC(6,2), sht0_hum NUMERIC(6,2),
		aht0_temp NUMERIC(6,2), aht0_hum NUMERIC(6,2),
		bme1_temp NUMERIC(6,2), bme1_hum NUMERIC(6,2),
		htu1_temp NUMERIC(6,2), htu1_hum NUMERIC(6,2),
		sht1_temp NUMERIC(6,2), sht1_hum NUMERIC(6,2),
		aht1_temp NUMERIC(6,2), aht1_hum NUMERIC(6,2),
		bme2_temp NUMERIC(6,2), bme2_hum NUMERIC(6,2),
		htu2_temp NUMERIC(6,2), htu2_hum NUMERIC(6,2),
		sht2_temp NUMERIC(6,2), sht2_hum NUMERIC(6,2),
		aht2_temp NUMERIC(6,2), aht2_hum NUMERIC(6,2),
		received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	-- Safe migrations for existing DBs
	ALTER TABLE devices ADD COLUMN IF NOT EXISTS lat         DOUBLE PRECISION;
	ALTER TABLE devices ADD COLUMN IF NOT EXISTS lng         DOUBLE PRECISION;
	ALTER TABLE devices ADD COLUMN IF NOT EXISTS device_type VARCHAR(10) NOT NULL DEFAULT 'aq';

	CREATE INDEX IF NOT EXISTS idx_readings_imei         ON readings(imei);
	CREATE INDEX IF NOT EXISTS idx_readings_received_at  ON readings(received_at DESC);
	CREATE INDEX IF NOT EXISTS idx_weather_imei          ON weather_readings(imei);
	CREATE INDEX IF NOT EXISTS idx_weather_received_at   ON weather_readings(received_at DESC);
	`
	_, err := db.Exec(schema)
	return err
}
