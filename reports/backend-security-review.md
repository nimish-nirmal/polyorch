# Security Review Report — PolyOrch Backend

**Date:** 2026-08-21
**Scope:** Go backend (`cmd/`, `internal/`, `scripts/`, Docker)
**Auditor:** Automated agent review
**Status:** CRITICAL issues found — do not deploy to production without fixes

---

## CRITICAL

### C1. Auth middleware registered after routes — entire API unauthenticated
**File:** `cmd/api/main.go:98-100`
**Lines affected:** 72-100

**Description:**
```go
v1 := router.Group("/api/v1")
{
    v1.POST("/projects", server.CreateProject)
    // ... all 11 routes registered here ...
}

router.GET("/health", handlers.Health)

if apiKey != "" {
    router.Use(middleware.Auth(apiKey)) // DEAD CODE — applies to nothing
}
```

Gin composes handler chains at registration time. Middleware added via `router.Use()` after route registration applies only to routes registered later — and there are none.

**Impact:** The entire API is fully unauthenticated even when `POLYORCH_API_KEY` is set. Anyone with network access can list/create/delete projects, upload code versions (containing executable workflow code), and trigger runs. This is **unauthenticated remote code execution** on workers.

**Before:**
```go
v1 := router.Group("/api/v1")
{
    v1.POST("/projects", server.CreateProject)
    // ... all routes ...
}

if apiKey != "" {
    router.Use(middleware.Auth(apiKey))
}
```

**After:**
```go
v1 := router.Group("/api/v1")
if apiKey != "" {
    v1.Use(middleware.Auth(apiKey))
}
{
    v1.POST("/projects", server.CreateProject)
    // ... all routes ...
}
```

---

### C2. WebSocket has no authentication or per-run authorization
**File:** `internal/websocket/handler.go:32-35`

**Description:**
```go
conn, err := (&websocket.Upgrader{
    ReadBufferSize:  1024,
    WriteBufferSize: 1024,
}).Upgrade(c.Writer, c.Request, nil)
```

`CheckOrigin` is `nil`, so gorilla/websocket applies its default `checkSameOrigin`, which blocks browser-based cross-site WebSocket hijacking. However, any non-browser client (curl, script) omits the `Origin` header entirely — which `checkSameOrigin` treats as **allowed**. `run_id` is parsed as a UUID but never checked against caller permissions.

**Impact:** Anyone can stream live logs for *any* `run_id`. Logs routinely carry secrets, tokens, connection strings, and internal hostnames.

**Before:** No auth, no origin allowlist, no run ownership check
**After:** Add explicit `CheckOrigin` allowlist and short-lived ticket-based auth

---

### C3. CORS wildcard origin + Allow-Credentials
**File:** `internal/middleware/cors.go:11-14`

**Description:**
```go
c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
```

Browsers reject `*` + credentials for credentialed requests, so this config is simultaneously insecure and broken. Combined with no enforced auth (C1), any website a user visits can silently read every API response and issue state-changing requests.

**Before:**
```go
c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
```

**After:**
```go
origin := c.Request.Header.Get("Origin")
if isAllowedOrigin(origin) {
    c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
    c.Writer.Header().Set("Vary", "Origin")
}
```

---

### C4. Header mismatch between client and server guarantees 401
**Files:** `src/services/api.ts:15` · `internal/middleware/auth.go:25`

**Description:**
- Client sends `Authorization: Bearer <token>`
- Server reads `X-API-Key`
- Even after fixing C1, the UI receives 401 on every request

**Before:**
```ts
// client
headers: { 'Authorization': `Bearer ${token}` }
// server
key := c.GetHeader("X-API-Key")
```

**After:**
```ts
// client
headers: { 'X-API-Key': token }
// server — already correct
```

---

## HIGH

### H1. NATS log streaming is completely broken — two bugs
**Files:** `internal/worker/engine.go:219-224` · `internal/websocket/handler.go:66`

**Bug 1:** `streamOutput()` only inserts logs into SQLite. It never publishes to NATS.
```go
func streamOutput(reader io.Reader, runID, streamType string, engine *Engine) {
    scanner := bufio.NewScanner(reader)
    for scanner.Scan() {
        engine.DB.InsertLog(runID, streamType, scanner.Text()) // no NATS publish!
    }
}
```

**Bug 2:** WebSocket handler subscribes to `WORKFLOW_TASKS` stream with filter `logs.{run_id}`, but that stream only has subject `tasks.execute`.
```go
consumer, err := js.CreateOrUpdateConsumer(ctx, "WORKFLOW_TASKS", jetstream.ConsumerConfig{
    FilterSubjects: []string{"logs." + runID.String()}, // never matches
})
```

**Impact:** Live log streaming via WebSocket is completely non-functional. Users see no real-time output.

**Before:** No NATS publish from worker; WS subscribes to wrong stream
**After:** Worker publishes to `logs.{run_id}`; create `WORKFLOW_LOGS` stream; WS subscribes to correct stream

---

### H2. CreateVersion ignores uploaded manifest
**File:** `internal/handlers/projects.go:108`

**Description:**
```go
version, err := s.DB.CreateVersion(projectID, versionTag, "{}", buf)
```

The handler always stores `"{}"` as `manifest_json`, ignoring any uploaded `manifest` file. Workers will fail to parse runtime/entrypoint configuration.

**Before:** `manifestJSON` parameter always `"{}"`
**After:** Read and store actual uploaded manifest

---

### H3. No zip size limit — memory/disk exhaustion
**File:** `internal/handlers/projects.go:102`

**Description:**
```go
buf := make([]byte, file.Size)
if _, err := src.Read(buf); err != nil { ... }
```

An attacker can upload a multi-GB zip, exhausting container memory and disk.

**Before:** No size check
**After:** Enforce `maxUploadSize` (e.g., 50MB)

---

### H4. Arbitrary command execution via manifest runtime
**File:** `internal/worker/executor.go:19-24`

**Description:**
```go
default:
    if strings.Contains(entrypoint, " ") {
        parts := strings.Fields(entrypoint)
        return exec.Command(parts[0], parts[1:]...), nil
    }
    return exec.Command(entrypoint), nil
```

The `default` case allows any executable from the manifest, not just approved runtimes.

**Before:** Accepts any runtime string
**After:** Restrict to allowlist: `python3`, `node`, `bash`

---

### H5. No WebSocket path validation
**File:** `internal/websocket/handler.go:25-30`

**Description:** `run_id` is validated as a UUID, but there's no check that the run exists or that the caller has permission to view it.

**Before:** UUID parse only
**After:** Verify run exists in DB before upgrading connection

---

### H6. No request size limits on API
**File:** `cmd/api/main.go` (no `MaxMultipartMemory` set)

**Description:** Gin's default max multipart memory is 32MB, but it's not explicitly configured. Large requests can exhaust memory.

**Before:** No explicit limit
**After:** `router.MaxMultipartMemory = 50 << 20` (50MB)

---

## MEDIUM

### M1. No rate limiting
**File:** `cmd/api/main.go`

**Description:** No rate limiting on any endpoint. An attacker can flood the API or trigger unlimited runs.

**Fix:** Add rate limiting middleware (e.g., `gin-contrib/limiter`)

### M2. NATS connection has no TLS
**File:** `internal/nats/nats.go:26`

**Description:** NATS connects without TLS. In production, traffic between API/worker and NATS is unencrypted.

**Fix:** Add `nats.RootCAs()`, `nats.Secure()` options when TLS is configured

### M3. Error messages leak internal details
**File:** Multiple handlers

**Description:** `c.JSON(500, gin.H{"error": err.Error()})` exposes SQL errors, file paths, and internal state.

**Fix:** Return generic error messages; log details server-side

### M4. No request ID tracing
**File:** `cmd/api/main.go`

**Description:** No request ID middleware, making it hard to correlate logs across API/worker/NATS.

**Fix:** Add request ID middleware

### M5. SQLite connection pool not configured
**File:** `internal/database/database.go`

**Description:** `sql.DB` defaults may not be optimal for WAL mode.

**Fix:** Set `SetMaxOpenConns`, `SetMaxIdleConns`, `SetConnMaxLifetime`

---

## LOW

| # | File | Issue |
|---|---|---|
| L1 | `scripts/supervisord.conf` | No `stopwaitsecs` — processes get SIGTERM then SIGKILL immediately |
| L2 | `scripts/entrypoint.sh` | `set -e` could cause entrypoint to fail before supervisord starts |
| L3 | `docker-compose.yml` | No `logging` driver configured |
| L4 | `Makefile` | No `docker-push` target for pushing built images |
| L5 | `internal/models/models.go` | `ProjectVersion.FilesBundle` is `[]byte` — loading large versions into memory |
| L6 | `internal/database/store.go` | `GetRunLogs` returns all logs in memory — unbounded for long runs |

---

## Summary

| Severity | Count |
|---|---|
| Critical | 4 |
| High | 6 |
| Medium | 5 |
| Low | 6 |

**Total issues:** 21
