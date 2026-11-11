---
name: api-design-rest
description: Rules for designing and implementing HTTP/REST APIs. Use when creating or reviewing endpoints, request/response shapes, status codes, error formats, pagination, filtering, versioning, idempotency, rate limiting, or API documentation.
---

# REST API Design Rules

Consistency matters more than any single convention. Pick these rules, document them, and apply them everywhere.

## 1. Resources and URLs

- Model **nouns** (resources), not verbs. Use plural, lowercase, hyphenated names:
  - `GET /users`, `GET /users/{id}`, `POST /users`, `PATCH /users/{id}`, `DELETE /users/{id}`
  - Nested for clear ownership, max about two levels: `GET /users/{id}/orders`
- Don't put verbs in paths (`/getUser`, `/createOrder`). For non-CRUD actions, use a sub-resource or action noun: `POST /orders/{id}/cancellation`, `POST /payments/{id}/refunds`.
- Identifiers in the path, filters/sorting/pagination in the query string.
- Don't expose database internals. Prefer opaque IDs (UUIDv7/ULID) over sequential integers for public resources to avoid enumeration.

## 2. HTTP Methods

| Method | Use | Safe | Idempotent |
|---|---|---|---|
| GET | Read | Yes | Yes |
| POST | Create / non-idempotent action | No | No (unless idempotency key) |
| PUT | Replace entire resource | No | Yes |
| PATCH | Partial update | No | Should be |
| DELETE | Remove | No | Yes |

- `GET` never changes state. Never accept sensitive data in query strings.
- `POST` that creates returns `201 Created` plus a `Location` header and the new resource.

## 3. Status Codes

Use them precisely:

- `200 OK` success with body · `201 Created` · `202 Accepted` (async work queued) · `204 No Content`
- `301/308` permanent redirect · `304 Not Modified` (conditional GET)
- `400 Bad Request` malformed request · `401 Unauthorized` (not authenticated) · `403 Forbidden` (authenticated but not allowed) · `404 Not Found` · `405 Method Not Allowed` · `409 Conflict` (state/version conflict, duplicate) · `410 Gone` · `412 Precondition Failed` · `415 Unsupported Media Type` · `422 Unprocessable Content` (validation failed) · `429 Too Many Requests` (with `Retry-After`)
- `500 Internal Server Error` · `502/503/504` upstream or availability problems (`Retry-After` on 503)

Don't return `200` with an error body. Don't use `500` for client mistakes.

## 4. Request and Response Bodies

- JSON with `Content-Type: application/json`. Be consistent in naming style (`camelCase` or `snake_case`, pick one).
- Dates/times in ISO 8601 UTC (`2026-11-11T18:56:00Z`). Money as integer minor units plus currency code (`{"amount": 1999, "currency": "EUR"}`), never floats.
- Use `null` and missing fields consistently. Document which fields are optional.
- Return only what clients need (ISP). Offer field selection (`?fields=id,name`) or expansion (`?expand=customer`) when useful.
- Never return secrets, password hashes, internal flags or other users' private data.
- Use enums as stable string values, not numeric codes.

## 5. Error Format

Use one error shape across the API, ideally RFC 9457 Problem Details (`application/problem+json`):

```json
{
  "type": "https://api.example.com/errors/validation",
  "title": "Validation failed",
  "status": 422,
  "detail": "One or more fields are invalid.",
  "instance": "/users",
  "traceId": "9f1c2a...",
  "errors": [
    { "field": "email", "message": "Must be a valid email address", "code": "invalid_email" }
  ]
}
```

- Machine-readable `code`s for clients, human-readable messages for people.
- Include a trace/correlation ID. Never include stack traces or internals.
- Be careful about information leaks, e.g. login errors shouldn't reveal whether the email exists.

## 6. Pagination, Filtering, Sorting

- Always paginate collection endpoints with a default and a maximum page size.
- Prefer **cursor-based** pagination for large or changing data: `GET /orders?limit=50&cursor=abc`. Response includes `nextCursor`. Offset/limit is acceptable for small, stable sets.
- Filtering: `?status=paid&createdAfter=2026-01-01`. Sorting: `?sort=-createdAt,name`.
- Validate and whitelist filter and sort fields (never pass raw input to queries).
- Return pagination metadata or `Link` headers consistently.

## 7. Idempotency and Concurrency

- Support an `Idempotency-Key` header on `POST` endpoints that create things or move money. Store the key and the response, and replay the result for duplicates.
- Use `ETag` + `If-Match` (or a `version` field) for optimistic concurrency on updates, returning `412`/`409` on conflict.
- Use `ETag`/`If-None-Match` and `Cache-Control` for cacheable GETs.

## 8. Versioning and Evolution

- Version from day one (`/v1/...` or a header). Don't break existing clients inside a version.
- Non-breaking: adding optional fields, new endpoints, new enum values (clients must tolerate unknowns). Breaking: removing/renaming fields, changing types or semantics, tightening validation.
- Deprecate with notice: `Deprecation` and `Sunset` headers, changelog, and a migration period.

## 9. Security Basics for APIs

(Details in `backend-security`.)

- HTTPS only. Authenticate every non-public endpoint. Check **authorization per resource** on every request.
- Rate-limit and return `429` with `Retry-After`. Set payload size limits and timeouts.
- Configure CORS with an explicit allowlist of origins. Never `*` with credentials.
- Set `Content-Type` and `X-Content-Type-Options: nosniff`. Reject unexpected content types.

## 10. Long-Running Operations and Webhooks

- Return `202 Accepted` with a status resource (`Location: /jobs/{id}`) for slow work. Clients poll or receive a webhook.
- Webhooks: sign payloads (HMAC with timestamp), retry with backoff, make events idempotent (event ID), and let consumers verify and replay.

## 11. Documentation and Contracts

- Maintain an OpenAPI spec as the source of truth (generated from code or code generated from the spec). Keep examples current.
- Validate requests/responses against the schema in tests. Use contract tests to catch breaking changes in CI.
- Provide consistent naming, examples, error catalogs and an auth guide.

## 12. When Not to Use REST

- Use GraphQL when clients need flexible, aggregated queries across many resources. Use gRPC for internal low-latency service-to-service calls. Use WebSockets/SSE for realtime pushes. Don't adopt them without a concrete need (YAGNI).

## Review Checklist

- [ ] Plural noun URLs, correct methods and status codes
- [ ] Consistent JSON naming; ISO dates; money as integers + currency
- [ ] Standard error format with trace ID; no internal leaks
- [ ] Pagination with limits on all list endpoints; whitelisted filters/sorts
- [ ] Idempotency keys on risky POSTs; concurrency control on updates
- [ ] Versioned; breaking changes avoided; OpenAPI up to date
- [ ] AuthN/AuthZ, rate limiting, CORS allowlist in place
