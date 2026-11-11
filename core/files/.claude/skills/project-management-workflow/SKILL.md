---
name: project-management-workflow
description: Lightweight project management workflow for AI-assisted development. Use when planning features, breaking down tasks, tracking progress, recording architectural decisions (ADRs), defining done, handing work between sessions or agents, or reporting status.
---

# Project Management Workflow for Agents and Humans

Goal: ship small, verified increments with minimal ceremony, and keep the project's state understandable to anyone (or any agent) joining mid-way.

## 1. Task Lifecycle

```
Clarify → Plan → Implement → Verify → Document → Hand off
```

1. **Clarify:** restate the goal and the acceptance criteria. Identify unknowns, constraints and what is *out of scope*. Ask when requirements are ambiguous or the change is destructive/irreversible. Otherwise state assumptions and proceed.
2. **Plan:** read `AGENTS.md` and `MEMORY.md`. Inspect relevant code. Write a short plan (section 3).
3. **Implement:** small steps, one concern at a time, tests alongside. Commit atomically (`git-commit-and-workflow`).
4. **Verify:** run tests, lint, type checks and the feature itself. Don't claim "done" on code that hasn't been run. Check the relevant skill checklists.
5. **Document:** write the commit/PR title as a release note and update the changelog per the `changelog-and-versioning` skill; update docs/OpenAPI, ADRs and `MEMORY.md` (`agent-memory-protocol`).
6. **Hand off:** summarize what changed, how it was verified, what's left and any risks or open questions.

## 2. Work Breakdown

- Break work into tasks that can be completed and verified in **about half a day or less**, each with a clear outcome.
- Slice **vertically** (a thin end-to-end behavior: UI + API + DB) rather than horizontally (all DB first, all UI later), so each slice is shippable and testable.
- Order tasks by risk and dependency: tackle unknowns and riskiest assumptions first, using spikes (time-boxed investigations) for unknowns.
- A good task states: goal, acceptance criteria, scope boundaries, dependencies and how to verify.
- Track tasks in the team's tracker (GitHub Issues, Linear, Jira). For solo/agent work without one, use a `TASKS.md` checklist at the repo root. Keep one source of truth.

Task template:

```markdown
## Goal
<one sentence outcome>

## Acceptance Criteria
- [ ] Given/When/Then or observable behavior
- [ ] Error and edge cases handled
- [ ] Tests added

## Out of Scope
-

## Notes / Dependencies
-
```

## 3. Planning Non-Trivial Changes

For anything touching more than a few files, a data model, an API contract or security, write a short plan before coding (in the PR description, issue, or `docs/plans/<topic>.md`):

```markdown
# Plan: <title>
## Problem and goal
## Approach (and alternatives considered)
## Steps (ordered, each independently verifiable)
## Data/API/contract changes (and migration/rollback)
## Risks and mitigations
## Test strategy
## Open questions
```

Keep it to about a page. Update it if the approach changes. Delete or archive when merged if it has no lasting value (decisions go to an ADR).

## 4. Architecture Decision Records (ADRs)

Record decisions that are hard to reverse or that future contributors will question (framework choice, data model, auth approach, major dependency, API style).

- Location: `docs/adr/NNNN-short-title.md` (numbered, immutable once accepted. Supersede with a new ADR instead of editing history).
- Keep each to one page.

```markdown
# ADR-0004: Store money as integer minor units

- Status: Accepted (2026-11-11)   <!-- Proposed | Accepted | Deprecated | Superseded by ADR-00XX -->
- Deciders: <names>

## Context
What forces and constraints led to this decision?

## Decision
What we will do.

## Consequences
Positive, negative and follow-up work.

## Alternatives considered
Option A: ... rejected because ...
```

Add a one-line pointer in `MEMORY.md` for quick recall.

## 5. Definition of Ready and Done

**Ready to start** (don't begin until true, or state assumptions):
- [ ] Goal and acceptance criteria are clear
- [ ] Dependencies and access are known
- [ ] Scope is small enough to finish and verify in one go

**Done** (see also `AGENTS.md`):
- [ ] Acceptance criteria met and demonstrated (tests and/or manual check)
- [ ] Code reviewed (self-review at minimum), lint/types/tests green in CI
- [ ] Security, accessibility, SEO and performance checks applied where relevant (see the skills listed in `AGENTS.md`)
- [ ] Migrations safe and reversible. API changes non-breaking or versioned
- [ ] Commit/PR title reads as a release note; changelog updated per the `changelog-and-versioning` skill; docs and `MEMORY.md` updated as needed
- [ ] Merged, and deployed or ready to deploy

## 6. Scope and Change Control

- Do what was asked, no more. Note related improvements as follow-up tasks instead of expanding the change silently.
- If scope grows or the approach must change significantly, stop and report it, since the person deciding needs the new trade-offs.
- Never make destructive or irreversible changes (data deletion, schema drops, force pushes, production config) without explicit confirmation.
- Record deferred work as issues/TODOs with context. Don't leave anonymous `TODO` comments. Use `TODO(#123): ...`.

## 7. Risk and Quality Management

- State assumptions explicitly, and flag any that are unverified.
- Prefer reversible changes: feature flags, small PRs, backward-compatible migrations, easy rollback.
- Identify blast radius before changing shared code, public APIs, auth, payments or data.
- Keep the build green. If you break `main`, fix forward or revert immediately.
- Treat flaky tests as bugs. Don't retry-until-green or disable without a tracked issue.
- Track technical debt visibly (issues labeled `tech-debt`) with impact and a proposed fix. Reserve regular capacity to pay it down.

## 8. Communication and Status Reporting

Status updates should be short, factual and actionable:

```markdown
**Done:** what is complete and verified
**In progress:** what's underway, and the next step
**Blocked / needs decision:** what, who, and by when
**Risks:** anything that could change scope, schedule or quality
```

- Report outcomes and evidence ("tests pass: 142/142; checkout flow verified locally"), not just activity.
- Be honest about what was *not* verified or not completed. Never claim success you haven't confirmed.
- Surface blockers early and propose options with a recommendation.

## 9. Handoffs Between Sessions and Agents

At the end of a session, leave the project so that a stranger could continue:
1. Working tree clean or committed in meaningful commits. Branch pushed if requested.
2. `MEMORY.md` → **Current State** shows what's done, what's next and blockers.
3. Issues/`TASKS.md` reflect the real status.
4. A final summary message with links to the PR/branch, how to run and verify, and open questions.

## 10. Recommended Repository Layout

```
/
├── AGENTS.md              # Rules for agents (stable, human-owned)
├── MEMORY.md              # Learned facts and current state (agent-maintained)
├── CHANGELOG.md           # User-facing release history
├── TASKS.md               # Optional: task list when no external tracker
├── README.md              # Humans: what it is, how to run it
├── .github/
│   ├── pull_request_template.md
│   └── ISSUE_TEMPLATE/
├── .claude/skills/        # Skill folders (each contains SKILL.md)
└── docs/
    ├── adr/               # Architecture Decision Records
    ├── plans/             # Optional: short implementation plans
    └── memory/            # Optional: area-specific memory when MEMORY.md grows
```

## 11. Cadence (Optional, for Teams)

- **Daily:** keep the board current. Surface blockers.
- **Weekly:** review the backlog, re-prioritize, prune stale issues and `MEMORY.md`.
- **Per release:** update the changelog and version per the `changelog-and-versioning` skill, verify the release checklist, and run a short retro (what worked, what didn't, one improvement to try).

## Review Checklist

- [ ] Goal, acceptance criteria and scope are written down before implementation
- [ ] Work is split into small, verifiable, vertical slices
- [ ] Significant decisions recorded in an ADR; plan written for non-trivial changes
- [ ] Verified by running tests and the feature; Definition of Done satisfied
- [ ] Scope respected; follow-ups tracked as issues; destructive actions confirmed
- [ ] Status report is factual, with blockers and risks surfaced
- [ ] Handoff state is in `MEMORY.md`, tracker and PR description
