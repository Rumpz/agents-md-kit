---
name: git-commit-and-workflow
description: Git commit, branch and pull request best practices using Conventional Commits. Use whenever creating commits, naming branches, preparing pull requests, writing commit messages, or when asked to commit, push, merge or release code.
---

# Git Commit and Workflow Rules

A good history lets people (and agents) understand *what changed and why* without reading every diff, and lets tools generate changelogs and versions automatically.

## 1. Commit Message Format (Conventional Commits 1.0)

```
<type>(<optional scope>): <subject>

<optional body: what and why, wrapped at ~72 chars>

<optional footers: BREAKING CHANGE, Refs, Co-authored-by>
```

**Types**

| Type | Use for | Version bump |
|---|---|---|
| `feat` | New user-facing capability | minor |
| `fix` | Bug fix | patch |
| `perf` | Performance improvement | patch |
| `refactor` | Code change with no behavior change | none |
| `docs` | Documentation only | none |
| `test` | Adding/fixing tests | none |
| `build` | Build system, dependencies | none |
| `ci` | CI configuration | none |
| `style` | Formatting only (no logic) | none |
| `chore` | Maintenance not fitting above | none |
| `revert` | Reverting a commit | depends |

**Subject rules**
- Imperative mood: "add", "fix", "remove" (not "added", "fixes").
- Lowercase after the colon, no trailing period, 72 characters or fewer.
- Describe the change's effect, not the activity ("fix crash on empty cart", not "fix bug" or "update stuff").
- Scope is the module/area: `feat(auth): add passkey login`.

**Body**
- Explain **why** the change was needed and any trade-offs or alternatives. The diff already shows *what*.
- Wrap at about 72 characters. Separate from the subject with a blank line.

**Footers**
- Breaking change: `BREAKING CHANGE: <what broke and how to migrate>` or `!` after type/scope (`feat(api)!: remove v1 endpoints`). Triggers a major version bump.
- Issue links: `Refs: #123`, `Closes: #123`.

**Examples**

```
feat(checkout): add idempotency key to payment creation

Duplicate submissions on flaky networks created double charges.
The key is stored for 24h and replays the original response.

Closes: #482
```

```
fix(auth): reject JWTs with alg=none

BREAKING CHANGE: tokens signed without a signature are no longer accepted.
```

## 2. Commit Hygiene

- **Atomic commits:** one logical change per commit. A commit should build and pass tests on its own.
- Keep tests and docs for a change in the same commit as the change.
- Separate refactors/formatting from behavior changes (never hide a logic change inside a reformat commit).
- Don't commit: secrets, `.env` files, credentials, build output, `node_modules`, large binaries, editor/OS files. Maintain `.gitignore`.
- No `WIP`, `fix stuff`, `asdf` commits on shared branches. Squash or rewrite local-only commits before pushing.
- Review `git status` and `git diff --staged` before every commit. Stage intentionally (`git add -p` or specific paths), not blindly `git add -A`.
- Run lint, type check and relevant tests before committing. Use pre-commit hooks (husky, lefthook, pre-commit) and `commitlint` to enforce format.

## 3. Branching

- Default to **trunk-based development**: short-lived branches (ideally under 2 days), merged often into `main`. Use feature flags for unfinished work.
- Branch names: `<type>/<short-kebab-description>` with an optional issue ID: `feat/passkey-login`, `fix/482-double-charge`, `chore/bump-eslint`.
- `main` is always deployable and protected: required reviews, passing CI, no direct pushes, no force pushes.
- Keep branches updated by rebasing on `main` (for private branches) or merging, per team convention. Be consistent.

## 4. Pull Requests

- Small and focused: ideally under about 400 changed lines, one concern each. Split large work into stacked or sequential PRs.
- Title follows Conventional Commits (squash-merge uses it as the commit message).
- Description includes: **what and why**, how it was tested, screenshots for UI, migration/rollback notes, linked issue, breaking changes.
- Self-review the diff before requesting review. Remove debug code and commented-out code.
- CI must pass. Address review comments with follow-up commits, then squash on merge (or keep a clean history if rebase-merging).
- Prefer **squash merge** for feature branches (one clean commit per PR) unless the individual commits are well crafted and meaningful.

PR template:

```markdown
## Summary
<!-- What changed and why -->

## Changes
-

## Testing
<!-- How you verified it: tests added, manual steps -->

## Risks / Rollback
<!-- Migrations, flags, breaking changes, how to revert -->

## Checklist
- [ ] Tests added/updated and passing
- [ ] Docs / OpenAPI updated
- [ ] PR title is a Conventional Commit written for the changelog reader (if release-please is configured, it becomes the release note)
- [ ] MEMORY.md updated (if new lasting knowledge)
```

## 5. Safety Rules (Especially for AI Agents)

- **Commit only when the user or project workflow asks for it.** Don't push, merge or open PRs unprompted.
- Never `git push --force` to shared branches (`main`, release branches). If a force push is needed on your own branch, use `--force-with-lease`.
- Never rewrite (amend, rebase, reset) commits that have already been pushed and shared.
- Never bypass hooks or checks (`--no-verify`, `--no-gpg-sign`) to make a commit pass. Fix the underlying failure.
- Never use destructive commands (`git reset --hard`, `git clean -fd`, `git checkout .`, branch deletion) without explicit confirmation, because they can destroy uncommitted work.
- If secrets were committed, treat them as compromised: rotate them first, then clean history.
- Don't commit unrelated changes you didn't make or don't understand. Leave them and mention them.
- If a pre-commit hook modifies files, review the changes and include them in a new commit rather than amending something already pushed.

## 6. Releases and Tags

- Version with Semantic Versioning (`MAJOR.MINOR.PATCH`). See `changelog-and-versioning`.
- Tag releases `vX.Y.Z` (annotated: `git tag -a v1.4.0 -m "v1.4.0"`). Releases are built from tags in CI.
- If release-please is configured (a `release-please-config.json` at the repository root), the PR title becomes the release note: merging the release PR updates `CHANGELOG.md`, bumps the version and tags `vX.Y.Z`. Use squash merges so the PR title becomes the commit message. Otherwise update `CHANGELOG.md` by hand. See `changelog-and-versioning` for both modes.
- Hotfixes: branch from the release tag, fix, tag a patch release, and merge the fix back to `main`.

## Review Checklist

- [ ] Message follows `type(scope): subject`, imperative, ≤72 chars, explains why in the body
- [ ] One logical change; tests and docs included; builds and passes locally
- [ ] No secrets, generated files or unrelated changes staged
- [ ] Branch name and PR title follow convention; PR is small and described
- [ ] No force pushes, no skipped hooks, no history rewrites of shared commits
- [ ] Commit/PR title written as a release note; changelog updated per `changelog-and-versioning`; MEMORY.md updated when required
