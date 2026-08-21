# Product Requirements Document (PRD) — PolyOrch

<!-- Defines what PolyOrch does, why it exists, and what it must accomplish -->
<!-- Audience: product managers, engineers, stakeholders -->

## 1. Executive Summary

<!-- The "why" — problem statement and solution -->

**PolyOrch** is a lightweight, ultra-fast task and Directed Acyclic Graph (DAG) orchestration engine designed for high-density, low-overhead polyglot workload execution. It solves the operational complexity of enterprise orchestrators (e.g., Apache Airflow, Prefect, Dagster) by embedding all control plane components, event queues, databases, worker loops, and Web UI assets inside a **single container image** managed by Supervisord.

### The Problem with Modern Orchestrators

| Pain Point | Current Tools | PolyOrch Solution |
| :--- | :--- | :--- |
| **Operational Complexity** | Airflow requires multiple services: scheduler, webserver, metadata DB, Redis, Celery workers | Single container, single process manager |
| **Slow Startup** | Airflow takes 30+ seconds to initialize | Sub-2 second cold start |
| **High Resource Usage** | Airflow uses 1GB+ RAM idle | < 40 MB RAM overhead |
| **External Dependencies** | Requires Postgres, Redis, RabbitMQ | SQLite WAL + NATS embedded |
| **Complex Deployment** | Kubernetes, Helm charts, multiple configs | `docker run` or `docker compose up` |
| **Log Aggregation** | Requires ELK, Loki, or CloudWatch | Real-time WebSocket streaming built-in |
| **Version Management** | External artifact repos, DVC, etc. | Immutable ZIP snapshots in SQLite |

---

## 2. Goals & Objectives

<!-- Measurable success criteria for the project -->

* **Sub-2-Second Cold Start:** Container must boot up completely and accept job triggers in under 2 seconds.
  - *Measured from `docker run` to `curl /health` returning 200 OK*
  - *Includes Supervisord startup, NATS init, DB open, API listen*

* **Low Memory Footprint:** Whole engine overhead must stay under 40 MB of RAM idle.
  - *Measured with `docker stats` after 60 seconds idle*
  - *Includes NATS, Go API, and Go Worker processes*

* **Single-Container Self-Containment:** Zero external infrastructure dependencies.
  - *No external Redis, Postgres, or RabbitMQ required*
  - *All data persists to mounted Docker volume `/data/`*

* **Polyglot Execution Support:** Dynamic runtime support for Python 3, Node.js, Bash, and binary executables.
  - *Runtime detected from `manifest.json`*
  - *Subprocess isolation via `os/exec`*

* **Real-time Log Observability:** Sub-100ms log streaming latency from worker stdout/stderr to browser UI terminals.
  - *Measured from subprocess write to browser render*
  - *Uses NATS Pub/Sub + WebSocket bridge*

---

## 3. Functional Requirements

<!-- What the system must do — organized by feature area -->

### 3.1 Project & Code Management

<!-- Users need to create projects and deploy code versions -->

* **FR-01 (Multi-file Upload):** Users must be able to deploy multi-file code structures containing custom imports and helper modules.
  - *Implementation: ZIP upload via multipart form*
  - *Supports nested directories, custom imports, config files*
  - *Max upload size: configurable, default 50MB*

* **FR-02 (Immutable Versioning):** Code packages must be compressed into `.zip` archives and stored in SQLite BLOB format with automatic incrementing tags (`v1.0.0`, `v1.0.1`).
  - *Implementation: ZIP compressed in memory, stored as BLOB*
  - *Version tags auto-increment semver-style*
  - *Each version is immutable — no edits after deployment*

* **FR-03 (Rollback Capability):** Operators can instantly set any past version snapshot as active for workflow runs.
  - *Implementation: `is_active` flag on `project_versions` table*
  - *One-click activate from UI or API*
  - *No downtime — next run uses rolled-back version*

### 3.2 Workflow Orchestration & Execution

<!-- Users need to run their code in isolated, monitored environments -->

* **FR-04 (DAG Dependency Resolution):** Go Control Plane must validate visual graph dependencies to prevent circular execution loops before dispatching tasks.
  - *Planned for Phase 4+*
  - *Topological sort of task graph*
  - *Cycle detection with error response*

* **FR-05 (Isolated Temp Unpacking):** Each worker execution must unpack code bundles into an isolated ephemeral path (`/tmp/runs/{run_id}`) and clean up on completion.
  - *Implementation: `os.MkdirAll` + `zip.NewReader`*
  - *Cleanup via `defer os.RemoveAll`*
  - *No shared state between runs*

* **FR-06 (Subprocess Isolation):** Tasks run under strict OS subprocess execution limiters (`os/exec`) with configurable timeout rules.
  - *Implementation: `exec.CommandContext` with timeout*
  - *Default timeout: 300 seconds*
  - *Configurable per `manifest.json`*

### 3.3 Event Queue & Messaging

<!-- Async communication between API and Worker -->

* **FR-07 (Task Distribution via JetStream):** API publishes task triggers to NATS JetStream topics (`tasks.execute`), guaranteed by persistent stream backings.
  - *Implementation: `js.Publish` with stream `WORKFLOW_TASKS`*
  - *At-least-once delivery guaranteed by JetStream*
  - *Pull-based consumer in worker*

* **FR-08 (Pub/Sub Log Channels):** Logs are streamed dynamically per execution run to dedicated NATS subjects (`logs.{run_id}`).
  - *Implementation: Worker publishes to `logs.{run_id}`*
  - *API subscribes and forwards to WebSocket clients*
  - *Subject auto-created on first publish*

### 3.4 Web IDE & Control Panel

<!-- Visual interface for managing projects and viewing runs -->

* **FR-09 (Monaco IDE Integration):** Embedded multi-tab editor for syntax highlighting across Python, JS, JSON, and Shell scripts.
  - *Implementation: `@monaco-editor/react` wrapper*
  - *Languages: python, javascript, json, shell*
  - *Dark theme (`vs-dark`)*

* **FR-10 (React Flow Visualizer):** Dynamic canvas showing job status color indicators (Running, Success, Failed, Retrying).
  - *Implementation: `reactflow` canvas with custom nodes*
  - *Status colors: pending=gray, running=blue, success=green, failed=red*
  - *Auto-fit view on load*

* **FR-11 (xterm.js WebSockets):** Real-time terminal output stream attached directly to execution handles.
  - *Implementation: `xterm` + `xterm-addon-fit`*
  - *WebSocket connection to `/ws/logs/{run_id}`*
  - *Auto-scroll, dark theme, ANSI color support*

---

## 4. Non-Functional Requirements

<!-- How the system must behave — quality attributes -->

* **NFR-01 (Reliability & Crash Recovery):** Supervisord automatically restarts crashed sub-processes (`nats-server`, `polyorch-api`, `polyorch-worker`) without killing the host Docker container.
  - *Config: `autorestart=true` in `supervisord.conf`*
  - *Process group ensures coordinated restarts*
  - *Data persists to Docker volume, not container filesystem*

* **NFR-02 (Persistence Isolation):** All DB tables and NATS queue streams persist to `/data/` mounted host volumes.
  - *SQLite DB: `/data/polyorch.db`*
  - *NATS JetStream: `/data/nats/`*
  - *Docker volume `polyorch_data` mounted to `/data`*

* **NFR-03 (Security Isolation):** Subprocesses execute under non-root runtime constraints with constrained environment variables.
  - *Container runs as non-root user (configurable)*
  - *Environment variables injected from `manifest.json` only*
  - *No shell injection — direct command execution via `os/exec`*

* **NFR-04 (API Key Authentication):** Optional API key authentication via `X-API-Key` header.
  - *Configurable via `POLYORCH_API_KEY` environment variable*
  - *Skipped for `/health` and `/swagger/*` endpoints*
  - *Disabled when `POLYORCH_API_KEY` is empty*

* **NFR-05 (CORS Support):** Configurable CORS middleware for cross-origin requests.
  - *Allow all origins by default (configurable)*
  - *Allow methods: GET, POST, PUT, DELETE, OPTIONS*
  - *Allow headers: Content-Type, Authorization*

---

## 5. User Personas

<!-- Who uses PolyOrch and why -->

### Data Engineer
- **Needs:** Run ETL pipelines, schedule data transformations, monitor job status
- **Wants:** Fast iteration, easy debugging, real-time logs
- **How PolyOrch helps:** Upload Python/Node code, run with one click, see logs instantly

### DevOps Engineer
- **Needs:** Reliable orchestration, minimal operational overhead, easy deployment
- **Wants:** Single container, low resource usage, auto-restart on failure
- **How PolyOrch helps:** One Docker image, Supervisord manages everything, volume-mounted persistence

### Platform Engineer
- **Needs:** API-first architecture, extensibility, integration with existing tools
- **Wants:** REST API, WebSocket events, Swagger docs
- **How PolyOrch helps:** Gin-based REST API, WebSocket log streaming, Swagger UI

### ML Engineer
- **Needs:** Run training scripts, experiment with code versions, track results
- **Wants:** Version control for experiments, rollback capability, isolated execution
- **How PolyOrch helps:** Immutable versioning, ZIP-based code snapshots, isolated temp directories

---

## 6. Success Metrics

<!-- How we measure success post-launch -->

| Metric | Target | Measurement Method |
| :--- | :--- | :--- |
| **Cold Start Time** | < 2 seconds | `time docker run` to first `200 OK` |
| **Idle RAM Usage** | < 40 MB | `docker stats` after 60s idle |
| **Log Streaming Latency** | < 100 ms | Timestamp diff between worker write and browser render |
| **API Response Time (p95)** | < 200 ms | Load test with 100 concurrent requests |
| **Worker Task Throughput** | 10+ tasks/sec | Benchmark with synthetic workloads |
| **Docker Image Size** | < 200 MB | `docker images polyorch/all-in-one` |
| **Uptime (with Supervisord)** | 99.9%+ | Process crash → auto-restart in < 1 second |

---

## 7. Out of Scope (v1.0)

<!-- What we are NOT building in the first version -->

- **DAG Dependency Resolution:** Visual graph validation is planned for v1.1+
- **Scheduled Triggers:** Cron-based scheduling is planned for v1.2+
- **Authentication & RBAC:** Multi-user support is planned for v1.3+
- **Cluster Mode:** Horizontal scaling with multiple workers is planned for v2.0+
- **Plugin System:** Custom runtime plugins are planned for v2.0+
- **Metrics Export:** Prometheus metrics endpoint is planned for v1.1+

---

## 8. Dependencies & Assumptions

<!-- External factors that affect the project -->

* **Go 1.22+:** Required for building the backend. Go modules used for dependency management.
* **Node.js 20+:** Required for building the frontend. npm used for package management.
* **Docker Engine:** Required for containerized deployment. Docker Compose v2+ recommended.
* **Alpine Linux Packages:** `nats-server`, `python3`, `nodejs`, `sqlite`, `supervisor` available in Alpine 3.19 repositories.
* **Browser Support:** Modern browsers (Chrome, Firefox, Edge, Safari) with WebSocket and ES2020 support.

---

## 9. Revision History

| Version | Date | Author | Changes |
| :--- | :--- | :--- | :--- |
| 1.0 | 2026-08-21 | PolyOrch Team | Initial PRD with core requirements |
