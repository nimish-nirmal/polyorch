# Phase & Execution Plan — PolyOrch Development Roadmap

## 🎯 Phase 0: Project Setup & Base Architecture (Week 1)
* [ ] **Repository Setup:** Initialize Go module (`go mod init polyorch`), React frontend (`Vite + React + Tailwind`), and standard project directory layout.
* [ ] **Supervisord Configuration:** Write baseline `supervisord.conf` to supervise NATS, API, and Worker processes in a single Alpine container.
* [ ] **Containerization:** Create initial multi-stage `Dockerfile` and verify single-container boot time under 2 seconds.

---

## 🗄️ Phase 1: Storage Layer & Core API (Weeks 2–3)
* [ ] **SQLite Integration:** Implement SQLite driver with `WAL` (Write-Ahead Logging) mode enabled (`_journal_mode=WAL`).
* [ ] **Database Migrations:** Create schema tables for `projects`, `project_versions`, `workflow_runs`, and `execution_logs`.
* [ ] **Project Packaging Engine:** Implement zip memory compression handler for multi-file uploads (`POST /api/v1/projects`).
* [ ] **Versioning Logic:** Write logic to auto-increment version tags (`v1.0.0` -> `v1.0.1`) and store compressed code BLOBs in SQLite.

---

## ⚡ Phase 2: NATS JetStream Event Pipeline & Worker Execution (Weeks 4–5)
* [ ] **NATS JetStream Setup:** Configure persistent stream subjects (`tasks.execute` and `logs.{run_id}`).
* [ ] **Worker Payload Consumer:** Build Go Worker execution loop listening to NATS JetStream task queues.
* [ ] **Ephemeral Workspace Isolator:** Implement unpacker to extract ZIP BLOBs into `/tmp/runs/{run_id}` before execution.
* [ ] **Subprocess Runner (`os/exec`):** Write runtime executor for Python 3, Node.js, and Bash with stdout/stderr line buffering.
* [ ] **Cleanup Hooks:** Ensure `/tmp/runs/{run_id}` directories are reliably removed post-execution via Go `defer` statements.

---

## 📡 Phase 3: Real-Time Log Streaming & Web UI IDE (Weeks 6–7)
* [ ] **WebSocket Gateway:** Build API WebSocket endpoint (`/ws/logs/{run_id}`) bridging NATS log subjects directly to clients.
* [ ] **Web IDE Integration:** Embed `@monaco-editor/react` with tabbed editing for multi-file project views.
* [ ] **Visual DAG Renderer:** Implement `React Flow` canvas to render dependency graphs and reflect live execution states (Pending, Running, Success, Failed).
* [ ] **Terminal Streaming:** Integrate `xterm.js` in React UI for live terminal log streaming via WebSocket connections.

---

## 🧪 Phase 4: Reliability, Testing & Production Hardening (Week 8)
* [ ] **Supervisord Process Recovery Testing:** Simulate process crashes (`kill -9`) on API and NATS to verify auto-restarts without container exit.
* [ ] **Memory & Resource Profiling:** Benchmark idle and load RAM footprint to ensure compliance with the < 40 MB overhead goal.
* [ ] **Documentation Sync:** Finalize `README.md`, `PRD.md`, `ARCHITECTURE.md`, `FLOWDIAGRAM.md`, and Swagger API spec docs.
* [ ] **Tag & Release:** Build and push `polyorch/all-in-one:latest` image to Docker Hub.
