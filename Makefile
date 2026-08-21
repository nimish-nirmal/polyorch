GO := go
NPM := npm
DOCKER := docker
IMAGE := polyorch/all-in-one
TAG := latest

.PHONY: help deps vendor build-api build-worker build-frontend build run docker-build docker-run docker-stop clean test lint fmt

help:
	@echo "PolyOrch Make Targets"
	@echo "  deps           - Download Go and npm dependencies"
	@echo "  vendor         - Vendor Go dependencies into ./vendor/"
	@echo "  build-api      - Build Go API binary (uses vendor if present)"
	@echo "  build-worker   - Build Go worker binary (uses vendor if present)"
	@echo "  build-frontend - Build React frontend"
	@echo "  build          - Build API, worker, and frontend"
	@echo "  run            - Build and run locally with supervisord"
	@echo "  docker-build   - Build Docker image (offline-friendly)"
	@echo "  docker-run     - Start Docker Compose"
	@echo "  docker-stop    - Stop Docker Compose"
	@echo "  clean          - Remove build artifacts"
	@echo "  test           - Run tests"
	@echo "  lint           - Run linter"
	@echo "  fmt            - Format Go code"

deps:
	$(GO) mod tidy
	cd web && $(NPM) install

vendor:
	@if [ ! -d "vendor" ] || [ -z "$$(ls -A vendor 2>/dev/null)" ]; then \
		bash scripts/vendor-deps.sh; \
	else \
		echo "Vendor directory already exists. Remove vendor/ to re-vendor."; \
	fi

VENDOR_FLAG :=
ifneq ($(shell test -d vendor && test -f vendor/modules.txt && test -d vendor/github.com && echo yes),)
VENDOR_FLAG := -mod=vendor
endif

build-api:
	$(GO) build $(VENDOR_FLAG) -o bin/polyorch-api ./cmd/api

build-worker:
	$(GO) build $(VENDOR_FLAG) -o bin/polyorch-worker ./cmd/worker

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
