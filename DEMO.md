# Demo & Showcase — PolyOrch

<!-- Complete demo guide with sample projects, screenshots descriptions, and walkthrough -->
<!-- Use this for presentations, hackathons, or stakeholder demos -->

## 🎬 Demo Overview

This guide walks you through a complete **PolyOrch demonstration** showing:
1. Project creation and versioning
2. Multi-file code upload
3. Workflow execution with real-time logs
4. DAG visualization
5. Version rollback

**Estimated time:** 10–15 minutes

---

## 📦 Pre-Demo Setup

<!-- Run these steps before starting the demo -->

```bash
# 1. Start PolyOrch (Docker is fastest for demos)
git clone https://github.com/nimish-nirmal/polyorch.git
cd polyorch
docker compose up -d

# 2. Verify it's running
curl http://localhost:8082/health

# 3. Open browser
# Navigate to: http://localhost:8082
```

---

## 🎭 Demo Scenario: ETL Pipeline

We'll demonstrate a simple **Extract-Transform-Load (ETL)** pipeline that:
1. Reads a JSON config file
2. Transforms data using a helper module
3. Outputs results to stdout

### Sample Project Structure

```text
etl-demo/
├── manifest.json       # Execution configuration
├── main.py             # Entry point
├── helpers/
│   └── transformer.py  # Data transformation logic
└── config.json         # Pipeline configuration
```

### manifest.json

```json
{
  "name": "ETL Demo Pipeline",
  "runtime": "python3",
  "entrypoint": "main.py",
  "timeout": 60,
  "env": {
    "ENV": "production",
    "DEBUG": "false"
  }
}
```

### main.py

```python
import json
import time
from helpers.transformer import transform

def main():
    print("[ETL] Pipeline started")
    print(f"[ETL] Environment: DEBUG=false")
    
    with open("config.json") as f:
        config = json.load(f)
    
    print(f"[ETL] Loaded {len(config['records'])} records")
    
    transformed = []
    for record in config["records"]:
        result = transform(record)
        transformed.append(result)
        print(f"[ETL] Transformed: {result}")
    
    print(f"[ETL] Pipeline completed successfully. {len(transformed)} records processed.")
    return 0

if __name__ == "__main__":
    exit(main())
```

### helpers/transformer.py

```python
def transform(record):
    """Apply business logic transformation."""
    return {
        "id": record["id"],
        "value": record["value"] * 2,
        "status": "processed"
    }
```

### config.json

```json
{
  "records": [
    {"id": 1, "value": 10},
    {"id": 2, "value": 20},
    {"id": 3, "value": 30}
  ]
}
```

---

## 🎬 Step-by-Step Demo Walkthrough

### Step 1: Create Project (2 min)

1. Navigate to **http://localhost:8082**
2. Click **Projects** in the sidebar
3. Click **New Project**
4. Fill in:
   - **Name:** `ETL Demo Pipeline`
   - **Description:** `Sample ETL pipeline for demonstration`
5. Click **Create**

**Expected:** Project card appears in the list.

---

### Step 2: Upload First Version (2 min)

1. Click on the **ETL Demo Pipeline** project card
2. Click **Deploy New Version**
3. Create a ZIP file containing the sample project files:
   ```bash
   cd docs/sample-project/etl-demo
   zip -r etl-demo-v1.zip .
   ```
4. Upload `etl-demo-v1.zip`
5. Upload `manifest.json`
6. Click **Deploy**

**Expected:**
- Version `v1.0.0` appears in the versions list
- Status shows **Active**

---

### Step 3: Run Workflow (3 min)

1. In the **Versions** section, click **Run** next to `v1.0.0`
2. A new run is created with status **Pending**
3. Click **View Run** to open the detail page

**On the Run Detail page:**

#### A. Watch Status Change
- Status badge changes from **Pending** → **Running** → **Success**
- Timing information updates (Started At, Finished At)

#### B. Watch Live Logs (xterm.js Terminal)
- A terminal appears on the right side
- Logs stream in real-time:
```
[ETL] Pipeline started
[ETL] Environment: DEBUG=false
[ETL] Loaded 3 records
[ETL] Transformed: {'id': 1, 'value': 20, 'status': 'processed'}
[ETL] Transformed: {'id': 2, 'value': 40, 'status': 'processed'}
[ETL] Transformed: {'id': 3, 'value': 60, 'status': 'processed'}
[ETL] Pipeline completed successfully. 3 records processed.
```

#### C. View DAG Visualization (React Flow)
- A canvas shows the workflow DAG
- Nodes represent tasks
- Colors indicate status: Gray (Pending), Blue (Running), Green (Success), Red (Failed)

---

### Step 4: Upload Updated Version (2 min)

1. Go back to the project page
2. Modify `main.py` to add a new feature:
   ```python
   print("[ETL] New feature: parallel processing enabled")
   ```
3. Create a new ZIP: `etl-demo-v2.zip`
4. Deploy as a new version

**Expected:**
- Version `v1.0.1` appears in the list
- `v1.0.0` remains in history
- `v1.0.1` is automatically set as **Active**

---

### Step 5: Run Updated Version (2 min)

1. Click **Run** on `v1.0.1`
2. Open the run detail
3. Observe the new log line:
```
[ETL] Pipeline started
[ETL] New feature: parallel processing enabled
[ETL] Environment: DEBUG=false
...
```

---

### Step 6: Rollback to Previous Version (1 min)

1. Go to the project versions list
2. Click **Activate** on `v1.0.0`
3. Confirm rollback
4. Run `v1.0.0` again
5. Verify the logs no longer contain the "New feature" line

**Expected:**
- `v1.0.0` becomes active
- Run uses the old code
- Instant rollback without redeploying

---

### Step 7: Inspect API (2 min)

Open **http://localhost:8082/swagger/index.html** to explore the REST API:

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/v1/projects` | GET | List all projects |
| `/api/v1/projects` | POST | Create a new project |
| `/api/v1/projects/{id}/versions` | POST | Deploy a new version |
| `/api/v1/runs` | POST | Trigger a workflow run |
| `/api/v1/runs/{id}` | GET | Get run details |
| `/api/v1/runs/{id}/logs` | GET | Get paginated run logs |
| `/health` | GET | Health check |

---

## 📊 Demo Metrics to Highlight

| Metric | Value | Significance |
| :--- | :--- | :--- |
| **Container Boot Time** | < 2 seconds | Faster than most orchestrators |
| **Idle RAM Usage** | < 40 MB | Extremely lightweight |
| **Log Streaming Latency** | < 100 ms | Near real-time observability |
| **Version Rollback Time** | Instant | Zero-downtime deployments |
| **Single Container** | Yes | Simplified operations |

---

## 🎤 Presentation Talking Points

<!-- Use these points when presenting PolyOrch to an audience -->

1. **"One container, everything included"** — No need to manage NATS, API, worker, and frontend separately. Supervisord handles it all.

2. **"Sub-2 second startup"** — Compare to Airflow which takes 30+ seconds to initialize. PolyOrch is ready in under 2 seconds.

3. **"Under 40 MB RAM"** — Airflow scheduler + webserver + database easily uses 1GB+. PolyOrch uses less than a single Airflow worker.

4. **"Immutable versioning built-in"** — Every deployment is a versioned ZIP stored in SQLite. No external artifact repository needed.

5. **"Real-time logs in the browser"** — No need to SSH into containers or use `kubectl logs`. Logs stream directly to the UI via WebSockets.

6. **"Polyglot from day one"** — Run Python, Node.js, Bash, or Go binaries without configuration changes.

7. **"Zero external dependencies"** — SQLite replaces Postgres/MySQL. NATS replaces Redis/RabbitMQ. Everything is embedded.

---

## 🖼️ Screenshot Checklist

<!-- Capture these screenshots for README or documentation -->

- [ ] **Dashboard** — Overview with cards and recent runs table
- [ ] **Projects List** — Empty state and populated state
- [ ] **Project Detail** — Versions list with activate/rollback buttons
- [ ] **Upload Version** — File upload form with manifest editor
- [ ] **Run Detail** — Terminal streaming live logs
- [ ] **DAG Viewer** — React Flow canvas with colored nodes
- [ ] **Swagger Docs** — API documentation page
- [ ] **Docker Logs** — Container startup logs showing all 3 processes
- [ ] **Terminal** — Browser DevTools showing WebSocket frames

---

## 🎯 Advanced Demo Scenarios

### Scenario 1: Multi-File Python Project

Upload a project with custom imports:
```text
ml-pipeline/
├── manifest.json
├── train.py
├── evaluate.py
├── utils/
│   ├── data_loader.py
│   └── metrics.py
└── config.yaml
```

Demonstrate that `train.py` can `from utils.data_loader import load_data` seamlessly.

### Scenario 2: Node.js Project

Upload a Node.js project:
```text
api-mock/
├── manifest.json       # runtime: node, entrypoint: server.js
├── server.js
└── package.json
```

Demonstrate `node server.js` execution with npm dependencies bundled in the ZIP.

### Scenario 3: Bash Script

Upload a shell script:
```text
backup/
├── manifest.json       # runtime: bash, entrypoint: backup.sh
└── backup.sh
```

Demonstrate executing system commands with environment variables.

### Scenario 4: Failure Handling

Create a project that exits with code 1:
```python
import sys
print("Something went wrong")
sys.exit(1)
```

Demonstrate:
- Run status changes to **Failed**
- Terminal shows error output
- Worker cleans up `/tmp/runs/{run_id}` automatically
- Supervisord keeps the worker alive for the next task

---

## 🏆 Success Criteria

A successful demo should show:

- ✅ Container starts in < 2 seconds
- ✅ Dashboard loads with dark theme
- ✅ Project creation is smooth and intuitive
- ✅ Version upload works with multi-file ZIPs
- ✅ Workflow execution triggers automatically
- ✅ Live logs stream to the terminal in real-time
- ✅ DAG visualization updates with status colors
- ✅ Version rollback is instant
- ✅ API is documented in Swagger
- ✅ Container uses < 40 MB RAM idle

---

## 📹 Recording Tips

<!-- For creating a demo video -->

1. **Screen resolution:** 1920x1080 minimum
2. **Browser:** Use Chrome/Edge for best xterm.js rendering
3. **Terminal size:** Make the browser window fullscreen
4. **Narration:** Explain what's happening at each step
5. **Zoom:** Zoom in on the terminal when showing log streaming
6. **Timing:** Keep the entire demo under 15 minutes
7. **Backup plan:** Have Docker Compose ready in case local build fails

---

## 🔗 Demo Resources

- **Live Demo (GitHub Pages):** https://nimish-nirmal.github.io/polyorch/ *(requires backend running)*
- **Docker Image:** `devilhunter21/polyorch:latest`
- **Sample Projects:** See `docs/sample-project/` in this repository
