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

### Product Direction: Lightweight Airflow

PolyOrch is not intended to reproduce the full Apache Airflow platform. It provides the smallest useful set of Airflow-like capabilities for teams that want workflows-as-code, task dependencies, scheduling, run history, and live observability without a separate metadata database, broker cluster, scheduler fleet, or webserver stack.

The core product model is:

* A **project** contains immutable workflow versions.
* A **workflow version** contains a manifest and one or more tasks.
* A **DAG run** executes one selected version and records its task states.
* A **task** is a discrete command with a runtime, timeout, retry policy, and dependencies.
* The **web UI** is used to inspect, trigger, pause, retry, and debug runs; workflow definitions remain version-controlled code.

PolyOrch should remain API-first, single-container friendly, and understandable on a laptop. Airflow terminology is used where it improves clarity, but PolyOrch will avoid Airflow-specific provider, executor, and deployment complexity unless a future requirement justifies it.

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
    - *Target: Phase 1 of the lightweight Airflow roadmap*
  - *Topological sort of task graph*
  - *Cycle detection with error response*
    - *A run may start only when all dependencies for a task have succeeded*

* **FR-04a (Workflow-as-Code Manifest):** A workflow version must support a declarative manifest containing workflow metadata and task definitions.
    - *Required task fields: id, runtime, entrypoint or command*
    - *Optional fields: depends_on, environment, timeout, retries, retry_delay*
    - *The manifest is immutable once uploaded and is tied to the selected version*

* **FR-04b (Task Execution):** The worker must execute independent ready tasks and persist task-level state.
    - *States: queued, running, success, failed, skipped, retrying, cancelled*
    - *Independent tasks may run concurrently within configured worker limits*
    - *The workflow run succeeds only when all required tasks succeed*
    - *A failed task blocks dependent tasks unless the run is explicitly retried*

* **FR-04c (Retries and Reruns):** Operators must be able to retry a failed task or rerun a complete workflow version.
    - *Retries are bounded by the task retry policy*
    - *A rerun always records the exact immutable project version used*
    - *Retry and rerun actions must be visible in run history*

* **FR-05 (Isolated Temp Unpacking):** Each worker execution must unpack code bundles into an isolated ephemeral path (`/tmp/runs/{run_id}`) and clean up on completion.
  - *Implementation: `os.MkdirAll` + `zip.NewReader`*
  - *Cleanup via `defer os.RemoveAll`*
  - *No shared state between runs*

* **FR-06 (Subprocess Isolation):** Tasks run under strict OS subprocess execution limiters (`os/exec`) with configurable timeout rules.
  - *Implementation: `exec.CommandContext` with timeout*
  - *Default timeout: 300 seconds*
  - *Configurable per `manifest.json`*

* **FR-06a (Run Selection):** A user must be able to run any uploaded workflow version, regardless of whether it is active.
    - *The active version is the default for the project-level Run action*
    - *Each version must expose its own Run action*
    - *Run details must show the selected version tag and immutable version ID*

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

* **FR-08a (Task Log Streams):** Logs must be attributable to both a workflow run and a task.
    - *The UI must show logs while a task is running, not only after completion*
    - *Historical logs remain available after the WebSocket disconnects*
    - *The log view must indicate connection state and support clearing a run's logs*

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

* **FR-12 (Run and Task History):** The UI must provide a scannable history of workflow runs and task states.
    - *Show selected version, trigger source, start time, finish time, duration, and final status*
    - *Allow filtering by project, version, and status in a future history view*
    - *Allow deletion of obsolete runs and their logs*

* **FR-13 (Workflow Graph):** The graph view must display actual task nodes and dependency edges from the selected workflow version.
    - *Node color and status update while a run is executing*
    - *The graph must fit responsive containers and remain usable on narrow screens*
    - *A single-entrypoint workflow is represented as one task, never as an empty graph*

### 3.5 Scheduling and Operations

* **FR-14 (Manual Trigger):** Operators can manually trigger any uploaded version and immediately receive a run ID.

* **FR-15 (Cron Scheduling):** A workflow may define a cron schedule and the scheduler may create runs for the configured version.
    - *Schedules are paused by default when a project is first created*
    - *Only one scheduler loop is active in a single-container deployment*
    - *Missed schedules do not create an unbounded backlog*

* **FR-16 (Pause and Resume):** Operators can pause and resume a workflow schedule without deleting its versions or run history.

* **FR-17 (Health and Cleanup):** The system exposes health for API, database, NATS, and worker readiness and cleans temporary run directories after completion.

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

* **NFR-06 (Understandable Local Operation):** A developer must be able to run the API, worker, NATS, and frontend locally with documented commands and no hidden service dependency.

* **NFR-07 (Deterministic Version Runs):** Every run must reference one immutable version ID; changing the active version must not change an already-created run.

* **NFR-08 (Responsive Observability):** The dashboard, graph, run history, file viewer, and live log console must remain usable from 360px mobile width through desktop layouts without horizontal layout breakage.

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
| **Task State Freshness** | < 2 seconds | UI reflects worker task state while a run is active |
| **Version Run Accuracy** | 100% | Run executes the exact selected immutable version |

---

## 7. Product Roadmap and Scope

<!-- What we are NOT building in the first version -->

### Lightweight Airflow MVP

* Declarative multi-task manifest with `depends_on`
* DAG validation and topological execution
* Task-level status, duration, retries, and logs
* Manual runs for any immutable workflow version
* Responsive graph, run history, and live log views
* SQLite persistence and NATS JetStream delivery

### Phase 2: Scheduling and Reliability

* Cron schedules with pause/resume
* Retry failed tasks and rerun failed branches
* Backfill a bounded date range
* Run concurrency limits and worker capacity indicators
* Exportable run and task metadata

### Phase 3: Team and Platform Features

* Roles and project-level access control
* Prometheus-compatible metrics
* Notifications and completion callbacks
* Additional runtime adapters and secrets integration

### Explicitly Out of Scope

* Airflow provider compatibility or Airflow DAG import compatibility
* A distributed scheduler or multi-region control plane
* Kubernetes-native executor management
* Replacing a full data catalog, lineage system, or warehouse

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
| 1.1 | 2026-08-27 | PolyOrch Team | Added lightweight Airflow product direction, multi-task DAG requirements, scheduling roadmap, version selection, task observability, and responsive UI requirements |
