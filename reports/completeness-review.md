# Completeness Review Report — PolyOrch

**Date:** 2026-08-21
**Scope:** Full codebase (Go backend, React frontend, Docker, CI/CD, docs)
**Auditor:** Automated agent review
**Status:** MAJOR completeness gaps found

---

## CRITICAL — Feature Broken or Missing

### C1. WebSocket live log streaming is completely non-functional
**Files:** `internal/worker/engine.go:219-224` · `internal/websocket/handler.go:66` · `cmd/api/main.go:87`

**Bugs found:**
1. `streamOutput()` only writes to SQLite — never publishes to NATS
2. WebSocket handler subscribes to `WORKFLOW_TASKS` stream with `logs.{run_id}` filter, but that stream only has subject `tasks.execute`
3. No `WORKFLOW_LOGS` stream exists for log subjects
4. Frontend requests `/ws/logs/${runId}` but backend registers `/api/v1/ws/:run_id`

**Impact:** The signature "real-time log streaming" feature is completely broken. No logs reach the browser.

---

### C2. CreateVersion ignores uploaded manifest file
**File:** `internal/handlers/projects.go:108`

**Description:**
```go
version, err := s.DB.CreateVersion(projectID, versionTag, "{}", buf)
```

Always stores `"{}"` as manifest, ignoring any uploaded `manifest` form file. Workers cannot determine runtime/entrypoint.

**Impact:** Every workflow run fails because the worker cannot parse the manifest.

---

### C3. WebSocket path mismatch between frontend and backend
**Files:** `src/components/Terminal.tsx:16` · `cmd/api/main.go:87`

- Frontend connects to: `/ws/logs/${runId}`
- Backend registers: `/api/v1/ws/:run_id`

**Impact:** WebSocket connection 404s, causing reconnect storm (10 retries with exponential backoff on every mount).

---

## HIGH — Missing Features Referenced in Docs

### H1. No DAG dependency resolution
**Files:** `PRD.md:26` · `ARCHITECTURE.md` · `FLOWDIAGRAM.md`

Docs describe DAG validation and visual graph dependencies, but no DAG model, no topological sort, no cycle detection exists in code.

**Impact:** Users cannot create or validate DAG workflows as advertised.

---

### H2. No version auto-increment logic
**File:** `internal/database/store.go`

Docs describe semver auto-increment (`v1.0.0` → `v1.0.1`), but `CreateVersion` accepts any `versionTag` from the client without validation or auto-generation.

**Impact:** Version collisions possible; manual version management required.

---

### H3. No rollback API endpoint
**File:** `internal/handlers/projects.go`

Docs and README describe "instant rollback" but there's no dedicated rollback endpoint — only `SetActiveVersion` which requires knowing the version ID.

**Impact:** Operators cannot easily rollback to previous versions.

---

### H4. Frontend connects to wrong API base on GitHub Pages
**File:** `src/services/api.ts:3-8`

Hardcoded URL points to `https://nimish-nirmal.github.io/polyorch/api/v1` which is a static file host — it cannot serve API responses. The backend runs on a separate server.

**Impact:** GitHub Pages deployment cannot function without a separate backend.

---

### H5. No Swagger docs actually generated
**File:** `cmd/api/main.go:94-96`

```go
if viper.GetBool("swagger_enabled") {
    handlers.SetupSwagger(router.Group(""))
}
```

`swagger_enabled` is never set to true by default, and no swagger annotations exist in handlers.

**Impact:** `/swagger/index.html` returns 404.

---

## MEDIUM — Incomplete Implementation

### M1. Dashboard shows hardcoded mock data
**File:** `src/pages/Dashboard.tsx:88-100`

Stats cards and recent runs table use hardcoded values instead of API data.

**Impact:** Dashboard is misleading — shows fake operational metrics.

---

### M2. File editor shows wrong file
**File:** `src/pages/ProjectDetail.tsx:189-203`

The `<select>` handler mutates `versionFiles` instead of tracking selection. `CodeEditor` always renders the first file regardless of selection.

**Impact:** Users cannot browse files in a version.

---

### M3. No upload progress or error feedback
**File:** `src/pages/ProjectDetail.tsx` · `src/hooks/useProjects.ts`

File upload has no progress indicator. Errors are silently swallowed by bare `catch {}`.

**Impact:** Poor UX for large uploads.

---

### M4. Worker NATS consumer uses wrong stream for logs
**File:** `internal/websocket/handler.go:66`

The WebSocket handler creates a consumer on `WORKFLOW_TASKS` stream for log subjects. Even if a `WORKFLOW_LOGS` stream existed, this would be the wrong stream.

**Impact:** Log streaming cannot work even after fixing C1.

---

### M5. No timeout on WebSocket NATS consumer
**File:** `internal/websocket/handler.go:86-93`

```go
msg, err := iter.Next()
if err != nil {
    return // exits goroutine silently on any error
}
```

No timeout, no retry, no backoff. A single NATS hiccup kills the log stream for that run.

**Impact:** Log streaming drops silently on transient errors.

---

## LOW — Minor Issues

| # | File | Issue |
|---|---|---|
| L1 | `internal/worker/engine.go:76` | `go e.HandleTask(msg)` — no goroutine limit, unbounded concurrency |
| L2 | `internal/worker/engine.go:122` | `defer os.RemoveAll(runDir)` runs even if unpack fails — could delete existing data |
| L3 | `scripts/entrypoint.sh` | No `chmod` on `/tmp/runs` for non-root user |
| L4 | `Dockerfile` | Frontend build happens in builder stage but not copied if `web/dist` exists |
| L5 | `web/vite.config.ts` | `server.proxy` path `/api/v1` doesn't match actual API prefix |
| L6 | `docs/` | Empty directory — no sample projects included |
| L7 | `Makefile` | `make run` doesn't check if NATS is already running |
| L8 | `internal/models/models.go` | No validation on `Manifest` fields (runtime, entrypoint, timeout) |
| L9 | `internal/handlers/projects.go:102` | `src.Read(buf)` may do partial read — should use `io.ReadAll` |
| L10 | `FLOWDIAGRAM.md` | Diagram references `WORKFLOW_TASKS` stream for logs — incorrect |

---

## Recommended Fix Order

1. **C1** — Fix auth middleware ordering (one-line change)
2. **C2** — Fix WebSocket auth + stream routing
3. **C3** — Fix CORS configuration
4. **C4** — Align client/server auth headers
5. **H1** — Add `WORKFLOW_LOGS` stream and NATS publish from worker
6. **H2** — Fix CreateVersion to accept manifest
7. **H3** — Fix WebSocket path mismatch
8. **H4** — Add version auto-increment
9. **H5** — Add rollback endpoint
10. **M1-M5** — Medium priority fixes
