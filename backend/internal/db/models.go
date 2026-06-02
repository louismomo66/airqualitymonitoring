package db

import (
	"database/sql"
	"fmt"
	"time"
)

// Device represents a registered sensor node.
type Device struct {
	ID           int       `json:"id"`
	IMEI         string    `json:"imei"`
	Name         *string   `json:"name"`
	Location     *string   `json:"location"`
	RegisteredAt time.Time `json:"registered_at"`
	LastSeen     time.Time `json:"last_seen"`
}

// Reading represents a single sensor measurement.
type Reading struct {
	ID         int64    `json:"id"`
	DeviceID   int      `json:"device_id"`
	IMEI       string   `json:"imei"`
	PM1_0      *float64 `json:"pm1_0"`
	PM2_5      *float64 `json:"pm2_5"`
	PM10       *float64 `json:"pm10"`
	ShieldTemp *float64 `json:"shield_temp"`
	ShieldHum  *float64 `json:"shield_hum"`
	BoardTemp  *float64 `json:"board_temp"`
	BoardHum   *float64 `json:"board_hum"`
	ReceivedAt time.Time `json:"received_at"`
}

// ReadingFilter holds optional date-range constraints.
type ReadingFilter struct {
	From *time.Time
	To   *time.Time
}

// UpsertDevice inserts a new device or updates last_seen if it already exists.
func UpsertDevice(db *sql.DB, imei string) (int, error) {
	var id int
	err := db.QueryRow(`
		INSERT INTO devices (imei, last_seen)
		VALUES ($1, NOW())
		ON CONFLICT (imei) DO UPDATE
			SET last_seen = NOW()
		RETURNING id
	`, imei).Scan(&id)
	return id, err
}

// InsertReading stores a new air quality reading.
func InsertReading(db *sql.DB, r Reading) error {
	_, err := db.Exec(`
		INSERT INTO readings
			(device_id, imei, pm1_0, pm2_5, pm10,
			 shield_temp, shield_hum, board_temp, board_hum)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`,
		r.DeviceID, r.IMEI,
		r.PM1_0, r.PM2_5, r.PM10,
		r.ShieldTemp, r.ShieldHum,
		r.BoardTemp, r.BoardHum,
	)
	return err
}

// ListDevices returns all registered devices ordered by last seen.
func ListDevices(db *sql.DB) ([]Device, error) {
	rows, err := db.Query(`
		SELECT id, imei, name, location, registered_at, last_seen
		FROM devices
		ORDER BY last_seen DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var devices []Device
	for rows.Next() {
		var d Device
		if err := rows.Scan(
			&d.ID, &d.IMEI, &d.Name, &d.Location,
			&d.RegisteredAt, &d.LastSeen,
		); err != nil {
			return nil, err
		}
		devices = append(devices, d)
	}
	return devices, rows.Err()
}

// GetDevice returns a single device by IMEI.
func GetDevice(db *sql.DB, imei string) (*Device, error) {
	var d Device
	err := db.QueryRow(`
		SELECT id, imei, name, location, registered_at, last_seen
		FROM devices WHERE imei = $1
	`, imei).Scan(&d.ID, &d.IMEI, &d.Name, &d.Location, &d.RegisteredAt, &d.LastSeen)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &d, err
}

// buildWhereClause builds the WHERE clause args for date filtering.
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

// ListReadings returns paginated readings for a device, oldest-first for charting.
func ListReadings(db *sql.DB, imei string, limit, offset int, f ReadingFilter) ([]Reading, error) {
	where, args := buildWhereClause(imei, f)
	idx := len(args) + 1

	// Wrap in a subquery so we page newest-first but return oldest-first to the chart
	query := fmt.Sprintf(`
		SELECT id, device_id, imei, pm1_0, pm2_5, pm10,
		       shield_temp, shield_hum, board_temp, board_hum, received_at
		FROM (
			SELECT * FROM readings %s
			ORDER BY received_at DESC
			LIMIT $%d OFFSET $%d
		) sub
		ORDER BY received_at ASC
	`, where, idx, idx+1)

	args = append(args, limit, offset)

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var readings []Reading
	for rows.Next() {
		var r Reading
		if err := rows.Scan(
			&r.ID, &r.DeviceID, &r.IMEI,
			&r.PM1_0, &r.PM2_5, &r.PM10,
			&r.ShieldTemp, &r.ShieldHum,
			&r.BoardTemp, &r.BoardHum,
			&r.ReceivedAt,
		); err != nil {
			return nil, err
		}
		readings = append(readings, r)
	}
	return readings, rows.Err()
}

// LatestReading returns the most recent reading for a device.
func LatestReading(db *sql.DB, imei string) (*Reading, error) {
	var r Reading
	err := db.QueryRow(`
		SELECT id, device_id, imei, pm1_0, pm2_5, pm10,
		       shield_temp, shield_hum, board_temp, board_hum, received_at
		FROM readings
		WHERE imei = $1
		ORDER BY received_at DESC
		LIMIT 1
	`, imei).Scan(
		&r.ID, &r.DeviceID, &r.IMEI,
		&r.PM1_0, &r.PM2_5, &r.PM10,
		&r.ShieldTemp, &r.ShieldHum,
		&r.BoardTemp, &r.BoardHum,
		&r.ReceivedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &r, err
}

// CountReadings returns the total reading count for a device with optional date filters.
func CountReadings(db *sql.DB, imei string, f ReadingFilter) (int, error) {
	where, args := buildWhereClause(imei, f)
	var count int
	err := db.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM readings %s", where), args...).Scan(&count)
	return count, err
}
