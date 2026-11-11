---
name: backend-security
description: Security rules for backend and full-stack web applications, based on OWASP guidance. Use when implementing authentication, authorization, sessions/tokens, input handling, file uploads, secrets, headers, CORS, dependencies, or when reviewing code for vulnerabilities.
---

# Backend and Web Security Rules

Security is a requirement of every feature, not a later phase. Apply defense in depth and least privilege. Reference: OWASP Top 10 and the OWASP ASVS / Cheat Sheet Series.

## 1. Authentication

- Don't build your own crypto or auth protocols. Use a vetted library, framework feature or identity provider (OIDC/OAuth 2.1, Auth0, Cognito, Keycloak, etc.).
- Hash passwords with **Argon2id** (or scrypt/bcrypt as fallback) using a unique salt and tuned cost. Never MD5/SHA-1/plain SHA-256 for passwords.
- Enforce reasonable password policy: minimum length (12+ recommended), allow long passphrases and paste, check against breached-password lists. Don't force arbitrary complexity or periodic rotation.
- Offer MFA (TOTP, WebAuthn/passkeys). Require it for admin and sensitive actions.
- Rate-limit and lock out/slow down repeated failed logins. Return identical messages for unknown user vs wrong password.
- Password reset: single-use, short-lived, high-entropy tokens stored hashed. Don't reveal whether an email exists. Invalidate sessions after a password change.

## 2. Sessions and Tokens

- Session cookies: `HttpOnly; Secure; SameSite=Lax` (or `Strict`), with a sensible `Path`/`Domain`, and the `__Host-` prefix where possible. Regenerate the session ID on login and privilege change. Expire on idle and absolute timeouts, and invalidate on logout server-side.
- JWTs: use short-lived access tokens, validate signature, `iss`, `aud`, `exp`, and the algorithm allowlist (never accept `alg: none`). Use refresh-token rotation with revocation/reuse detection. Don't put sensitive data in the payload (it's only encoded, not encrypted).
- Don't store tokens in `localStorage` for browser apps if avoidable (XSS-exposed). Prefer HttpOnly cookies.
- CSRF: with cookie-based auth, use `SameSite` plus anti-CSRF tokens (or double-submit/Origin checks) on state-changing requests.

## 3. Authorization (Most Common Failure: Broken Access Control)

- Deny by default. Enforce authorization **on the server, on every request**, for every resource. Hiding UI elements is not security.
- Check ownership/permissions of the specific object (prevent IDOR): `WHERE id = ? AND owner_id = currentUser`.
- Centralize policy (RBAC/ABAC/policy engine) instead of scattered `if` checks. Test permission rules explicitly.
- Apply least privilege to users, service accounts, API keys and DB credentials.
- Protect against mass assignment: bind only allowlisted fields. Never let clients set `role`, `isAdmin`, `ownerId`, etc.
- Multi-tenant apps: scope every query by tenant (consider row-level security).

## 4. Injection and Input Handling

- **SQL:** always use parameterized queries/prepared statements or an ORM's safe APIs. Never concatenate user input into SQL. Whitelist dynamic identifiers (column names, sort fields).
- **NoSQL/ORM operators, LDAP, OS commands, templates, XPath:** treat all as injection sinks. Avoid shelling out. If necessary, use argument arrays, never string commands.
- **XSS:** encode/escape output by context (HTML, attribute, JS, URL). Frameworks like React escape by default, so avoid `dangerouslySetInnerHTML`, and sanitize with a vetted library (DOMPurify) if HTML must be rendered.
- **SSRF:** when fetching user-supplied URLs, allowlist hosts/schemes, block private/link-local/metadata IP ranges (e.g. `169.254.169.254`), re-validate after DNS resolution and redirects.
- **Path traversal:** never build file paths from user input directly. Normalize and confine to a base directory, or use generated IDs.
- **Deserialization:** don't deserialize untrusted data with native object serializers (pickle, Java serialization). Use plain JSON with schema validation.
- **Open redirects:** allowlist redirect targets.
- **XXE:** disable external entity processing in XML parsers.

## 5. File Uploads

- Enforce size limits, allowed extensions **and** verify content type by magic bytes. Don't trust the client's `Content-Type` or filename.
- Store outside the web root or in object storage. Rename to random IDs. Serve with `Content-Disposition` and a safe type, ideally from a separate domain.
- Scan for malware when appropriate. Re-encode images to strip payloads/metadata. Never execute uploaded files.

## 6. Secrets and Data Protection

- No secrets in source control, logs, error messages, URLs or client bundles. Use a secrets manager. Rotate secrets. Scan commits for leaks (gitleaks, GitHub secret scanning). Anything shipped to the browser is public.
- TLS 1.2+ everywhere (internal traffic too). Enable HSTS.
- Encrypt sensitive data at rest (disk/DB encryption, field-level for highly sensitive data), with managed keys (KMS).
- Collect and retain the minimum personal data. Support deletion/export (GDPR/LGPD obligations where applicable). Mask or tokenize payment data. Prefer a PCI-compliant provider so card data never touches your servers.
- Don't log personal data or secrets. Redact.

## 7. HTTP Security Headers

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Cross-Origin-Opener-Policy: same-origin
```

- Roll out CSP in report-only mode first, and prefer nonces/hashes over `'unsafe-inline'`.
- Use `frame-ancestors` (or `X-Frame-Options`) to prevent clickjacking.
- Remove version-revealing headers (`Server`, `X-Powered-By`).
- Cache-control `no-store` on sensitive responses.

## 8. CORS

- Allowlist specific origins. Never reflect arbitrary `Origin`, and never use `Access-Control-Allow-Origin: *` with credentials.
- Restrict allowed methods and headers to what is needed. CORS is a browser rule, not an authorization mechanism.

## 9. Rate Limiting and Abuse Prevention

- Apply rate limits per IP/user/API key, with stricter limits on auth, password reset, OTP, search and expensive endpoints. Return `429` + `Retry-After`.
- Set request body size limits, timeouts and pagination caps. Guard against ReDoS (avoid catastrophic regexes) and GraphQL query depth/complexity abuse.
- Add CAPTCHA/bot protection to signup and contact forms where abuse is likely.

## 10. Dependencies and Supply Chain

- Keep lockfiles committed. Automate updates and vulnerability scans (Dependabot, Renovate, `npm audit`, `pip-audit`, Trivy).
- Review new dependencies (maintenance, popularity, install scripts). Prefer fewer dependencies.
- Pin container base images, build from trusted sources, sign artifacts where possible. Run containers as non-root with minimal capabilities.
- Use Subresource Integrity (SRI) for third-party scripts and CDNs.

## 11. Logging, Monitoring and Incident Response

- Log security events (logins, failures, permission denials, password/role changes, admin actions) with who/what/when/where. Protect log integrity and access.
- Alert on anomalies (spikes in 401/403/429, unusual geographies, mass downloads).
- Have an incident response plan: contacts, revocation of keys/sessions, communication, and post-mortems.

## 12. Secure Development Process

- Threat-model new features (STRIDE: spoofing, tampering, repudiation, info disclosure, DoS, elevation).
- Add SAST, dependency and secret scanning to CI, and DAST/pen-testing for production systems.
- Code review includes a security pass. Use the checklist below.
- Fail securely: on error, deny access rather than allow.

## Review Checklist

- [ ] Auth via vetted library/provider; passwords hashed with Argon2id/bcrypt; MFA available
- [ ] Cookies `HttpOnly; Secure; SameSite`; JWT claims validated; CSRF handled
- [ ] Server-side authorization on every resource; IDOR and mass assignment prevented
- [ ] Parameterized queries; output encoding; SSRF/path-traversal/open-redirect guards
- [ ] Upload validation and safe storage
- [ ] No secrets in code/logs/client; TLS + HSTS; sensitive data encrypted
- [ ] Security headers and CSP set; strict CORS allowlist
- [ ] Rate limiting, size limits, timeouts
- [ ] Dependencies scanned and pinned; security events logged and monitored
