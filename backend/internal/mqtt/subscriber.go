package mqtt

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"time"

	pahomqtt "github.com/eclipse/paho.mqtt.golang"

	"github.com/airquality/backend/internal/db"
)

// Payload mirrors the JSON published by the ESP32 node.
type Payload struct {
	IMEI       string   `json:"imei"`
	PM1_0      *float64 `json:"pm1_0"`
	PM2_5      *float64 `json:"pm2_5"`
	PM10       *float64 `json:"pm10"`
	ShieldTemp *float64 `json:"shield_temp"`
	ShieldHum  *float64 `json:"shield_hum"`
	BoardTemp  *float64 `json:"board_temp"`
	BoardHum   *float64 `json:"board_hum"`
}

// Subscriber holds the MQTT client and a reference to the database.
type Subscriber struct {
	brokerURL string
	topic     string
	database  *sql.DB
	client    pahomqtt.Client
}

// NewSubscriber constructs a Subscriber.
func NewSubscriber(brokerURL, topic string, database *sql.DB) *Subscriber {
	return &Subscriber{
		brokerURL: brokerURL,
		topic:     topic,
		database:  database,
	}
}

// Connect establishes the MQTT connection and starts subscribing.
func (s *Subscriber) Connect() error {
	opts := pahomqtt.NewClientOptions().
		AddBroker(s.brokerURL).
		SetClientID("aq_backend_subscriber").
		SetAutoReconnect(true).
		SetConnectRetry(true).
		SetConnectRetryInterval(5 * time.Second).
		SetOnConnectHandler(s.onConnect).
		SetConnectionLostHandler(s.onConnectionLost)

	s.client = pahomqtt.NewClient(opts)

	// Retry connection on startup (broker may not be up yet)
	for i := 0; i < 10; i++ {
		if token := s.client.Connect(); token.Wait() && token.Error() == nil {
			log.Printf("✅ Connected to MQTT broker: %s", s.brokerURL)
			return nil
		}
		log.Printf("⏳ MQTT connect attempt %d/10 failed, retrying...", i+1)
		time.Sleep(3 * time.Second)
	}
	return fmt.Errorf("could not connect to MQTT broker %s after 10 attempts", s.brokerURL)
}

// Disconnect cleanly disconnects from the broker.
func (s *Subscriber) Disconnect() {
	s.client.Disconnect(500)
}

// onConnect is called each time the client successfully connects/reconnects.
func (s *Subscriber) onConnect(c pahomqtt.Client) {
	log.Printf("📡 MQTT connected — subscribing to %s", s.topic)
	token := c.Subscribe(s.topic, 1, s.handleMessage)
	token.Wait()
	if token.Error() != nil {
		log.Printf("❌ Subscribe failed: %v", token.Error())
	}
}

// onConnectionLost is called when the connection drops.
func (s *Subscriber) onConnectionLost(_ pahomqtt.Client, err error) {
	log.Printf("⚠️  MQTT connection lost: %v — will auto-reconnect", err)
}

// handleMessage processes each incoming MQTT message.
func (s *Subscriber) handleMessage(_ pahomqtt.Client, msg pahomqtt.Message) {
	var p Payload
	if err := json.Unmarshal(msg.Payload(), &p); err != nil {
		log.Printf("❌ Bad payload: %v  raw=%s", err, msg.Payload())
		return
	}

	if p.IMEI == "" {
		log.Printf("❌ Payload missing IMEI, discarding")
		return
	}

	// Auto-register device (INSERT … ON CONFLICT UPDATE last_seen)
	deviceID, err := db.UpsertDevice(s.database, p.IMEI)
	if err != nil {
		log.Printf("❌ UpsertDevice failed for IMEI %s: %v", p.IMEI, err)
		return
	}

	// Null-out "invalid" sensor values sent as -1 by the firmware
	pm1_0  := nullIfNegative(p.PM1_0)
	pm2_5  := nullIfNegative(p.PM2_5)
	pm10   := nullIfNegative(p.PM10)

	reading := db.Reading{
		DeviceID:   deviceID,
		IMEI:       p.IMEI,
		PM1_0:      pm1_0,
		PM2_5:      pm2_5,
		PM10:       pm10,
		ShieldTemp: p.ShieldTemp,
		ShieldHum:  p.ShieldHum,
		BoardTemp:  p.BoardTemp,
		BoardHum:   p.BoardHum,
	}

	if err := db.InsertReading(s.database, reading); err != nil {
		log.Printf("❌ InsertReading failed: %v", err)
		return
	}

	log.Printf("✅ Stored reading — IMEI: %s  PM2.5: %v  PM10: %v",
		p.IMEI, formatPtr(p.PM2_5), formatPtr(p.PM10))
}

func nullIfNegative(v *float64) *float64 {
	if v == nil || *v < 0 {
		return nil
	}
	return v
}

func formatPtr(v *float64) string {
	if v == nil {
		return "null"
	}
	return fmt.Sprintf("%.2f", *v)
}
