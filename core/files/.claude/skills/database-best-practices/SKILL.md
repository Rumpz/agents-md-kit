---
name: database-best-practices
description: Rules for database design, queries, migrations and data access (primarily relational/SQL). Use when designing schemas, writing queries or ORM code, adding indexes, writing migrations, handling transactions, or diagnosing slow queries and N+1 problems.
---

# Database Best Practices

Examples use SQL (PostgreSQL-flavored). Principles apply to MySQL and most relational databases, and many apply to NoSQL.

## 1. Schema Design

- Model the domain first. Normalize to at least 3NF by default, and denormalize deliberately only for measured read performance.
- Every table has a primary key. Choose stable surrogate keys (`bigint` identity or UUIDv7/ULID for distributed/public IDs). Don't use mutable business data (emails) as primary keys.
- Use the correct types:
  - Money: `numeric(p,s)` or integer minor units, never `float`.
  - Time: `timestamptz` stored in UTC. Convert at the edges.
  - Booleans as `boolean`. Enums via `enum`/lookup table/`CHECK` constraint. JSON columns (`jsonb`) only for genuinely flexible data, not as a way to skip modeling.
- Enforce integrity in the database, not only in app code:
  - `NOT NULL` by default, `UNIQUE`, `CHECK`, and **foreign keys** with deliberate `ON DELETE` behavior.
- Naming: consistent, lowercase `snake_case`, singular or plural table names (pick one), `<table>_id` for foreign keys, `created_at` / `updated_at` on tables.
- Soft delete (`deleted_at`) only when needed (audit/recovery), and remember to filter it consistently (partial indexes and unique constraints must account for it).
- Many-to-many via a join table with a composite unique key.

## 2. Indexing

- Index primary keys (automatic), foreign keys, and columns used in `WHERE`, `JOIN`, `ORDER BY` of frequent queries.
- Composite indexes: put equality columns first, then range/sort columns. Order matters. An index on `(a, b)` serves queries on `a` and `a,b`, not `b` alone.
- Use partial indexes and covering indexes (`INCLUDE`) for hot paths.
- Don't over-index. Each index slows writes and uses storage. Remove unused indexes (check usage statistics).
- Verify with `EXPLAIN (ANALYZE, BUFFERS)`. Look for sequential scans on large tables, row estimate mismatches and sorts spilling to disk.
- Avoid patterns that defeat indexes: functions on indexed columns (`WHERE lower(email) = ...` without a functional index), leading wildcards (`LIKE '%abc'`), implicit type casts.
- For text search use full-text search (`tsvector`/GIN, or a search engine) rather than `LIKE '%term%'`.

## 3. Queries and Data Access

- **Never** build SQL from strings with user input. Use parameters (see `backend-security`).
- Select only the needed columns. Avoid `SELECT *` in application code.
- Avoid **N+1 queries**: load related data with joins, `IN (...)` batching, or ORM eager loading (`include`/`joinedload`/`prefetch_related`). Watch query counts per request in development and tests.
- Paginate everything that can grow. Prefer keyset (seek) pagination (`WHERE (created_at, id) < (?, ?) ORDER BY created_at DESC, id DESC LIMIT 50`) over large `OFFSET`.
- Push filtering, aggregation and sorting into the database instead of in application memory.
- Use bulk operations for batch writes (`INSERT ... VALUES (...),(...)`, `COPY`, bulk APIs), in chunks.
- Use `EXISTS` rather than `COUNT(*) > 0` for existence checks.
- Set statement timeouts and lock timeouts to protect the database from runaway queries.
- Use read replicas for heavy reads only when replication lag is acceptable, and route deliberately.

## 4. ORM Usage

- ORMs are fine for CRUD. Drop to hand-written SQL for complex reporting or performance-critical queries.
- Keep ORM entities inside the data-access layer (repositories). Return domain objects/DTOs to services (DIP).
- Understand the SQL your ORM generates. Log slow queries and inspect them.
- Don't rely on lazy loading in request handlers, which causes hidden N+1.

## 5. Transactions and Concurrency

- Wrap multi-step writes that must be atomic in one transaction. Keep transactions short and don't do network calls or user interaction inside them.
- Know your isolation level (PostgreSQL default is Read Committed). Use `SERIALIZABLE` or explicit locks for tricky invariants.
- Prevent lost updates: optimistic locking (`version` column: `UPDATE ... WHERE id = ? AND version = ?`) or `SELECT ... FOR UPDATE`.
- Use unique constraints plus upserts (`INSERT ... ON CONFLICT`) to make operations idempotent and race-safe, instead of check-then-insert.
- Acquire locks in a consistent order to avoid deadlocks. Retry on serialization failures/deadlocks.
- Use `SELECT ... FOR UPDATE SKIP LOCKED` for job-queue style workloads.

## 6. Migrations

- All schema changes are versioned migration files in source control (Flyway, Liquibase, Prisma Migrate, Alembic, Knex, EF Migrations). Never alter production schema by hand.
- Migrations are repeatable in CI against a fresh database and applied automatically in the pipeline.
- Make them **backward compatible** using the expand → migrate → contract pattern so old and new app versions can run at the same time:
  1. Expand: add new nullable column/table/index.
  2. Deploy the app writing to both / reading the new one. Backfill data in batches.
  3. Contract: remove old columns after all code stops using them.
- Avoid long locks on big tables: add indexes `CONCURRENTLY` (PostgreSQL), add columns without volatile defaults where the engine requires a rewrite, backfill in batches, and add `NOT NULL`/FK constraints in a safe two-step way (`NOT VALID` then `VALIDATE`).
- Never edit an already-applied migration. Add a new one. Have a rollback/forward-fix plan.
- Keep schema migrations and large data migrations separate.

## 7. Backups, Recovery and Operations

- Automated backups with point-in-time recovery. **Test restores regularly**. A backup that has never been restored is not a backup.
- Define RPO/RTO. Monitor replication, disk, connections, locks, slow queries, bloat/vacuum health.
- Use connection pooling (PgBouncer or the app pool), sized deliberately (not one connection per request). Know the max connections limit.
- Use least-privilege DB users: the app can't `DROP`, and migrations use a separate privileged role. Separate read-only users for analytics.
- Keep dev/staging data anonymized. Never copy raw production personal data into lower environments.

## 8. Choosing a Data Store

- Default to a relational database (PostgreSQL is a strong general-purpose choice). Add other stores for specific needs, not by habit:
  - Redis: caching, rate limits, ephemeral state, queues.
  - Document stores: truly schema-flexible aggregates.
  - Search engines (Elasticsearch/OpenSearch/Meilisearch): full-text relevance, faceting.
  - Object storage (S3-compatible): files and large blobs. Store only the key/metadata in the DB.
  - Analytical stores (warehouse/columnar): reporting and heavy aggregation, separated from the OLTP database.
- Each additional datastore adds operational cost. Justify it (YAGNI).

## 9. Data Privacy and Lifecycle

- Classify personal and sensitive data. Encrypt where required. Limit who and what can read it.
- Define retention and deletion procedures (including backups and derived data). Keep audit trails for sensitive changes.

## Review Checklist

- [ ] Primary keys, correct types, NOT NULL, FKs, unique/check constraints
- [ ] Indexes match query patterns; verified with EXPLAIN; no unused/duplicate indexes
- [ ] Parameterized queries; no `SELECT *`; no N+1; pagination everywhere
- [ ] Transactions short and correct; race conditions handled by constraints/locks/versions
- [ ] Migrations versioned, backward compatible, safe on large tables
- [ ] Backups tested; connection pooling; least-privilege DB users; timeouts set
