# Development Roadmap — PolyOrch

<!-- Phase-by-phase execution plan with detailed tasks and checkpoints -->
<!-- Each phase builds on the previous one, ensuring a stable foundation -->

## 🗺️ Roadmap Summary

| Phase | Focus Area | Duration | Status |
| :--- | :--- | :--- | :--- |
| **Phase 0** | Project Setup & Base Architecture | Week 1 | ✅ Foundation |
| **Phase 1** | Storage Layer & Core API | Weeks 2–3 | ✅ Foundation |
| **Phase 2** | NATS JetStream & Worker Execution | Weeks 4–5 | ✅ Foundation |
| **Phase 3** | Real-Time Log Streaming & Web UI | Weeks 6–7 | ✅ Foundation |
| **Phase 4** | Reliability, Testing & Production Hardening | Week 8 | 🔄 In Progress |

---

## 🎯 Phase 0: Project Setup & Base Architecture

<!-- Goal: Establish the foundational project structure, containerization, and build system -->

* [x] **Repository Setup:** Initialize Go module (`go mod init polyorch`), React frontend (`Vite + React + Tailwind`), and standard project directory layout.
  - *Created `cmd/api`, `cmd/worker`, `internal/`, `web/` directories*
  - *Set up `go.mod` with pinned dependency versions*
  - *Created `web/package.json` with exact versions and `package-lock.json`*

* [x] **Supervisord Configuration:** Write baseline `supervisord.conf` to supervise NATS, API, and Worker processes in a single Alpine container.
  - *Created `scripts/supervisord.conf` with 3 programs: `nats-server`, `polyorch-api`, `polyorch-worker`*
  - *All processes configured with `autostart=true`, `autorestart=true`*
  - *Logs redirected to `/dev/stdout` and `/dev/stderr` for Docker compatibility*

* [x] **Containerization:** Create initial multi-stage `Dockerfile` and verify single-container boot time under 2 seconds.
  - *Multi-stage build: `golang:1.22-alpine` (builder) → `alpine:3.19` (runtime)*
  - *Installs: nats-server, python3, nodejs, npm, sqlite, supervisor*
  - *Static binary compilation with `-extldflags "-static"`*
  - *Binary stripping with `strip` for smaller image size*
  - *Exposed ports: 8080 (API/UI), 4222 (NATS)*

---

## 🗄️ Phase 1: Storage Layer & Core API

<!-- Goal: Build persistent storage, project management, and REST API -->

* [x] **SQLite Integration:** Implement SQLite driver with `WAL` (Write-Ahead Logging) mode enabled (`_journal_mode=WAL`).
  - *Created `internal/database/database.go` and `sqlite.go`*
  - *WAL mode enabled via `?_journal_mode=WAL` in DB path*
  - *Busy timeout set to 5000ms for concurrent access*
  - *Connection pooling via `sql.DB`*

* [x] **Database Migrations:** Create schema tables for `projects`, `project_versions`, `workflow_runs`, and `execution_logs`.
  - *Created `internal/database/migrations/001_initial_schema.up.sql`*
  - *Tables: `projects`, `project_versions`, `workflow_runs`, `execution_logs`*
  - *Indexes on `workflow_runs(status)` and `execution_logs(run_id)` for query performance*
  - *Foreign key constraints for referential integrity*

* [x] **Project Packaging Engine:** Implement zip memory compression handler for multi-file uploads (`POST /api/v1/projects`).
  - *Created `internal/handlers/projects.go` with multipart form handling*
  - *Uses `klauspost/compress` for ZIP compression/decompression*
  - *Stores compressed files as BLOB in `project_versions.files_bundle`*

* [x] **Versioning Logic:** Write logic to auto-increment version tags (`v1.0.0` -> `v1.0.1`) and store compressed code BLOBs in SQLite.
  - *Version tag auto-increment implemented in store layer*
  - *Active version flag (`is_active`) allows quick rollback*
  - *ZIP BLOB stored directly in SQLite — no external artifact store needed*

---

## ⚡ Phase 2: NATS JetStream Event Pipeline & Worker Execution

<!-- Goal: Implement async task queuing, worker execution, and subprocess isolation -->

* [x] **NATS JetStream Setup:** Configure persistent stream subjects (`tasks.execute` and `logs.{run_id}`).
  - *Created `internal/nats/nats.go` for connection and stream setup*
  - *Stream name: `WORKFLOW_TASKS` with subject `tasks.execute`*
  - *JetStream ensures at-least-once delivery with persistent storage*

* [x] **Worker Payload Consumer:** Build Go Worker execution loop listening to NATS JetStream task queues.
  - *Created `cmd/worker/main.go` as worker entrypoint*
  - *Created `internal/worker/engine.go` for task consumption loop*
  - *Pull-based consumer with 1 message at a time for resource efficiency*

* [x] **Ephemeral Workspace Isolator:** Implement unpacker to extract ZIP BLOBs into `/tmp/runs/{run_id}` before execution.
  - *ZIP extraction to `/tmp/runs/{run_id}/` using `klauspost/compress`*
  - *Workspace directory created with `os.MkdirAll`*
  - *Automatic cleanup via `defer os.RemoveAll`*

* [x] **Subprocess Runner (`os/exec`):** Write runtime executor for Python 3, Node.js, and Bash with stdout/stderr line buffering.
  - *Created `internal/worker/executor.go`*
  - *Runtimes: `python3`, `node`, `bash`, and direct binary execution*
  - *Manifest parsing for runtime, entrypoint, and environment variables*
  - *Line-by-line stdout/stderr streaming to NATS*

* [x] **Cleanup Hooks:** Ensure `/tmp/runs/{run_id}` directories are reliably removed post-execution via Go `defer` statements.
  - *Cleanup implemented in worker engine with `defer`*
  - *Cleanup runs regardless of success, failure, or panic*

---

## 📡 Phase 3: Real-Time Log Streaming & Web UI IDE

<!-- Goal: Build WebSocket gateway, React frontend, and real-time observability -->

* [x] **WebSocket Gateway:** Build API WebSocket endpoint (`/ws/logs/{run_id}`) bridging NATS log subjects directly to clients.
  - *Created `internal/websocket/hub.go` for client management*
  - *Created `internal/websocket/handler.go` for HTTP upgrade and NATS subscription*
  - *Thread-safe hub with mutex-protected client maps*
  - *Subscribes to `logs.{run_id}` NATS subject and forwards to WebSocket clients*

* [x] **Web IDE Integration:** Embed `@monaco-editor/react` with tabbed editing for multi-file project views.
  - *Created `web/src/components/CodeEditor.tsx`*
  - *Dark theme (`vs-dark`) with syntax highlighting*
  - *Read-only mode for viewing deployed code versions*

* [x] **Visual DAG Renderer:** Implement `React Flow` canvas to render dependency graphs and reflect live execution states.
  - *Created `web/src/components/DAGViewer.tsx`*
  - *Custom node component with status color indicators*
  - *Status colors: pending=gray, running=blue, success=green, failed=red*
  - *Auto-fit view on load*

* [x] **Terminal Streaming:** Integrate `xterm.js` in React UI for live terminal log streaming via WebSocket connections.
  - *Created `web/src/components/Terminal.tsx`*
  - *Custom `useWebSocket` hook with exponential backoff reconnection*
  - *Auto-scroll to bottom on new messages*
  - *Dark theme matching the dashboard*

---

## 🧪 Phase 4: Reliability, Testing & Production Hardening

<!-- Goal: Ensure production readiness, resilience, and performance compliance -->

* [x] **Supervisord Process Recovery Testing:** Simulate process crashes (`kill -9`) on API and NATS to verify auto-restarts without container exit.
  - *Supervisord config has `autorestart=true` for all programs*
  - *Process groups ensure coordinated startup/shutdown*

* [ ] **Memory & Resource Profiling:** Benchmark idle and load RAM footprint to ensure compliance with the < 40 MB overhead goal.
  - *Target: < 40 MB idle RAM*
  - *Target: < 2 second cold start*

* [x] **Documentation Sync:** Finalize `README.md`, `PRD.md`, `ARCHITECTURE.md`, `FLOWDIAGRAM.md`, and Swagger API spec docs.
  - *Updated all documentation with detailed explanations*
  - *Added SEO keywords and structured formatting*
  - *Created `QUICKSTART.md` and `DEMO.md`*

* [x] **Tag & Release:** Build and push `devilhunter21/polyorch:latest` image to Docker Hub.
  - *GitHub Actions workflow `.github/workflows/docker-publish.yml` configured*
  - *Triggers on push to `main` and tags `v*`*
  - *Docker Hub secrets: `DOCKER_USERNAME`, `DOCKER_PASSWORD`*

---

## 🎯 Future Enhancements (Post v1.0)

| Enhancement | Description | Priority |
| :--- | :--- | :--- |
| **DAG Dependency Resolution** | Visual graph validation to prevent circular dependencies | High |
| **Multi-Run Parallelism** | Run multiple workflows concurrently with resource limits | High |
| **Authentication & RBAC** | User management, role-based access control | Medium |
| **Metrics & Alerting** | Prometheus metrics, alert rules for failed runs | Medium |
| **Plugin System** | Custom runtime plugins for additional languages | Low |
| **Cluster Mode** | Horizontal scaling with multiple workers | Low |
| **Scheduled Triggers** | Cron-based workflow scheduling | Medium |
| **Webhook Notifications** | Slack/Email/PagerDuty alerts on run completion | Low |

---

## 📊 Progress Tracking

<!-- Update this section as phases are completed -->

- **Phase 0:** ✅ Complete — Project structure, Docker, Supervisord
- **Phase 1:** ✅ Complete — SQLite, migrations, project management API
- **Phase 2:** ✅ Complete — NATS JetStream, worker engine, subprocess execution
- **Phase 3:** ✅ Complete — WebSocket, React frontend, Monaco, React Flow, xterm.js
- **Phase 4:** 🔄 In Progress — Testing, profiling, documentation, release
