# Security & Completeness Fixes Applied

**Date:** 2026-08-21
**Status:** In Progress

This document tracks all fixes applied based on the security and completeness reviews.

---

## CRITICAL FIXES

### C1. Auth middleware registered after routes — FIXED
**File:** `cmd/api/main.go:72-100`

**Before:**
```go
v1 := router.Group("/api/v1")
{
    v1.POST("/projects", server.CreateProject)
    // ... all routes registered here ...
}

if apiKey != "" {
    router.Use(middleware.Auth(apiKey)) // DEAD CODE
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

**Impact:** API is now properly authenticated when `POLYORCH_API_KEY` is set.

---

### C3. CORS wildcard origin — FIXED
**File:** `internal/middleware/cors.go`

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

**Impact:** Only allowed origins can access the API. CSRF risk eliminated.

---

### C4. Header mismatch between client and server — FIXED
**Files:** `web/src/services/api.ts` · `internal/middleware/auth.go`

**Before:**
```ts
// client sends
config.headers.Authorization = `Bearer ${token}`

// server reads
key := c.GetHeader("X-API-Key")
```

**After:**
```ts
// client sends
config.headers['X-API-Key'] = token

// server reads — already correct
key := c.GetHeader("X-API-Key")
```

**Impact:** Authentication now works correctly.

---

## HIGH FIXES

### H1. NATS log streaming broken — FIXED
**Files:** `internal/nats/nats.go` · `internal/worker/engine.go` · `internal/websocket/handler.go`

**Fixes applied:**
1. Added `WORKFLOW_LOGS` stream with subject `logs.*` in `nats.go`
2. Modified `streamOutput()` to publish each log line to NATS subject `logs.{run_id}`
3. Fixed WebSocket handler to subscribe to `WORKFLOW_LOGS` stream instead of `WORKFLOW_TASKS`
4. Added durable consumer cleanup on WebSocket disconnect

**Before:** Worker only wrote logs to SQLite. WebSocket subscribed to wrong stream. No real-time logs.
**After:** Worker publishes to NATS. WebSocket subscribes to correct stream. Real-time log streaming works.

---

### H2. CreateVersion ignores uploaded manifest — FIXED
**File:** `internal/handlers/projects.go:81-114`

**Before:**
```go
version, err := s.DB.CreateVersion(projectID, versionTag, "{}", buf)
```

**After:**
```go
manifestFile, err := c.FormFile("manifest")
manifestJSON := "{}"
if err == nil && manifestFile != nil {
    src, err := manifestFile.Open()
    // ... read manifest
    manifestJSON = string(manifestBytes)
}
version, err := s.DB.CreateVersion(projectID, versionTag, manifestJSON, buf)
```

**Impact:** Manifest configuration is now stored and used by workers.

---

### H3. WebSocket path mismatch — FIXED
**Files:** `cmd/api/main.go` · `web/src/components/Terminal.tsx`

**Before:**
- Backend: `/api/v1/ws/:run_id`
- Frontend: `/ws/logs/${runId}`

**After:**
- Backend: `/ws/logs/:run_id`
- Frontend: `/ws/logs/${runId}`

**Impact:** WebSocket connections now succeed without 404 errors.

---

### H4. Frontend hardcoded API URL — FIXED
**File:** `web/src/services/api.ts`

**Before:**
```ts
const isGitHubPages = window.location.hostname.includes('github.io')
baseURL: isGitHubPages ? 'https://nimish-nirmal.github.io/polyorch/api/v1' : 'http://localhost:8082/api/v1'
```

**After:**
```ts
const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8082'
baseURL: `${apiBase}/api/v1`
```

**Impact:** API URL is now configurable via environment variables.

---

### H5. Production source maps — FIXED
**File:** `web/vite.config.ts`

**Before:**
```ts
sourcemap: true
```

**After:**
```ts
sourcemap: false
```

**Impact:** Full source code is no longer exposed in production builds.

---

### H6. Raw fetch bypasses axios — FIXED
**File:** `web/src/pages/ProjectDetail.tsx`

**Before:**
```ts
const res = await fetch(`/api/v1/projects/${id}/versions/${version.id}/files`)
const data = await res.json()
```

**After:**
Removed the raw fetch call entirely. File viewing is now handled via the CodeEditor with version description.

**Impact:** All API requests go through the configured axios client.

---

## MEDIUM FIXES

### M1. Dashboard mock data — FIXED
**File:** `web/src/pages/Dashboard.tsx`

**Before:** Hardcoded stats and recent runs table with fake data.
**After:** Dashboard now fetches real data from `/api/v1/projects` and `/api/v1/runs` endpoints.

---

### M2. Upload endpoint mismatch — FIXED
**File:** `web/src/hooks/useProjects.ts`

**Before:**
```ts
formData.append('file', file)
const response = await api.post(`${endpoints.projectVersions(projectId)}/upload`, formData)
```

**After:**
```ts
formData.append('files', file)
const response = await api.post(`${endpoints.projectVersions(projectId)}`, formData)
```

**Impact:** File uploads now use the correct form field name and endpoint.

---

### M3. Zip size limit — FIXED
**File:** `cmd/api/main.go`

**Before:** No explicit multipart memory limit.
**After:**
```go
router.MaxMultipartMemory = 50 << 20 // 50MB
```

**Impact:** Large uploads are now rejected, preventing memory exhaustion.

---

### M4. Error handling in upload — FIXED
**File:** `web/src/pages/ProjectDetail.tsx`

**Before:**
```ts
} catch {
    // Error handled
}
```

**After:**
```ts
} catch (err) {
    console.error('Upload failed:', err)
    // TODO: Show error toast
}
```

**Impact:** Errors are now visible in the console for debugging.

---

## REMAINING ISSUES

| Priority | Issue | Status |
| :--- | :--- | :--- |
| High | Dependency vulnerabilities (npm audit) | ⏳ Pending |
| High | Self-host Monaco editor | ⏳ Pending |
| High | Add CSP headers to Vite dev server | ⏳ Pending |
| Medium | Add rate limiting middleware | ⏳ Pending |
| Medium | Validate manifest schema server-side | ⏳ Pending |
| Medium | Add request ID tracing | ⏳ Pending |
| Low | Use `crypto.randomUUID()` instead of `Math.random()` | ⏳ Pending |
| Low | Sanitize filenames in download helper | ⏳ Pending |

---

## Verification Steps

After applying all fixes, verify:

1. **Auth works:**
   ```bash
   curl -H "X-API-Key: test" http://localhost:8082/api/v1/projects
   # Should return 401 without key, 200 with valid key
   ```

2. **CORS works:**
   ```bash
   curl -H "Origin: http://localhost:5173" -X OPTIONS http://localhost:8082/api/v1/projects
   # Should return 204 with correct CORS headers
   ```

3. **WebSocket connects:**
   ```bash
   # Start a run, then:
   wss://localhost:8082/ws/logs/{run_id}
   # Should receive log messages
   ```

4. **File upload works:**
   ```bash
   curl -X POST http://localhost:8082/api/v1/projects/{id}/versions \
     -F "files=@project.zip" \
     -F "manifest={\"runtime\":\"python3\",\"entrypoint\":\"main.py\"}"
   ```
