# Flow Diagrams — PolyOrch

## 1. System Architecture Flow Diagram

The diagram below illustrates component interactions inside the single Docker container:

```mermaid
flowchart TD
    subgraph Container ["Single Docker Container: devilhunter21/polyorch"]
        UI["ReactJS Frontend Assets<br/>(Embedded / Served on :8080)"] <-->|HTTP / WebSockets| API["Go Core API Server<br/>(Gin / Fiber Framework)"]
        
        API <--> DB[("SQLite Database<br/>/data/polyorch.db (WAL Mode)")]
        API <-->|Publish Tasks| NATS["NATS Server<br/>(JetStream Engine)"]
        
        NATS <-->|Consume & Stream Logs| Worker["Go Worker Engine<br/>(os/exec Subprocess Runner)"]
        
        Worker -->|Unpack Payload| Temp[/"Tmp Directory<br/>(/tmp/runs/run_id/)"/]
        
        ProcessManager["Supervisord Init Daemon"] -->|Monitors & Restarts| NATS
        ProcessManager -->|Monitors & Restarts| API
        ProcessManager -->|Monitors & Restarts| Worker
    end

    Client["Browser / User"] <==>|Port 8080| UI
```

---

## 2. Project Versioning & Deployment Sequence Flow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as React UI (Monaco)
    participant API as Go API Engine
    participant DB as SQLite DB (WAL)

    User->>UI: Save Project (Multi-file bundle)
    UI->>API: POST /api/v1/projects/{id}/deploy
    API->>API: Read Files & Compress to ZIP Buffer
    API->>DB: Query Latest Version Number
    DB-->>API: v1.0.1
    API->>DB: INSERT INTO project_versions (v1.0.2, BLOB)
    DB-->>API: Success
    API-->>UI: 201 Created (Version v1.0.2 Deployed)
```

---

## 3. Workflow Execution & Real-Time Log Streaming Flow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as React UI (xterm.js)
    participant API as Go API Engine
    participant NATS as NATS JetStream
    participant Worker as Go Worker Engine
    participant DB as SQLite DB
    participant Proc as Script Subprocess (Python/Node)

    User->>UI: Click "Run Workflow"
    UI->>API: POST /api/v1/workflows/{id}/run
    API->>NATS: Publish to "tasks.execute" (run_id: 8921)
    API-->>UI: 202 Accepted (run_id: 8921)
    
    UI->>API: Connect WebSocket /ws/logs/8921
    API->>NATS: Subscribe to "logs.8921"
    
    NATS-->>Worker: Deliver Task Payload (run_id: 8921)
    Worker->>DB: Fetch ZIP BLOB for Version
    DB-->>Worker: Return Binary Archive BLOB
    Worker->>Worker: Unpack ZIP to /tmp/runs/run_8921/
    
    Worker->>Proc: Exec: python3 main.py
    
    loop Real-Time Log Streaming
        Proc-->>Worker: Standard I/O output line
        Worker->>NATS: Publish to "logs.8921"
        NATS-->>API: Stream Event
        API-->>UI: Send WebSocket Frame
        UI->>UI: Render in xterm.js terminal
    end

    Proc-->>Worker: Exit Code 0
    Worker->>DB: UPDATE workflow_runs SET status='SUCCESS'
    Worker->>Worker: Remove /tmp/runs/run_8921/
