# Product Requirements Document (PRD) — PolyOrch

## 1. Executive Summary
**PolyOrch** is a lightweight, ultra-fast task and Directed Acyclic Graph (DAG) orchestration engine designed for high-density, low-overhead polyglot workload execution. It solves the operational complexity of enterprise orchestrators (e.g., Apache Airflow, Prefect) by embedding all control plane components, event queues, databases, worker loops, and Web UI assets inside a single container image managed by Supervisord.

---

## 2. Goals & Objectives
* **Sub-2-Second Cold Start:** Container must boot up completely and accept job triggers in under 2 seconds.
* **Low Memory Footprint:** Whole engine overhead must stay under 40 MB of RAM idle.
* **Single-Container Self-Containment:** Zero external infrastructure dependencies (no external Redis, Postgres, or RabbitMQ required).
* **Polyglot Execution Support:** Dynamic runtime support for Python 3, Node.js, Bash, and binary executables.
* **Real-time Log Observability:** Sub-100ms log streaming latency from worker stdout/stderr to browser UI terminals.

---

## 3. Functional Requirements

### 3.1 Project & Code Management
* **FR-01 (Multi-file Upload):** Users must be able to deploy multi-file code structures containing custom imports and helper modules.
* **FR-02 (Immutable Versioning):** Code packages must be compressed into `.zip` archives and stored in SQLite BLOB format with automatic incrementing tags (`v1.0.0`, `v1.0.1`).
* **FR-03 (Rollback Capability):** Operators can instantly set any past version snapshot as active for workflow runs.

### 3.2 Workflow Orchestration & Execution
* **FR-04 (DAG Dependency Resolution):** Go Control Plane must validate visual graph dependencies to prevent circular execution loops before dispatching tasks.
* **FR-05 (Isolated Temp Unpacking):** Each worker execution must unpack code bundles into an isolated ephemeral path (`/tmp/runs/{run_id}`) and clean up on completion.
* **FR-06 (Subprocess Isolation):** Tasks run under strict OS subprocess execution limiters (`os/exec`) with configurable timeout rules.

### 3.3 Event Queue & Messaging
* **FR-07 (Task Distribution via JetStream):** API publishes task triggers to NATS JetStream topics (`tasks.execute`), guaranteed by persistent stream backings.
* **FR-08 (Pub/Sub Log Channels):** Logs are streamed dynamically per execution run to dedicated NATS subjects (`logs.{run_id}`).

### 3.4 Web IDE & Control Panel
* **FR-09 (Monaco IDE Integration):** Embedded multi-tab editor for syntax highlighting across Python, JS, JSON, and Shell scripts.
* **FR-10 (React Flow Visualizer):** Dynamic canvas showing job status color indicators (Running, Success, Failed, Retrying).
* **FR-11 (xterm.js WebSockets):** Real-time terminal output stream attached directly to execution handles.

---

## 4. Non-Functional Requirements
* **NFR-01 (Reliability & Crash Recovery):** Supervisord automatically restarts crashed sub-processes (`nats-server`, `polyorch-api`, `polyorch-worker`) without killing the host Docker container.
* **NFR-02 (Persistence Isolation):** All DB tables and NATS queue streams persist to `/data/` mounted host volumes.
* **NFR-03 (Security Isolation):** Subprocesses execute under non-root runtime constraints with constrained environment variables.
