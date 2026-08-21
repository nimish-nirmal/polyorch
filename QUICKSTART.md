# Quick Start Guide — PolyOrch

<!-- Step-by-step setup guide for developers and operators -->
<!-- Covers: prerequisites, local dev, Docker, GitHub Pages frontend, troubleshooting -->

## 📋 Prerequisites

| Tool | Version | Purpose | Install |
| :--- | :--- | :--- | :--- |
| **Go** | 1.22+ | Build API and worker binaries | https://go.dev/dl/ |
| **Node.js** | 20.x | Build React frontend | https://nodejs.org/ |
| **npm** | 9+ | Frontend package manager | Included with Node.js |
| **Docker** | 20.10+ | Container runtime (optional) | https://docs.docker.com/get-docker/ |
| **Docker Compose** | v2+ | Multi-container orchestration (optional) | Included with Docker Desktop |
| **NATS Server** | Latest | JetStream message broker (local dev only) | `go install github.com/nats-io/nats-server/v2@latest` |
| **Git** | 2.30+ | Version control | https://git-scm.com/ |
| **Make** | 4.0+ | Build automation | `apt install make` / `brew install make` |

---

## 🏠 Option A: Local Development (Fastest Iteration)

<!-- Best for: contributors, debugging, frontend development -->

### Step 1: Clone Repository

```bash
git clone https://github.com/nimish-nirmal/polyorch.git
cd polyorch
```

### Step 2: Install Dependencies

```bash
# Install Go dependencies (uses go.mod with pinned versions)
make deps

# Optional: Vendor dependencies for fully offline builds
make vendor
```

> **Note:** `make vendor` creates the `vendor/` directory with all Go dependencies. The Docker build automatically detects and uses `-mod=vendor` when present.

### Step 3: Start NATS JetStream

<!-- NATS is required for task queuing and log streaming -->

```bash
# Start NATS with JetStream enabled, persisting to /tmp/nats
nats-server -js -sd /tmp/nats

# In another terminal, verify it's running
nats server report
```

### Step 4: Build and Run Services

```bash
# Build everything: API binary, worker binary, and frontend
make build

# Run all services via Supervisord
make run
```

**What this does:**
- Builds `bin/polyorch-api` and `bin/polyorch-worker`
- Builds React frontend to `web/dist/`
- Starts Supervisord which manages NATS, API, and Worker

### Step 5: Verify

```bash
# Health check
curl http://localhost:8080/health

# Expected response:
# {"status":"ok"}
```

### Step 6: Open the UI

Visit **http://localhost:8080** in your browser.

---

## 🐳 Option B: Docker Compose (Production-Like)

<!-- Best for: testing production build, demo, offline environments -->

### Step 1: Clone Repository

```bash
git clone https://github.com/nimish-nirmal/polyorch.git
cd polyorch
```

### Step 2: Start the Stack

```bash
# Build image and start container
docker compose up -d

# Follow logs
docker compose logs -f
```

### Step 3: Verify

```bash
# Health check
curl http://localhost:8080/health

# Check container is running
docker compose ps
```

### Step 4: Stop

```bash
# Stop container (data persists in Docker volume)
docker compose down

# Stop and remove volume (WARNING: deletes all data)
docker compose down -v
```

---

## 🔨 Option C: Build Docker Image from Scratch

<!-- Best for: custom builds, ARM64, air-gapped environments -->

```bash
# Build the all-in-one image
docker build -t polyorch/all-in-one:latest .

# Run it
docker run -d \
  --name polyorch \
  -p 8080:8080 \
  -p 4222:4222 \
  -v polyorch_data:/data \
  -e POLYORCH_API_KEY=changeme \
  -e POLYORCH_LOG_LEVEL=info \
  polyorch/all-in-one:latest

# Check logs
docker logs -f polyorch

# Stop
docker stop polyorch && docker rm polyorch
```

---

## 🌐 Frontend Development Mode

<!-- Hot reload for React frontend during development -->

```bash
cd web

# Install dependencies
npm install

# Start Vite dev server with proxy to API
npm run dev
```

Open **http://localhost:5173** — Vite proxies API requests to `http://localhost:8080`.

**To build for production:**
```bash
cd web && npm run build
# Output: web/dist/
```

---

## 🚢 GitHub Pages Deployment

<!-- The frontend auto-deploys to GitHub Pages on push to main -->

The `.github/workflows/deploy-frontend.yml` workflow triggers when files in `web/` change on the `main` branch.

**To enable GitHub Pages:**
1. Go to repository **Settings** → **Pages**
2. Set **Source** to **GitHub Actions**
3. Push a commit that changes files in `web/`
4. The workflow builds and deploys to `https://nimish-nirmal.github.io/polyorch/`

**Vite base path is configured** in `web/vite.config.ts`:
```typescript
base: '/polyorch/'
```

---

## 🔧 Configuration Reference

<!-- All environment variables with defaults -->

### Go Backend

| Variable | Default | Description |
| :--- | :--- | :--- |
| `POLYORCH_PORT` | `8080` | HTTP server port |
| `POLYORCH_DB_PATH` | `/data/polyorch.db` | SQLite database path |
| `POLYORCH_NATS_URL` | `nats://127.0.0.1:4222` | NATS server URL |
| `POLYORCH_RUNS_TMP_DIR` | `/tmp/runs` | Worker temp directory |
| `POLYORCH_LOG_LEVEL` | `info` | Log level (debug, info, warn, error) |
| `POLYORCH_API_KEY` | `""` | API key for auth (empty = disabled) |

### React Frontend (`web/.env`)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `VITE_API_URL` | `http://localhost:8080` | Backend API URL |
| `VITE_WS_URL` | `ws://localhost:8080` | WebSocket URL |

---

## 🐛 Troubleshooting

<!-- Common issues and fixes -->

### Issue: `go: command not found`
**Fix:** Install Go 1.22+ from https://go.dev/dl/ and ensure `$GOPATH/bin` is in your `PATH`.

### Issue: `npm install` fails with peer dependency conflicts
**Fix:** Use `web/.npmrc` which sets `legacy-peer-deps=false`. If issues persist, try `npm install --legacy-peer-deps`.

### Issue: Port 8080 already in use
**Fix:** Change the port in your environment:
```bash
PORT=8081 make run
# Or with Docker:
docker run -p 8081:8081 -e POLYORCH_PORT=8081 polyorch/all-in-one:latest
```

### Issue: NATS connection refused
**Fix:** Ensure NATS server is running:
```bash
nats-server -js -sd /tmp/nats
# Or check Docker container logs:
docker compose logs nats-server
```

### Issue: `/tmp/runs` permission denied
**Fix:** Ensure the directory exists and is writable:
```bash
mkdir -p /tmp/runs && chmod 755 /tmp/runs
```

### Issue: SQLite database locked
**Fix:** SQLite WAL mode handles concurrent reads, but writes are serialized. This is expected behavior. Ensure only one API/worker instance writes at a time.

### Issue: WebSocket logs not streaming
**Fix:**
1. Check browser console for CORS errors
2. Verify `VITE_WS_URL` in `web/.env` matches your API URL
3. Ensure NATS JetStream is running and the stream `WORKFLOW_TASKS` exists

---

## 📦 Make Targets Reference

| Command | Description |
| :--- | :--- |
| `make help` | Show all available targets |
| `make deps` | Install Go and npm dependencies |
| `make vendor` | Vendor Go dependencies into `./vendor/` |
| `make build-api` | Build Go API binary |
| `make build-worker` | Build Go worker binary |
| `make build-frontend` | Build React frontend |
| `make build` | Build all binaries and frontend |
| `make run` | Build and run locally with Supervisord |
| `make docker-build` | Build Docker image |
| `make docker-run` | Start Docker Compose |
| `make docker-stop` | Stop Docker Compose |
| `make clean` | Remove build artifacts |
| `make test` | Run tests |
| `make lint` | Run linter |
| `make fmt` | Format Go code |

---

## 🎯 Next Steps

1. Read **[DEMO.md](DEMO.md)** for a full showcase walkthrough
2. Read **[PRD.md](PRD.md)** to understand product requirements
3. Read **[ARCHITECTURE.md](ARCHITECTURE.md)** for deep-dive architecture
4. Explore the code in `cmd/`, `internal/`, and `web/`
5. Create your first project and upload a code bundle!
