This file is the entry point for AI coding agents working in this repository. Load the relevant skill(s) before writing or reviewing code in that area. If rules conflict, security beats everything, then correctness, then simplicity (KISS/YAGNI), then everything else.

## Session Start (always)

1. Read this file, then `MEMORY.md` (learned facts and current state). Verify remembered facts against the code before relying on them.
2. Run `git status` and `git log -10 --oneline` to see recent changes.
3. Load the skills relevant to the task from the skill index below (and any additional skill sections further down this file).

## Skill Index

Skills live at `.claude/skills/<name>/SKILL.md`.

| Area | Skill | Load when |
|---|---|---|
| Backend architecture | `backend-architecture-principles` | Structuring services, errors, config, logging, jobs, testing |
| API design | `api-design-rest` | Endpoints, payloads, status codes, pagination, versioning |
| Security | `backend-security` | Auth, authorization, input handling, uploads, headers, secrets |
| Database | `database-best-practices` | Schemas, queries, indexes, migrations, transactions |
| Git & commits | `git-commit-and-workflow` | Committing, branching, PRs, releases, tags |
| Agent memory | `agent-memory-protocol` | Start/end of every task; whenever you learn something durable |
| Changelog & versions | `changelog-and-versioning` | Any user-facing change, deprecation, release, version bump |
| Project management | `project-management-workflow` | Planning, task breakdown, ADRs, status reports, handoffs |

## Project Files and Who Owns Them

| File | Purpose | Owner |
|---|---|---|
| `AGENTS.md` | Stable rules and conventions | Humans |
| `MEMORY.md` | Learned facts, decisions, gotchas, current state | Agents (humans may edit) |
| `CHANGELOG.md` | User-facing release history | release-please if configured, otherwise agents + humans |
| `docs/adr/` | Architecture Decision Records | Humans + agents |
| Git history | Exact record of every change and why | Everyone |

## Universal Rules

1. **Understand before changing.** Read the surrounding code and follow existing conventions unless they violate a rule here.
2. **Keep changes small and focused.** One concern per change. Don't refactor unrelated code in a feature change.
3. **Simplest thing that works** (KISS/YAGNI). No speculative abstractions, flags or optimizations without a concrete need.
4. **Validate at boundaries.** Never trust client input. Validate on the server regardless of client-side checks.
5. **Security is not optional.** Apply `backend-security` to every feature touching users, data or external input.
6. **Write tests** for new behavior and bug fixes (including error paths and permission checks). Don't merge with failing tests, lint or type errors.
7. **No secrets in code, logs, memory files or client bundles.**
8. **User-facing quality is part of "done":** accessibility, performance and discoverability for anything users see.
9. **Document decisions**: update README/OpenAPI/ADRs when behavior or contracts change.
10. **When requirements are ambiguous, ask** rather than guess, especially for data model, auth and destructive operations.
11. **Commit with Conventional Commits**, atomically, and only when asked or when the workflow says so. Never force-push shared branches, and never skip or work around configured hooks and checks (`--no-verify`, disabling rules to make a check pass). Fix the underlying issue.
12. **Write commit/PR titles for the reader of the changelog.** If release-please is configured, don't hand-edit `CHANGELOG.md` or version fields.
13. **Keep memory current and small.** Record durable learnings, prune obsolete ones, and leave exact next steps in `MEMORY.md` at the end of each session (see `agent-memory-protocol`).
14. **Never claim done without verifying.** Run the tests and the feature. Report honestly what was and wasn't verified.

## Definition of Done

- [ ] Meets the requirement, with tests passing (locally and in CI, if there is CI)
- [ ] Lint, formatting and type checks configured for this repository pass
- [ ] Relevant skill checklists reviewed
- [ ] No new vulnerabilities, secrets or unnecessary dependencies
- [ ] Migrations backward compatible; API changes non-breaking or versioned
- [ ] Commits follow Conventional Commits; PR small, described, and titled as a release note
- [ ] Changelog updated per `changelog-and-versioning`
- [ ] `MEMORY.md` updated (learnings pruned/added, Current State accurate)
- [ ] Docs/OpenAPI/ADRs updated
