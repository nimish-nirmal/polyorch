# Security Review Report — PolyOrch Frontend

**Date:** 2026-08-21
**Scope:** `web/` directory (React + TypeScript + Vite)
**Auditor:** Automated agent review
**Status:** CRITICAL issues found — do not deploy to production without fixes

---

## CRITICAL

### C1. API auth middleware is registered after routes and never executes [backend]
**File:** `cmd/api/main.go:98-100`
**Lines affected:** 72-100

**Description:**
```go
v1 := router.Group("/api/v1")
{ /* all routes registered here */ }

if apiKey != "" {
    router.Use(middleware.Auth(apiKey)) // TOO LATE — applies to nothing
}
```

Gin composes handler chains at registration time. Middleware added via `router.Use()` after route registration applies only to routes registered later — and there are none. `middleware.Auth` is dead code.

**Impact:** The entire API is fully unauthenticated even when `POLYORCH_API_KEY` is set. Anyone with network access can list/create/delete projects, upload code versions, and trigger runs. Since versions contain executable workflow code, this is **unauthenticated remote code execution** on workers.

**Before:**
```go
v1 := router.Group("/api/v1")
{
    v1.POST("/projects", server.CreateProject)
    // ... all routes ...
}

router.GET("/health", handlers.Health)

if apiKey != "" {
    router.Use(middleware.Auth(apiKey)) // never runs
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

### C2. Unauthenticated WebSocket log streaming with no per-run authorization [backend]
**File:** `internal/websocket/handler.go:32-35`

**Description:**
```go
conn, err := (&websocket.Upgrader{
    ReadBufferSize:  1024,
    WriteBufferSize: 1024,
}).Upgrade(c.Writer, c.Request, nil)
```

`CheckOrigin` is `nil`, so gorilla/websocket applies its default `checkSameOrigin`, which blocks browser-based cross-site WebSocket hijacking. However, any non-browser client (curl, script) omits the `Origin` header entirely — which `checkSameOrigin` treats as **allowed** — and `run_id` is only parsed as a UUID, never checked against caller permissions.

**Impact:** Anyone can stream live logs for *any* `run_id`. Logs routinely carry secrets, tokens, connection strings, and internal hostnames.

**Before:** No origin check, no auth, no run ownership validation
**After:** Add explicit `CheckOrigin` allowlist and short-lived ticket-based auth

---

### C3. `Access-Control-Allow-Origin: *` combined with `Allow-Credentials: true`
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
    c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
}
```

---

### C4. Bearer token stored in `localStorage`, with a scheme mismatch that guarantees auth failure
**Files:** `src/services/api.ts:12-18, 23-25` · `internal/middleware/auth.go:25`

**Description:**
- Client sends `Authorization: Bearer <token>` (`api.ts:15`)
- Server reads `X-API-Key` (`auth.go:25`)
- Even after fixing C1, the UI would receive `401` on every request
- `localStorage` is readable by any JavaScript on the origin — permanent credential exposure

**Before:**
```ts
// api.ts
const token = localStorage.getItem('polyorch_token')
headers: {
    'Authorization': `Bearer ${token}`,
}

// auth.go
key := c.GetHeader("X-API-Key")
```

**After:**
```ts
// api.ts — align header name
headers: {
    'X-API-Key': token,
}

// auth.go — already correct, just align client
// Move token to memory or HttpOnly cookie
```

---

### C5. No authentication or route protection anywhere in the frontend
**File:** `src/App.tsx:16-23`

**Description:** Every route renders unconditionally. There is no `<ProtectedRoute>`, no auth context, no login route.

**Before:**
```tsx
<Routes>
    <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="projects" element={<Projects />} />
        {/* no guards */}
    </Route>
</Routes>
```

**After:**
```tsx
<Routes>
    <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Dashboard />} />
        <Route path="projects" element={<Projects />} />
    </Route>
</Routes>
```

---

## HIGH

### H1. Six high-severity dependency vulnerabilities
**File:** `web/package.json:12-34`

| Package | Installed | Issue | Sev |
|---|---|---|---|
| `@remix-run/router` (via `react-router-dom@6.20.0`) | ≤1.23.1 | XSS via open redirects | High |
| `axios@1.6.0` | <1.8.2 | SSRF + credential leakage | High ×4 |
| `postcss@8.4.0` | ≤8.5.22 | XSS via unescaped `</style>` | High |
| `vite@5.0.0` | ≤0.24.2 | Dev server response theft | Moderate |

**Before:** `web/package.json` with vulnerable versions
**After:** Upgrade to `react-router-dom@^6.30.6`, `axios@^1.15.2`, `postcss@^8.5.26`, `vite@^5.4.21`

---

### H2. Monaco editor fetched from third-party CDN with no integrity check
**File:** `src/components/CodeEditor.tsx:1,24`

**Before:** `@monaco-editor/react` falls back to CDN `https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs`
**After:** Self-host Monaco by adding `monaco-editor` as a dependency

---

### H3. Production source maps expose full application source
**File:** `web/vite.config.ts:10`

**Before:** `sourcemap: true`
**After:** `sourcemap: false` (or `'hidden'` with private upload)

---

### H4. No Content-Security-Policy or security headers
**File:** `web/index.html:1-13`

**Before:** No security headers
**After:** Add CSP, `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors`

---

### H5. Hardcoded plaintext API base URL; documented env vars never read
**File:** `src/services/api.ts:3-8`

**Before:**
```ts
const isGitHubPages = window.location.hostname.includes('github.io')
baseURL: isGitHubPages ? 'https://…github.io/polyorch/api/v1' : 'http://localhost:8082/api/v1'
```

**After:**
```ts
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8082'
baseURL: `${apiUrl}/api/v1`
```

---

### H6. Raw `fetch()` bypasses axios client
**File:** `src/pages/ProjectDetail.tsx:93-95`

**Before:**
```ts
const res = await fetch(`/api/v1/projects/${id}/versions/${version.id}/files`)
const data = await res.json()
```

**After:**
```ts
const data = await api.get(`/projects/${encodeURIComponent(id)}/versions/${encodeURIComponent(version.id)}/files`)
```

---

## MEDIUM

### M1. Substring hostname check is spoofable
**File:** `src/services/api.ts:3`
**Before:** `window.location.hostname.includes('github.io')`
**After:** `window.location.hostname === 'nimish-nirmal.github.io'`

### M2. Untrusted log data written to xterm without control-character sanitization
**File:** `src/components/Terminal.tsx:19-23`
**Fix:** Strip ANSI/OSC escape sequences before writing

### M3. Unencoded interpolation into WebSocket URL
**File:** `src/components/Terminal.tsx:15-17`
**Fix:** Use `encodeURIComponent(runId)`

### M4. WebSocket path mismatch causes reconnect storm
**File:** `src/components/Terminal.tsx:16` vs `cmd/api/main.go:87`
**Before:** Client `/ws/logs/${runId}` vs Server `/api/v1/ws/:run_id`
**After:** Align to `/api/v1/ws/${runId}`

### M5. Unstable callback identities can trigger reconnect loops
**File:** `src/hooks/useWebSocket.ts:60,62-75`
**Fix:** Hold callbacks in refs, depend only on `url`

### M6. User-supplied JSON manifest parsed without validation
**File:** `src/pages/ProjectDetail.tsx:53,58-60`
**Fix:** Validate against schema, reject `__proto__`/`constructor` keys

### M7. File upload validated only in browser
**File:** `src/pages/ProjectDetail.tsx:215-221`
**Fix:** Enforce size cap and verify `PK\x03\x04` signature client-side; server-side validation authoritative

### M8. `401` handler clears token without resetting app state
**File:** `src/services/api.ts:23-25`
**Fix:** Clear auth state and redirect to login

---

## LOW

| # | File | Issue |
|---|---|---|
| L1 | `src/utils/helpers.ts:13-15` | `Math.random()` for IDs — use `crypto.randomUUID()` |
| L2 | `src/utils/helpers.ts:21-29` | Unvalidated filename in download — sanitize |
| L3 | `src/hooks/useRuns.ts:64` | Logs full axios error including Authorization token |
| L4 | `web/.env.example:1-2` | Ships `http://` defaults |
| L5 | `web/.npmrc:3` | `audit=false` suppresses warnings |
| L6 | `web/vite.config.ts:12-23` | Dev proxy no host allowlist |
| L7 | `src/pages/Dashboard.tsx:88-100` | Hardcoded mock data presented as live state |
| L8 | Multiple | Server-controlled errors rendered directly — safe today but risky |
| L9 | `src/pages/ProjectDetail.tsx:189-203` | File select shows wrong file |

---

## Summary

| Severity | Count | Status |
|---|---|---|
| Critical | 5 | 🔴 Blocking |
| High | 6 | 🔴 Blocking |
| Medium | 8 | 🟡 Recommended |
| Low | 9 | 🟢 Nice to have |

**Total issues:** 28
