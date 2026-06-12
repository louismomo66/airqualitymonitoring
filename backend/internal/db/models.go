package db

import (
	"database/sql"
	"fmt"
	"time"
)

// ── Device ────────────────────────────────────────────────────────────────

type Device struct {
	ID           int      `json:"id"`
	IMEI         string   `json:"imei"`
	Name         *string  `json:"name"`
	Location     *string  `json:"location"`
	Lat          *float64 `json:"lat"`
	Lng          *float64 `json:"lng"`
	DeviceType   string   `json:"device_type"` // "aq" | "weather"
	RegisteredAt time.Time `json:"registered_at"`
	LastSeen     time.Time `json:"last_seen"`
}

// UpsertDevice inserts a new device or touches last_seen on conflict.
func UpsertDevice(db *sql.DB, imei, deviceType string) (int, error) {
	var id int
	err := db.QueryRow(`
		INSERT INTO devices (imei, device_type, last_seen)
		VALUES ($1, $2, NOW())
		ON CONFLICT (imei) DO UPDATE SET last_seen = NOW()
		RETURNING id
	`, imei, deviceType).Scan(&id)
	return id, err
}

func ListDevices(db *sql.DB) ([]Device, error) {
	rows, err := db.Query(`
		SELECT id, imei, name, location, lat, lng, device_type, registered_at, last_seen
		FROM devices ORDER BY last_seen DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Device
	for rows.Next() {
		var d Device
		if err := rows.Scan(&d.ID, &d.IMEI, &d.Name, &d.Location,
			&d.Lat, &d.Lng, &d.DeviceType, &d.RegisteredAt, &d.LastSeen); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

func GetDevice(db *sql.DB, imei string) (*Device, error) {
	var d Device
	err := db.QueryRow(`
		SELECT id, imei, name, location, lat, lng, device_type, registered_at, last_seen
		FROM devices WHERE imei = $1
	`, imei).Scan(&d.ID, &d.IMEI, &d.Name, &d.Location,
		&d.Lat, &d.Lng, &d.DeviceType, &d.RegisteredAt, &d.LastSeen)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &d, err
}

// ── AQ Reading ────────────────────────────────────────────────────────────

type Reading struct {
	ID         int64     `json:"id"`
	DeviceID   int       `json:"device_id"`
	IMEI       string    `json:"imei"`
	PM1_0      *float64  `json:"pm1_0"`
	PM2_5      *float64  `json:"pm2_5"`
	PM10       *float64  `json:"pm10"`
	ShieldTemp *float64  `json:"shield_temp"`
	ShieldHum  *float64  `json:"shield_hum"`
	BoardTemp  *float64  `json:"board_temp"`
	BoardHum   *float64  `json:"board_hum"`
	ReceivedAt time.Time `json:"received_at"`
}

type ReadingFilter struct {
	From *time.Time
	To   *time.Time
}

func InsertReading(db *sql.DB, r Reading) error {
	_, err := db.Exec(`
		INSERT INTO readings
			(device_id, imei, pm1_0, pm2_5, pm10, shield_temp, shield_hum, board_temp, board_hum)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
	`, r.DeviceID, r.IMEI, r.PM1_0, r.PM2_5, r.PM10,
		r.ShieldTemp, r.ShieldHum, r.BoardTemp, r.BoardHum)
	return err
}

func buildWhereClause(imei string, f ReadingFilter) (string, []interface{}) {
	where := "WHERE imei = $1"
	args := []interface{}{imei}
	idx := 2
	if f.From != nil {
		where += fmt.Sprintf(" AND received_at >= $%d", idx)
		args = append(args, *f.From)
		idx++
	}
	if f.To != nil {
		where += fmt.Sprintf(" AND received_at <= $%d", idx)
		args = append(args, *f.To)
		idx++
	}
	_ = idx
	return where, args
}

func ListReadings(db *sql.DB, imei string, limit, offset int, f ReadingFilter) ([]Reading, error) {
	where, args := buildWhereClause(imei, f)
	idx := len(args) + 1
	query := fmt.Sprintf(`
		SELECT id, device_id, imei, pm1_0, pm2_5, pm10,
		       shield_temp, shield_hum, board_temp, board_hum, received_at
		FROM (SELECT * FROM readings %s ORDER BY received_at DESC LIMIT $%d OFFSET $%d) sub
		ORDER BY received_at ASC
	`, where, idx, idx+1)
	args = append(args, limit, offset)
	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Reading
	for rows.Next() {
		var r Reading
		if err := rows.Scan(&r.ID, &r.DeviceID, &r.IMEI,
			&r.PM1_0, &r.PM2_5, &r.PM10,
			&r.ShieldTemp, &r.ShieldHum, &r.BoardTemp, &r.BoardHum,
			&r.ReceivedAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func LatestReading(db *sql.DB, imei string) (*Reading, error) {
	var r Reading
	err := db.QueryRow(`
		SELECT id, device_id, imei, pm1_0, pm2_5, pm10,
		       shield_temp, shield_hum, board_temp, board_hum, received_at
		FROM readings WHERE imei = $1 ORDER BY received_at DESC LIMIT 1
	`, imei).Scan(&r.ID, &r.DeviceID, &r.IMEI,
		&r.PM1_0, &r.PM2_5, &r.PM10,
		&r.ShieldTemp, &r.ShieldHum, &r.BoardTemp, &r.BoardHum, &r.ReceivedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &r, err
}

func CountReadings(db *sql.DB, imei string, f ReadingFilter) (int, error) {
	where, args := buildWhereClause(imei, f)
	var n int
	err := db.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM readings %s", where), args...).Scan(&n)
	return n, err
}

// ── Weather Reading ───────────────────────────────────────────────────────

type WeatherReading struct {
	ID            int64     `json:"id"`
	DeviceID      int       `json:"device_id"`
	IMEI          string    `json:"imei"`
	WindSpeed     *float64  `json:"wind_speed"`
	WindDirection *int      `json:"wind_direction"`
	TotalRainfall *float64  `json:"total_rainfall"`
	RainfallRate  *float64  `json:"rainfall_rate"`
	Bme0Temp      *float64  `json:"bme0_temp"`
	Bme0Hum       *float64  `json:"bme0_hum"`
	Htu0Temp      *float64  `json:"htu0_temp"`
	Htu0Hum       *float64  `json:"htu0_hum"`
	Sht0Temp      *float64  `json:"sht0_temp"`
	Sht0Hum       *float64  `json:"sht0_hum"`
	Aht0Temp      *float64  `json:"aht0_temp"`
	Aht0Hum       *float64  `json:"aht0_hum"`
	Bme1Temp      *float64  `json:"bme1_temp"`
	Bme1Hum       *float64  `json:"bme1_hum"`
	Htu1Temp      *float64  `json:"htu1_temp"`
	Htu1Hum       *float64  `json:"htu1_hum"`
	Sht1Temp      *float64  `json:"sht1_temp"`
	Sht1Hum       *float64  `json:"sht1_hum"`
	Aht1Temp      *float64  `json:"aht1_temp"`
	Aht1Hum       *float64  `json:"aht1_hum"`
	Bme2Temp      *float64  `json:"bme2_temp"`
	Bme2Hum       *float64  `json:"bme2_hum"`
	Htu2Temp      *float64  `json:"htu2_temp"`
	Htu2Hum       *float64  `json:"htu2_hum"`
	Sht2Temp      *float64  `json:"sht2_temp"`
	Sht2Hum       *float64  `json:"sht2_hum"`
	Aht2Temp      *float64  `json:"aht2_temp"`
	Aht2Hum       *float64  `json:"aht2_hum"`
	ReceivedAt    time.Time `json:"received_at"`
}

func InsertWeatherReading(db *sql.DB, r WeatherReading) error {
	_, err := db.Exec(`
		INSERT INTO weather_readings (
			device_id, imei, wind_speed, wind_direction, total_rainfall, rainfall_rate,
			bme0_temp, bme0_hum, htu0_temp, htu0_hum, sht0_temp, sht0_hum, aht0_temp, aht0_hum,
			bme1_temp, bme1_hum, htu1_temp, htu1_hum, sht1_temp, sht1_hum, aht1_temp, aht1_hum,
			bme2_temp, bme2_hum, htu2_temp, htu2_hum, sht2_temp, sht2_hum, aht2_temp, aht2_hum
		) VALUES (
			$1,$2,$3,$4,$5,$6,
			$7,$8,$9,$10,$11,$12,$13,$14,
			$15,$16,$17,$18,$19,$20,$21,$22,
			$23,$24,$25,$26,$27,$28,$29,$30
		)`,
		r.DeviceID, r.IMEI, r.WindSpeed, r.WindDirection, r.TotalRainfall, r.RainfallRate,
		r.Bme0Temp, r.Bme0Hum, r.Htu0Temp, r.Htu0Hum, r.Sht0Temp, r.Sht0Hum, r.Aht0Temp, r.Aht0Hum,
		r.Bme1Temp, r.Bme1Hum, r.Htu1Temp, r.Htu1Hum, r.Sht1Temp, r.Sht1Hum, r.Aht1Temp, r.Aht1Hum,
		r.Bme2Temp, r.Bme2Hum, r.Htu2Temp, r.Htu2Hum, r.Sht2Temp, r.Sht2Hum, r.Aht2Temp, r.Aht2Hum,
	)
	return err
}

func ListWeatherReadings(db *sql.DB, imei string, limit, offset int, f ReadingFilter) ([]WeatherReading, error) {
	where, args := buildWhereClause(imei, f)
	idx := len(args) + 1
	query := fmt.Sprintf(`
		SELECT id, device_id, imei, wind_speed, wind_direction, total_rainfall, rainfall_rate,
			bme0_temp, bme0_hum, htu0_temp, htu0_hum, sht0_temp, sht0_hum, aht0_temp, aht0_hum,
			bme1_temp, bme1_hum, htu1_temp, htu1_hum, sht1_temp, sht1_hum, aht1_temp, aht1_hum,
			bme2_temp, bme2_hum, htu2_temp, htu2_hum, sht2_temp, sht2_hum, aht2_temp, aht2_hum,
			received_at
		FROM (SELECT * FROM weather_readings %s ORDER BY received_at DESC LIMIT $%d OFFSET $%d) sub
		ORDER BY received_at ASC
	`, where, idx, idx+1)
	args = append(args, limit, offset)
	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []WeatherReading
	for rows.Next() {
		var r WeatherReading
		if err := rows.Scan(
			&r.ID, &r.DeviceID, &r.IMEI, &r.WindSpeed, &r.WindDirection, &r.TotalRainfall, &r.RainfallRate,
			&r.Bme0Temp, &r.Bme0Hum, &r.Htu0Temp, &r.Htu0Hum, &r.Sht0Temp, &r.Sht0Hum, &r.Aht0Temp, &r.Aht0Hum,
			&r.Bme1Temp, &r.Bme1Hum, &r.Htu1Temp, &r.Htu1Hum, &r.Sht1Temp, &r.Sht1Hum, &r.Aht1Temp, &r.Aht1Hum,
			&r.Bme2Temp, &r.Bme2Hum, &r.Htu2Temp, &r.Htu2Hum, &r.Sht2Temp, &r.Sht2Hum, &r.Aht2Temp, &r.Aht2Hum,
			&r.ReceivedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func LatestWeatherReading(db *sql.DB, imei string) (*WeatherReading, error) {
	var r WeatherReading
	err := db.QueryRow(`
		SELECT id, device_id, imei, wind_speed, wind_direction, total_rainfall, rainfall_rate,
			bme0_temp, bme0_hum, htu0_temp, htu0_hum, sht0_temp, sht0_hum, aht0_temp, aht0_hum,
			bme1_temp, bme1_hum, htu1_temp, htu1_hum, sht1_temp, sht1_hum, aht1_temp, aht1_hum,
			bme2_temp, bme2_hum, htu2_temp, htu2_hum, sht2_temp, sht2_hum, aht2_temp, aht2_hum,
			received_at
		FROM weather_readings WHERE imei = $1 ORDER BY received_at DESC LIMIT 1
	`, imei).Scan(
		&r.ID, &r.DeviceID, &r.IMEI, &r.WindSpeed, &r.WindDirection, &r.TotalRainfall, &r.RainfallRate,
		&r.Bme0Temp, &r.Bme0Hum, &r.Htu0Temp, &r.Htu0Hum, &r.Sht0Temp, &r.Sht0Hum, &r.Aht0Temp, &r.Aht0Hum,
		&r.Bme1Temp, &r.Bme1Hum, &r.Htu1Temp, &r.Htu1Hum, &r.Sht1Temp, &r.Sht1Hum, &r.Aht1Temp, &r.Aht1Hum,
		&r.Bme2Temp, &r.Bme2Hum, &r.Htu2Temp, &r.Htu2Hum, &r.Sht2Temp, &r.Sht2Hum, &r.Aht2Temp, &r.Aht2Hum,
		&r.ReceivedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &r, err
}

func CountWeatherReadings(db *sql.DB, imei string, f ReadingFilter) (int, error) {
	where, args := buildWhereClause(imei, f)
	var n int
	err := db.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM weather_readings %s", where), args...).Scan(&n)
	return n, err
}
