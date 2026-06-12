package mqtt

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"os"
	"sync"
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
	brokerURL  string
	topic      string
	database   *sql.DB
	client     pahomqtt.Client

	// guards subscribed flag and the seen-message cache
	mu         sync.Mutex
	subscribed bool
	// recentIDs caches the last 256 MQTT message IDs to drop QoS-1 re-deliveries
	recentIDs  map[uint16]time.Time
}

// NewSubscriber constructs a Subscriber.
func NewSubscriber(brokerURL, topic string, database *sql.DB) *Subscriber {
	return &Subscriber{
		brokerURL: brokerURL,
		topic:     topic,
		database:  database,
		recentIDs: make(map[uint16]time.Time),
	}
}

// Connect establishes the MQTT connection and starts subscribing.
func (s *Subscriber) Connect() error {
	// Unique client ID prevents the broker kicking us out when another
	// instance (or a stale session) uses the same ID.
	clientID := fmt.Sprintf("aq_backend_%d_%d", time.Now().UnixNano(), rand.Intn(9999))

	opts := pahomqtt.NewClientOptions().
		AddBroker(s.brokerURL).
		SetClientID(clientID).
		SetCleanSession(true).
		SetKeepAlive(30 * time.Second).
		SetPingTimeout(10 * time.Second).
		SetAutoReconnect(true).
		SetConnectRetry(true).
		SetConnectRetryInterval(5 * time.Second).
		SetOnConnectHandler(s.onConnect).
		SetConnectionLostHandler(s.onConnectionLost)

	if user := os.Getenv("MQTT_USER"); user != "" {
		opts.SetUsername(user)
	}
	if pass := os.Getenv("MQTT_PASS"); pass != "" {
		opts.SetPassword(pass)
	}

	s.client = pahomqtt.NewClient(opts)

	log.Printf("📡 Connecting to MQTT broker %s as client %s", s.brokerURL, clientID)
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

// onConnect is called each time the client connects/reconnects.
// The mutex ensures we only ever have one active subscription.
func (s *Subscriber) onConnect(c pahomqtt.Client) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.subscribed {
		// Already subscribed — Paho re-subscribes automatically after
		// reconnect when using QoS 1 with CleanSession=false, but we
		// use CleanSession=true so we must re-subscribe. Reset the flag
		// so the subscribe below runs.
		s.subscribed = false
	}

	log.Printf("📡 MQTT connected — subscribing to %s", s.topic)
	token := c.Subscribe(s.topic, 1, s.handleMessage)
	token.Wait()
	if token.Error() != nil {
		log.Printf("❌ Subscribe failed: %v", token.Error())
		return
	}
	s.subscribed = true
	log.Printf("✅ Subscribed to %s", s.topic)
}

// onConnectionLost is called when the connection drops.
func (s *Subscriber) onConnectionLost(_ pahomqtt.Client, err error) {
	s.mu.Lock()
	s.subscribed = false
	s.mu.Unlock()
	log.Printf("⚠️  MQTT connection lost: %v — will auto-reconnect", err)
}

// handleMessage processes each incoming MQTT message.
// MessageID deduplication prevents storing the same QoS-1 message twice
// if the broker re-delivers it during a reconnect window.
func (s *Subscriber) handleMessage(_ pahomqtt.Client, msg pahomqtt.Message) {
	// ── Deduplicate by MQTT message ID ──────────────────────
	s.mu.Lock()
	mid := msg.MessageID()
	if mid != 0 { // QoS 0 messages have ID 0 — can't dedup those by ID
		if _, seen := s.recentIDs[mid]; seen {
			s.mu.Unlock()
			log.Printf("⏭  Dropping duplicate message ID %d", mid)
			return
		}
		s.recentIDs[mid] = time.Now()
		// Evict IDs older than 60 s to keep map small
		for k, t := range s.recentIDs {
			if time.Since(t) > 60*time.Second {
				delete(s.recentIDs, k)
			}
		}
	}
	s.mu.Unlock()
	var p Payload
	if err := json.Unmarshal(msg.Payload(), &p); err != nil {
		log.Printf("❌ Bad payload: %v  raw=%s", err, msg.Payload())
		return
	}

	if p.IMEI == "" {
		log.Printf("❌ Payload missing IMEI, discarding")
		return
	}

	// Auto-register / touch last_seen
	deviceID, err := db.UpsertDevice(s.database, p.IMEI, "aq")
	if err != nil {
		log.Printf("❌ UpsertDevice failed for IMEI %s: %v", p.IMEI, err)
		return
	}

	reading := db.Reading{
		DeviceID:   deviceID,
		IMEI:       p.IMEI,
		PM1_0:      nullIfNegative(p.PM1_0),
		PM2_5:      nullIfNegative(p.PM2_5),
		PM10:       nullIfNegative(p.PM10),
		ShieldTemp: p.ShieldTemp,
		ShieldHum:  p.ShieldHum,
		BoardTemp:  p.BoardTemp,
		BoardHum:   p.BoardHum,
	}

	if err := db.InsertReading(s.database, reading); err != nil {
		// A unique-constraint violation just means a duplicate — log and skip
		log.Printf("⚠️  InsertReading skipped (duplicate?): %v", err)
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
