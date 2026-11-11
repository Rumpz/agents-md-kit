---
name: backend-architecture-principles
description: Language-agnostic backend architecture and code-quality rules. Use when designing services, structuring a backend codebase, writing business logic, handling errors, configuration, logging, background jobs, or reviewing backend code for maintainability.
---

# Backend Architecture and Code Principles

These rules apply to any backend language or framework (Node, Python, Java, Go, .NET, etc.). The SOLID/DRY/KISS/YAGNI principles from the frontend files apply here too. Prefer the simplest architecture that fits the current needs.

## 1. Layered Structure (Separation of Concerns)

Keep responsibilities separated (SRP) and dependencies pointing inward (DIP):

```
HTTP/Transport layer   → routing, parsing, validation, auth, serialization (controllers/handlers)
Application/Service    → use cases, business rules, orchestration, transactions
Domain                 → core entities and rules (no framework/DB imports)
Infrastructure         → DB access, external APIs, queues, email, file storage (repositories/adapters)
```

- Controllers/handlers stay thin: parse input, call a service, map the result to a response.
- Business logic lives in services/domain, never in controllers or SQL scattered across the code.
- Services depend on interfaces (repositories, gateways), and implementations are injected. This enables testing and swapping infrastructure.
- Don't leak ORM models or DB rows to the API. Map to DTOs/response models.
- Start with a well-organized modular monolith. Split into microservices only when there is a concrete scaling, team or deployment reason (YAGNI).

## 2. Project Organization

- Group by feature/module (`users/`, `orders/`, `billing/`), each containing its handlers, services, repositories and tests, rather than only by technical type.
- Modules communicate through explicit public interfaces, not by reaching into each other's internals or tables.
- Keep one place for configuration, one for dependency wiring (composition root).

## 3. Configuration and Environments (12-Factor)

- Configuration comes from environment variables, validated at startup (fail fast on missing/invalid values).
- Never hard-code or commit secrets. Use a secret manager (Vault, cloud secret stores) and `.env.example` without real values.
- Same build artifact across environments. Only config differs.
- Logs go to stdout/stderr as structured output. The platform collects them.
- Services are stateless: store session/state in a DB or cache, never in process memory or local disk.
- Support graceful shutdown (finish in-flight requests, close connections on SIGTERM).

## 4. Error Handling

- Distinguish expected errors (validation, not found, conflict, unauthorized) from unexpected ones (bugs, outages).
- Use typed/domain errors in services. Map them to HTTP statuses in one central error handler.
- Never swallow errors silently. Never expose stack traces, SQL or internal details to clients.
- Fail fast on invalid input at the boundary. Validate and parse into typed objects before they reach business logic.
- Retry only idempotent operations, with exponential backoff and jitter, and a limit. Set timeouts on every outbound call (HTTP, DB, queue).
- Use circuit breakers or bulkheads for flaky downstream dependencies when failures could cascade.

## 5. Validation

- Validate all external input (body, query, params, headers, files, webhooks) at the edge with a schema library (Zod, Joi, Pydantic, Bean Validation, etc.).
- Whitelist known fields; reject or strip unknown ones (prevents mass assignment).
- Validate type, format, length, range and business constraints. Never trust client-side validation.
- Normalize inputs (trim, case) deliberately and consistently.

## 6. Logging, Metrics and Tracing (Observability)

- Structured (JSON) logs with level, timestamp, request/correlation ID, user/tenant ID (if appropriate), and message.
- Generate or propagate a correlation ID per request and pass it through downstream calls.
- Log at the right level: `error` for failures needing attention, `warn` for recoverable anomalies, `info` for key events, `debug` for diagnostics.
- Never log secrets, passwords, tokens, full card numbers or unnecessary personal data.
- Expose health endpoints: liveness (`/healthz`) and readiness (`/readyz`, checks dependencies).
- Track the golden signals: latency, traffic, errors, saturation. Use OpenTelemetry for traces/metrics where possible. Alert on symptoms (error rate, latency SLOs), not only causes.

## 7. Concurrency, Idempotency and Consistency

- Make write endpoints and message handlers idempotent (idempotency keys, upserts, unique constraints). Assume messages and requests can be delivered more than once.
- Use database transactions around operations that must succeed or fail together. Keep them short. Don't call external services inside long transactions.
- Handle concurrent updates with optimistic locking (version column/ETag) or appropriate row locks.
- For cross-service consistency, use the outbox pattern and sagas rather than distributed transactions.

## 8. Background Jobs and Async Work

- Move slow or unreliable work (email, reports, webhooks, media processing) to a queue/worker, not the request path.
- Jobs are idempotent, retryable with backoff, and have a dead-letter queue and alerting.
- Pass identifiers in job payloads, not large objects. Re-fetch current state when the job runs.
- Schedule recurring tasks in a single place and ensure only one instance runs them (leader election or lock).

## 9. Caching

- Cache only after measuring a bottleneck. Choose the layer: HTTP/CDN cache, application cache (Redis), query cache.
- Define keys, TTLs and an invalidation strategy up front. Cache-aside is the usual default.
- Protect against stampedes (locking, jittered TTLs) on hot keys.
- Never cache user-specific or sensitive data in shared caches without scoping the key.

## 10. Dependencies and Third-Party Services

- Wrap external services in adapters behind your own interface (DIP). Keep SDK types out of business logic.
- Pin dependency versions with a lockfile. Update regularly. Scan for vulnerabilities (Dependabot, `npm audit`, `pip-audit`, Snyk/Trivy).
- Remove unused dependencies. Prefer well-maintained libraries over writing your own crypto, auth or parsers.

## 11. Testing

- Test pyramid: many fast unit tests for domain/service logic, fewer integration tests (real DB via containers, repository and API tests), a small number of end-to-end tests.
- Mock at architectural boundaries (external APIs, clock, email), not internal details.
- Test error paths, authorization rules and edge cases, not just the happy path.
- Tests are deterministic, independent, and run in CI on every pull request. Use contract tests for service-to-service APIs.

## 12. CI/CD and Delivery

- Every change passes linting, type checks, tests and a security scan before merge.
- Automated, repeatable deploys. Use feature flags and progressive rollouts for risky changes.
- Database migrations are part of the pipeline and are backward compatible (expand → migrate → contract) so you can deploy and roll back safely.
- Containerize with minimal images, non-root users and pinned base images.

## Review Checklist

- [ ] Thin handlers; business logic in services/domain; infrastructure behind interfaces
- [ ] Config from validated env vars; no secrets in code
- [ ] Input validated at the edge; centralized error handling; no internals leaked
- [ ] Structured logs with correlation IDs; health endpoints; metrics
- [ ] Timeouts, retries (idempotent only), and graceful shutdown
- [ ] Idempotent writes/jobs; transactions where needed
- [ ] Tests at unit and integration level; CI green
