---
name: changelog-and-versioning
description: Rules for maintaining CHANGELOG.md (Keep a Changelog format) and Semantic Versioning. Use when making any user-facing change, fixing a bug, deprecating or removing a feature, preparing a release, or deciding a version number.
---

# Changelog and Versioning

The changelog tells **users and operators** what changed between versions. It is not a copy of the git log. Git records every commit, the changelog records what matters to someone upgrading.

## Modes: automated and manual

Check which mode applies before touching `CHANGELOG.md`: **automated mode applies only if `release-please-config.json` exists at the repository root.** Otherwise use manual mode.

**Automated mode (release-please).** `release-please-config.json` and the release-please workflow generate `CHANGELOG.md` and the version bump from Conventional Commits.
- The squash-merged PR title (a Conventional Commit) **is** the changelog entry. Write it for the reader: the user-visible effect, not the implementation.
- Do **not** hand-edit `CHANGELOG.md` or version fields. release-please keeps a "release PR" open. Merging it updates the changelog, bumps the version and tags `vX.Y.Z`. Fix wording by editing the release PR before merging.
- Sections follow Keep a Changelog names: `feat` becomes Added, `fix` becomes Fixed, `perf` and `revert` become Changed. `docs`, `refactor`, `test`, `build`, `ci`, `chore` and `style` are hidden. Breaking changes (`!` or a `BREAKING CHANGE:` footer) get their own call-out and a major bump. For security fixes use `fix(security): ...` and say so plainly. For deprecations and removals use clear wording, and `!` when breaking.

**Manual mode.** If there is no `release-please-config.json` at the repository root, follow sections 1-5 below and keep an `[Unreleased]` section. Never mix the two modes. Section 6 (SemVer) applies to both.

## 1. Format (Keep a Changelog 1.1.0)

`CHANGELOG.md` at the repository root, newest release first, with an `Unreleased` section at the top:

```markdown
# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Passkey login for web accounts. (#482)

## [1.4.0] - 2026-11-11

### Added
- ...

### Changed
- ...

### Deprecated
- ...

### Removed
- ...

### Fixed
- ...

### Security
- ...

[Unreleased]: https://github.com/org/repo/compare/v1.4.0...HEAD
[1.4.0]: https://github.com/org/repo/compare/v1.3.0...v1.4.0
```

**Sections (use only those that apply, in this order)**

| Section | Content |
|---|---|
| Added | New features |
| Changed | Changes to existing behavior |
| Deprecated | Features that will be removed soon |
| Removed | Features removed in this release |
| Fixed | Bug fixes |
| Security | Vulnerability fixes (reference CVE/advisory when public) |

## 2. What to Log (and What Not To)

**Log** anything a user, API consumer, operator or integrator would notice or must act on:
- New or changed features, UI behavior, API endpoints/fields, CLI flags, config options, environment variables
- Bug fixes visible to users
- Performance changes that are noticeable
- Deprecations and removals, with migration guidance
- Security fixes
- Required actions for upgrading (migrations, config changes)
- Dependency changes only when they affect users (new minimum runtime version, license change)

**Don't log**
- Internal refactors, formatting, test-only changes, CI tweaks, comment/docs typos
- Individual commits, work-in-progress details, or developer chatter

## 3. Writing Entries

- Write for the **reader**, in plain language, describing the effect and not the implementation.
  - Good: "Fixed duplicate charges when the payment button was clicked twice."
  - Bad: "Refactored PaymentService.create to use idempotency middleware."
- Start with a past-tense or neutral verb (Added, Fixed, Removed) or a clear noun phrase. Be consistent.
- One line per change, with a reference (issue/PR number) where possible.
- **Breaking changes** are called out clearly with migration steps, ideally prefixed `**BREAKING:**`.
- Don't use vague entries ("Various fixes", "Improvements", "Bug fixes").
- Use ISO dates (`YYYY-MM-DD`). Never use relative dates.

## 4. When to Update (Workflow)

- **With the change, in the same PR/commit.** Add the entry under `## [Unreleased]` in the appropriate section. A PR that changes user-facing behavior without a changelog entry is incomplete.
- Pure internal changes (`refactor`, `test`, `ci`, `style`, `chore`, internal `docs`) usually need no entry.
- Mapping from Conventional Commits:

| Commit | Changelog |
|---|---|
| `feat` | Added (or Changed) |
| `fix` | Fixed (or Security) |
| `perf` | Changed |
| `feat!` / `BREAKING CHANGE` | Changed/Removed + **BREAKING** note |
| `revert` | Fixed/Changed, as appropriate |
| `docs`, `refactor`, `test`, `ci`, `chore`, `style` | usually none |

## 5. Release Process

1. Decide the version number from the changes (section 6).
2. In `CHANGELOG.md`: rename `[Unreleased]` content into `## [X.Y.Z] - YYYY-MM-DD`, then add a fresh empty `## [Unreleased]` above it. Update the comparison links at the bottom.
3. Update the version in the manifest files (`package.json`, `pyproject.toml`, etc.).
4. Commit: `chore(release): vX.Y.Z`.
5. Create an annotated tag `vX.Y.Z` and push. CI builds and publishes from the tag.
6. Publish release notes (GitHub Release) using the changelog section for that version.

Automation is welcome (release-please, semantic-release, changesets). If used, keep a human edit pass so entries read well for users, and don't mix automated and manual formats.

## 6. Semantic Versioning (MAJOR.MINOR.PATCH)

| Bump | When | Example |
|---|---|---|
| **MAJOR** | Backward-incompatible changes to the public API/contract | 1.4.2 → 2.0.0 |
| **MINOR** | Backward-compatible new functionality; deprecations | 1.4.2 → 1.5.0 |
| **PATCH** | Backward-compatible bug fixes | 1.4.2 → 1.4.3 |

- Define what the "public API" is for this project (HTTP API, library exports, CLI, config schema, DB schema if consumed externally).
- `0.y.z` is initial development: anything may change. Move to `1.0.0` when the API is considered stable or in production use.
- Pre-releases: `1.5.0-rc.1`, `1.5.0-beta.2`. Build metadata: `1.5.0+build.7`.
- Never change or re-publish an already-released version. Fix forward with a new version.
- Deprecate first (MINOR), then remove in the next MAJOR, with at least one release of notice and a migration path.
- Web applications without external API consumers may use date-based or build-number versions, but still keep a changelog.

## 7. Examples

```markdown
## [Unreleased]

### Added
- Export orders to CSV from the Orders page. (#511)

### Fixed
- Cart total no longer shows NaN when a coupon expires during checkout. (#517)

### Security
- Fixed an access control flaw that allowed viewing other customers' invoices by changing the URL ID. (GHSA-xxxx-xxxx-xxxx)

## [2.0.0] - 2026-11-11

### Changed
- **BREAKING:** `GET /v1/orders` now returns cursor-based pagination (`nextCursor`) instead of `page`/`pageSize`. See the migration guide in docs/migrations/2.0.md.

### Removed
- **BREAKING:** Dropped Node 18 support; Node 20+ is required.
```

## Review Checklist

- [ ] Manual mode: user-facing change has an entry under `[Unreleased]` in the correct section. Automated mode: the PR title reads as the release note
- [ ] Entry describes the user-visible effect, is specific, and references the issue/PR
- [ ] Breaking changes and deprecations flagged with migration steps
- [ ] Version bump matches the change types (SemVer)
- [ ] On release: date set, new empty `Unreleased` added, links updated, tag created
- [ ] No internal-only noise, no secrets or sensitive vulnerability details before a fix is public
