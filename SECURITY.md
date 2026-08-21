# Security Policy & ASH Checklist — PolyOrch

<!-- Automatic Security Hardening (ASH) checklist and security policy -->

## Security Policy

PolyOrch takes security seriously. This document outlines our security practices, known issues, and the ASH (Automatic Security Hardening) checklist that runs on every commit.

---

## ASH — Automatic Security Hardening

ASH is our automated security pipeline that runs on every push and pull request. It includes:

### 1. Static Application Security Testing (SAST)
- **gosec** — Go security scanner checking for common vulnerabilities
- **npm audit** — Frontend dependency vulnerability scanning
- **TruffleHog** — Secret scanning to prevent credential leaks

### 2. Container Security
- **Trivy FS Scan** — Filesystem vulnerability scanning
- **Trivy Config Scan** — Dockerfile and configuration auditing
- **Trivy Image Scan** — Built image vulnerability scanning
- **Docker Bench** — CIS Docker Benchmark compliance checking

### 3. Dependency Management
- **Dependency Review** — GitHub's dependency review action blocks high-severity vulnerabilities
- **Vendored Dependencies** — All Go dependencies are vendored in `vendor/` for reproducible builds
- **Pinned Versions** — Exact versions in `go.mod`, `go.sum`, `web/package.json`, `web/package-lock.json`

### 4. Runtime Hardening
- **Non-root user** — Container runs as `polyorch:polyorch` (UID 1000)
- **Read-only filesystem** — `read_only: true` in docker-compose with tmpfs for `/tmp`
- **No new privileges** — `no-new-privileges:true` security option
- **Dropped capabilities** — `cap_drop: ALL` with only `NET_BIND_SERVICE` added
- **Seccomp profile** — Default seccomp profile applied
- **Resource limits** — CPU and memory limits in docker-compose

---

## ASH Checklist

Run this checklist before every release:

### Pre-Commit
- [ ] `make fmt` — Format Go code
- [ ] `make lint` — Run linter
- [ ] `npm run lint` — Lint frontend
- [ ] No hardcoded secrets or credentials
- [ ] No debug logging in production code paths
- [ ] All environment variables validated
- [ ] Input validation on all user-facing endpoints
- [ ] Error messages don't leak sensitive information

### CI/CD
- [ ] ASH workflow passes (`.github/workflows/security.yml`)
- [ ] No critical or high vulnerabilities in Trivy scan
- [ ] No high-severity npm audit findings
- [ ] No secrets detected by TruffleHog
- [ ] Docker image scan passes
- [ ] Docker Bench security checks pass

### Container Security
- [ ] Image runs as non-root user
- [ ] `read_only` enabled
- [ ] `no-new-privileges` set
- [ ] All capabilities dropped except required
- [ ] Health check configured
- [ ] Resource limits set
- [ ] Logging driver configured
- [ ] No secrets in image layers

### Backend Security
- [ ] API key authentication enforced
- [ ] CORS configured with strict origin allowlist
- [ ] WebSocket origin validated
- [ ] SQL injection prevented (parameterized queries)
- [ ] Command injection prevented (no shell execution)
- [ ] Path traversal prevented (zip extraction validation)
- [ ] Rate limiting configured
- [ ] Request size limits configured
- [ ] Timeouts configured on all external calls

### Frontend Security
- [ ] CSP headers configured
- [ ] No `dangerouslySetInnerHTML`
- [ ] No `eval()` or `new Function()`
- [ ] XSS prevention (auto-escaping verified)
- [ ] Authentication tokens stored securely
- [ ] API keys not exposed in client code
- [ ] WebSocket connections use `wss://` in production
- [ ] Dependencies up to date
- [ ] Source maps disabled in production

### Infrastructure
- [ ] TLS enabled for all external communication
- [ ] NATS configured with authentication (if exposed)
- [ ] Database backups automated
- [ ] Monitoring and alerting configured
- [ ] Incident response plan documented

---

## Reporting Security Issues

If you discover a security vulnerability in PolyOrch, please report it responsibly:

1. **Do NOT** open a public GitHub issue
2. Email security details to **security@nimish-nirmal.github.io**
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We aim to respond within 48 hours and will keep you informed of the remediation progress.

---

## Security Hardening History

| Date | Change | Impact |
| :--- | :--- | :--- |
| 2026-08-21 | Fixed auth middleware ordering | Critical — API now properly authenticated |
| 2026-08-21 | Fixed CORS wildcard origin | High — CSRF risk eliminated |
| 2026-08-21 | Added security headers middleware | High — XSS, clickjacking protection |
| 2026-08-21 | Fixed WebSocket origin validation | High — Unauthorized log access blocked |
| 2026-08-21 | Fixed NATS log streaming | High — Real-time logs now functional |
| 2026-08-21 | Added non-root container user | Medium — Reduced privilege escalation risk |
| 2026-08-21 | Added read-only filesystem | Medium — Reduced attack surface |
| 2026-08-21 | Added capability dropping | Medium — Reduced kernel attack surface |
| 2026-08-21 | Added Trivy scanning to CI | Medium — Vulnerability detection automated |
| 2026-08-21 | Added secret scanning to CI | Medium — Credential leak prevention |

---

## Known Security Considerations

1. **API Key Authentication:** The current API key is a static shared secret. For multi-user deployments, implement OAuth2 or JWT-based authentication.

2. **NATS Security:** NATS is not configured with TLS or authentication by default. For production, enable NATS TLS and user credentials.

3. **SQLite Encryption:** SQLite database is not encrypted at rest. For sensitive data, enable SQLite encryption or use encrypted volumes.

4. **Subprocess Execution:** Workers execute arbitrary code from uploaded ZIPs. Ensure only trusted users can upload code.

5. **GitHub Pages:** The frontend is a static site. Never expose the API directly through GitHub Pages — always use a separate backend server.
