# ============================================================
#  AQ Backend — Makefile
# ============================================================

# Binary output path
BIN        := ./bin/server
# Entry point package
MAIN       := ./cmd/server

# Database / MQTT defaults (override on the command line or via .env)
DATABASE_URL ?= postgres://aquser:aqpass@localhost:5433/airquality?sslmode=disable
MQTT_BROKER  ?= tcp://108.181.187.75:1883
MQTT_USER    ?= mqttx
MQTT_PASS    ?= pass@123
MQTT_TOPIC   ?= airquality/data
PORT         ?= 8081

# Go tool flags
GOFLAGS    := CGO_ENABLED=0
LDFLAGS    := -ldflags="-s -w"

.PHONY: all build run dev tidy lint test clean docker-build docker-run help

## Default target
all: build

# ── Build ────────────────────────────────────────────────────
## Compile the binary into ./bin/server
build:
	@echo "🔨 Building $(BIN)..."
	@mkdir -p bin
	$(GOFLAGS) go build $(LDFLAGS) -o $(BIN) $(MAIN)
	@echo "✅ Build complete → $(BIN)"

# ── Run ──────────────────────────────────────────────────────
## Run the compiled binary (builds first if needed)
run: build
	@echo "🛑 Stopping Docker backend if running..."
	@docker stop aq_backend 2>/dev/null || true
	@echo "🚀 Starting server on :$(PORT)..."
	DATABASE_URL="$(DATABASE_URL)" \
	MQTT_BROKER="$(MQTT_BROKER)" \
	MQTT_USER="$(MQTT_USER)" \
	MQTT_PASS="$(MQTT_PASS)" \
	MQTT_TOPIC="$(MQTT_TOPIC)" \
	PORT="$(PORT)" \
	$(BIN)

## Run directly with `go run` (no compile step — useful during dev)
dev:
	@echo "🛑 Stopping Docker backend if running..."
	@docker stop aq_backend 2>/dev/null || true
	@echo "🔄 Running with go run (dev mode)..."
	DATABASE_URL="$(DATABASE_URL)" \
	MQTT_BROKER="$(MQTT_BROKER)" \
	MQTT_USER="$(MQTT_USER)" \
	MQTT_PASS="$(MQTT_PASS)" \
	MQTT_TOPIC="$(MQTT_TOPIC)" \
	PORT="$(PORT)" \
	go run $(MAIN)

# ── Dependencies ─────────────────────────────────────────────
## Download and tidy Go modules
tidy:
	@echo "📦 Running go mod tidy..."
	go mod tidy
	@echo "✅ go.mod and go.sum updated"

## Download all dependencies
deps:
	@echo "📦 Downloading dependencies..."
	go mod download

# ── Code quality ─────────────────────────────────────────────
## Run go vet (built-in static analysis)
lint:
	@echo "🔍 Running go vet..."
	go vet ./...
	@echo "✅ go vet passed"

## Run all tests
test:
	@echo "🧪 Running tests..."
	go test -v -race ./...

## Run tests with coverage report
test-cover:
	@echo "🧪 Running tests with coverage..."
	go test -v -race -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html
	@echo "✅ Coverage report → coverage.html"

# ── Docker helpers ────────────────────────────────────────────
## Build just the backend Docker image
docker-build:
	@echo "🐳 Building Docker image aq_backend..."
	docker build -t aq_backend:latest .
	@echo "✅ Image built: aq_backend:latest"

## Run the full stack via Docker Compose (from the project root)
docker-up:
	@echo "🐳 Starting all services with Docker Compose..."
	docker compose -f ../docker-compose.yml up --build

## Stop all Docker Compose services
docker-down:
	docker compose -f ../docker-compose.yml down

## Show backend container logs
docker-logs:
	docker logs -f aq_backend

# ── Cleanup ───────────────────────────────────────────────────
## Remove compiled binary and coverage files
clean:
	@echo "🧹 Cleaning up..."
	@rm -rf bin coverage.out coverage.html
	@echo "✅ Clean"

# ── Help ──────────────────────────────────────────────────────
## Print this help message
help:
	@echo ""
	@echo "  AQ Backend — available targets"
	@echo ""
	@grep -E '^## ' Makefile | sed 's/## /  /' | \
		paste - <(grep -E '^[a-z_-]+:' Makefile | sed 's/:.*//' ) | \
		awk '{printf "  \033[36m%-18s\033[0m %s\n", $$2, $$1}'
	@echo ""
	@echo "  Overridable variables (export or pass on command line):"
	@echo "    DATABASE_URL  = $(DATABASE_URL)"
	@echo "    MQTT_BROKER   = $(MQTT_BROKER)"
	@echo "    MQTT_TOPIC    = $(MQTT_TOPIC)"
	@echo "    PORT          = $(PORT)"
	@echo ""
