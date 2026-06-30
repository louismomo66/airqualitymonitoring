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

// WeatherPayload mirrors the JSON published by the weather station.
type WeatherPayload struct {
	IMEI          string   `json:"imei"`
	WindSpeed     *float64 `json:"wind_speed"`
	WindDirection *int     `json:"wind_direction"`
	TotalRainfall *float64 `json:"total_rainfall"`
	RainfallRate  *float64 `json:"rainfall_rate"`
	Bme0Temp      *float64 `json:"bme0_temp"`
	Bme0Hum       *float64 `json:"bme0_hum"`
	Htu0Temp      *float64 `json:"htu0_temp"`
	Htu0Hum       *float64 `json:"htu0_hum"`
	Sht0Temp      *float64 `json:"sht0_temp"`
	Sht0Hum       *float64 `json:"sht0_hum"`
	Aht0Temp      *float64 `json:"aht0_temp"`
	Aht0Hum       *float64 `json:"aht0_hum"`
	Bme1Temp      *float64 `json:"bme1_temp"`
	Bme1Hum       *float64 `json:"bme1_hum"`
	Htu1Temp      *float64 `json:"htu1_temp"`
	Htu1Hum       *float64 `json:"htu1_hum"`
	Sht1Temp      *float64 `json:"sht1_temp"`
	Sht1Hum       *float64 `json:"sht1_hum"`
	Aht1Temp      *float64 `json:"aht1_temp"`
	Aht1Hum       *float64 `json:"aht1_hum"`
	Bme2Temp      *float64 `json:"bme2_temp"`
	Bme2Hum       *float64 `json:"bme2_hum"`
	Htu2Temp      *float64 `json:"htu2_temp"`
	Htu2Hum       *float64 `json:"htu2_hum"`
	Sht2Temp      *float64 `json:"sht2_temp"`
	Sht2Hum       *float64 `json:"sht2_hum"`
	Aht2Temp      *float64 `json:"aht2_temp"`
	Aht2Hum       *float64 `json:"aht2_hum"`
}

// WeatherSubscriber subscribes to weather/data and stores readings.
type WeatherSubscriber struct {
	brokerURL  string
	topic      string
	database   *sql.DB
	client     pahomqtt.Client
	mu         sync.Mutex
	subscribed bool
	recentIDs  map[uint16]time.Time
}

func NewWeatherSubscriber(brokerURL, topic string, database *sql.DB) *WeatherSubscriber {
	return &WeatherSubscriber{
		brokerURL: brokerURL,
		topic:     topic,
		database:  database,
		recentIDs: make(map[uint16]time.Time),
	}
}

func (s *WeatherSubscriber) Connect() error {
	clientID := fmt.Sprintf("aq_weather_%d_%d", time.Now().UnixNano(), rand.Intn(9999))
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
	log.Printf("📡 Weather subscriber connecting to %s as %s", s.brokerURL, clientID)
	for i := 0; i < 10; i++ {
		if token := s.client.Connect(); token.Wait() && token.Error() == nil {
			log.Printf("✅ Weather subscriber connected")
			return nil
		}
		log.Printf("⏳ Weather connect attempt %d/10, retrying...", i+1)
		time.Sleep(3 * time.Second)
	}
	return fmt.Errorf("could not connect weather subscriber after 10 attempts")
}

func (s *WeatherSubscriber) Disconnect() { s.client.Disconnect(500) }

func (s *WeatherSubscriber) onConnect(c pahomqtt.Client) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.subscribed = false
	log.Printf("📡 Weather MQTT connected — subscribing to %s", s.topic)
	token := c.Subscribe(s.topic, 1, s.handleMessage)
	token.Wait()
	if token.Error() != nil {
		log.Printf("❌ Weather subscribe failed: %v", token.Error())
		return
	}
	s.subscribed = true
	log.Printf("✅ Weather subscribed to %s", s.topic)
}

func (s *WeatherSubscriber) onConnectionLost(_ pahomqtt.Client, err error) {
	s.mu.Lock()
	s.subscribed = false
	s.mu.Unlock()
	log.Printf("⚠️  Weather MQTT connection lost: %v", err)
}

func (s *WeatherSubscriber) handleMessage(_ pahomqtt.Client, msg pahomqtt.Message) {
	// Dedup by message ID
	s.mu.Lock()
	mid := msg.MessageID()
	if mid != 0 {
		if _, seen := s.recentIDs[mid]; seen {
			s.mu.Unlock()
			return
		}
		s.recentIDs[mid] = time.Now()
		for k, t := range s.recentIDs {
			if time.Since(t) > 60*time.Second {
				delete(s.recentIDs, k)
			}
		}
	}
	s.mu.Unlock()

	var p WeatherPayload
	if err := json.Unmarshal(msg.Payload(), &p); err != nil {
		log.Printf("❌ Weather bad payload: %v", err)
		return
	}
	if p.IMEI == "" {
		log.Printf("❌ Weather payload missing IMEI")
		return
	}

	deviceID, err := db.UpsertDevice(s.database, p.IMEI, "weather")
	if err != nil {
		log.Printf("❌ UpsertDevice (weather) failed for %s: %v", p.IMEI, err)
		return
	}

	r := db.WeatherReading{
		DeviceID: deviceID, IMEI: p.IMEI,
		WindSpeed: p.WindSpeed, WindDirection: p.WindDirection,
		TotalRainfall: p.TotalRainfall, RainfallRate: p.RainfallRate,
		Bme0Temp: p.Bme0Temp, Bme0Hum: p.Bme0Hum,
		Htu0Temp: p.Htu0Temp, Htu0Hum: p.Htu0Hum,
		Sht0Temp: p.Sht0Temp, Sht0Hum: p.Sht0Hum,
		Aht0Temp: p.Aht0Temp, Aht0Hum: p.Aht0Hum,
		Bme1Temp: p.Bme1Temp, Bme1Hum: p.Bme1Hum,
		Htu1Temp: p.Htu1Temp, Htu1Hum: p.Htu1Hum,
		Sht1Temp: p.Sht1Temp, Sht1Hum: p.Sht1Hum,
		Aht1Temp: p.Aht1Temp, Aht1Hum: p.Aht1Hum,
		Bme2Temp: p.Bme2Temp, Bme2Hum: p.Bme2Hum,
		Htu2Temp: p.Htu2Temp, Htu2Hum: p.Htu2Hum,
		Sht2Temp: p.Sht2Temp, Sht2Hum: p.Sht2Hum,
		Aht2Temp: p.Aht2Temp, Aht2Hum: p.Aht2Hum,
	}

	if err := db.InsertWeatherReading(s.database, r); err != nil {
		log.Printf("⚠️  InsertWeatherReading skipped: %v", err)
		return
	}
	log.Printf("✅ Weather reading stored — IMEI: %s  Wind: %s kph",
		p.IMEI, formatPtr2(p.WindSpeed))
}

func formatPtr2(v *float64) string {
	if v == nil { return "null" }
	return fmt.Sprintf("%.1f", *v)
}
