GO := go
NPM := npm
DOCKER := docker
IMAGE := devilhunter21/polyorch
TAG := latest

.PHONY: help deps build-api build-worker build-frontend build run docker-build docker-run docker-stop clean test lint fmt

help:
	@echo "PolyOrch Make Targets"
	@echo "  deps           - Download Go and npm dependencies"
	@echo "  build-api      - Build Go API binary"
	@echo "  build-worker   - Build Go worker binary"
	@echo "  build-frontend - Build React frontend"
	@echo "  build          - Build API, worker, and frontend"
	@echo "  run            - Build and run locally with supervisord"
	@echo "  docker-build   - Build Docker image"
	@echo "  docker-run     - Start Docker Compose"
	@echo "  docker-stop    - Stop Docker Compose"
	@echo "  clean          - Remove build artifacts"
	@echo "  test           - Run tests"
	@echo "  lint           - Run linter"
	@echo "  fmt            - Format Go code"

deps:
	$(GO) mod tidy
	cd web && $(NPM) install

build-api:
	$(GO) build -mod=mod -o bin/polyorch-api ./cmd/api

build-worker:
	$(GO) build -mod=mod -o bin/polyorch-worker ./cmd/worker

build-frontend:
	cd web && $(NPM) run build

build: build-api build-worker build-frontend

run: build
	supervisord -c scripts/supervisord.conf

docker-build:
	$(DOCKER) build --build-arg BUILDKIT_INLINE_CACHE=1 -t $(IMAGE):$(TAG) .

docker-run:
	docker-compose up -d

docker-stop:
	docker-compose down

clean:
	rm -rf bin web/dist

test:
	@echo "No tests yet"

lint:
	@command -v golangci-lint >/dev/null 2>&1 && golangci-lint run || echo "lint not configured"

fmt:
	$(GO) fmt ./...
