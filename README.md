# agent-kit

Installs AI coding-agent configuration into a repository: `AGENTS.md` rules, `MEMORY.md`, Claude Code skills and permissions, and optional stack tooling (linting, commit checks, CI, releases). It is a zero-dependency Node CLI that is safe to run on existing repos: **dry run by default, never overwrites, conflicts go to `.new` files.**

## Quick start

1. Get the kit: `git clone <repo-url> agent-kit && cd agent-kit`. Or skip the clone and replace `node bin/agent-kit.js` with `npx github:<owner>/<repo>` below.
2. Preview the plan (dry run, writes nothing):
   `node bin/agent-kit.js install --target ../my-repo --preset react-typescript --pack github`
3. Re-run with `--apply`, then `node bin/agent-kit.js validate --target ../my-repo`, and follow the printed next-steps doc (`docs/agent-kit/<preset>.md` in your repo).

Requires Node 20 or newer to run the installer. Your project does not need Node unless its preset does (the `python` preset doesn't).

```
node bin/agent-kit.js install [--preset <name>]... [--pack <name>]... [--target <dir>] [--apply]
node bin/agent-kit.js validate [--target <dir>] [--template]
node bin/agent-kit.js list
```

Exit codes: `0` success, `1` error, `2` install finished with conflicts (review the `.new` files).

## What gets installed

**core** (always): a tool-agnostic `AGENTS.md` block (session start, universal rules, definition of done, file ownership, skill index), `CLAUDE.md` (`@AGENTS.md`), a `MEMORY.md` template, `.claude/settings.json` deny rules, an ADR template, and eight skills: `agent-memory-protocol`, `git-commit-and-workflow`, `changelog-and-versioning`, `project-management-workflow`, `backend-security`, `api-design-rest`, `database-best-practices` and `backend-architecture-principles`. Core assumes no language, package manager, CI vendor or release tool. The skills detect what is configured (for example, `changelog-and-versioning` uses automated mode only when `release-please-config.json` exists).

**Packs** (`--pack`) add skills and files with no tooling assumptions:

| Pack | Adds |
|---|---|
| `web` | `html-syntax-and-semantics` and `seo-best-practices` skills, plus their `AGENTS.md` block |
| `github` | PR template, issue templates, PR-title check workflow. Also enables the GitHub parts of presets (CI, Dependabot, release-please) |

**Presets** (`--preset`) add a stack's tooling and setup guide. Pick one per repository:

| Preset | Adds | With `--pack github` |
|---|---|---|
| `react-typescript` | ESLint 9 (TypeScript, React, Hooks, jsx-a11y), Prettier, EditorConfig, commitlint + husky + lint-staged, `react-principles` skill. Always brings the `web` pack | CI, release-please (node), Dependabot (npm + actions) |
| `node-backend` | ESLint (typescript-eslint, Node globals), Prettier, EditorConfig, commitlint + husky + lint-staged | CI, release-please (node), Dependabot (npm + actions) |
| `python` | Ruff, pytest, optional mypy, pre-commit hooks (Conventional Commits, Ruff), EditorConfig. No Node needed | CI, release-please (python), Dependabot (pip + actions) |

release-please config and `CHANGELOG.md` come only with `--pack github`, because release-please runs as a GitHub Action. Without it, the `changelog-and-versioning` skill uses manual mode.

## Safety guarantees

- **Dry run by default.** Nothing is written without `--apply`. Every change is planned in memory first; any error stops the run before the first write.
- **Never overwrites.** A file that differs from the kit's version is left alone and the kit's version is written to `<path>.new`, reported as a conflict (exit code 2). Files that differ only in LF/CRLF count as unchanged. `MEMORY.md`, `CHANGELOG.md` and the ADR template are created only if missing.
- **Managed blocks.** Shared files (`AGENTS.md`, `.gitignore`, `.prettierignore`) are edited only between `BEGIN agent-kit:<id>` / `END agent-kit:<id>` markers. Content outside the markers is preserved byte for byte, and the file keeps its LF or CRLF line endings. Malformed markers (unpaired, duplicated, nested) are never edited; the proposed blocks go to `<path>.new`.
- **Idempotent.** A second `--apply` changes nothing.
- **Stays inside the target.** Manifest paths that are absolute, contain `..` or backslashes are rejected, every destination is checked to be inside the target, and the installer refuses to write through symlinks or junctions anywhere on the path (including `.new` files).
- **Hooks.** `.husky/*` files get the exec bit on macOS/Linux. On Windows the installer prints the `git update-index --chmod=+x` command instead.

**Never touched:** `package.json`, `pyproject.toml`, `README.md` and lockfiles. They belong to you. The installer prints the commands to run instead (for example `npm install -D ...`, `npm pkg set scripts...` or `pre-commit install`), and the preset's setup doc (`docs/agent-kit/<preset>.md`) explains them.

## Updating an installed repo

Run the same install command again with a newer kit. Managed blocks update in place. Files you never changed but that the kit has since changed show up as conflicts with a `.new` file, because the installer can't tell your edits from older kit versions. Review each `.new`, keep what you want, then delete it. `validate` checks the result.

## Validate

`validate --target <repo>` checks an installed repo:
- Each skill's frontmatter `name` equals its folder and it has a `description`.
- The `AGENTS.md` skill index and the installed skills match in both directions.
- Backtick skill references resolve and don't end in `.md`.
- Managed markers are paired and unique.
- Kit-installed JSON parses.
- Kit-installed YAML gets a light check only: non-empty, no tab indentation. This is not a full parse.
- Husky hooks are executable (warning; skipped on Windows).

`validate --template` checks this kit:
- Every manifest source exists, and there are no orphan files.
- Core and packs don't share a `copy` destination.
- `requires=` and `implies` name real packs.
- Fragments contain no markers.
- Each unit's skills are listed in its own `AGENTS.md` fragment.
- Units only reference skills from core, themselves, or packs they imply.

## What is verified, and what is not

Verified on 2026-11-11 (Windows 11, Node 22.18, npm 11.19, Python 3.13):
- **Test suite:** `npm test` (installer and validator, run in temp directories).
- **react-typescript:** a planted bad component yields exactly 7 ESLint problems (5 errors, 2 warnings). A clean component passes ESLint and Prettier. husky rejects a bad commit message, accepts a good one and blocks a staged lint error.
- **node-backend:** the same commitlint/husky checks pass. ESLint catches planted errors in a TypeScript sample.
- **python:** `ruff check`, `ruff format --check`, `pytest` and `mypy` pass on a sample. pre-commit rejects a bad commit message, accepts a good one and blocks a staged Ruff error.
- **Clean install:** every preset installs, validates, and re-installs as a no-op.

**Untested:**
- GitHub Actions workflows (`ci.yml`, `pr-title.yml`, `release-please.yml`), Dependabot configs and release-please behavior. They parse (light check only for YAML) but have never run. The pinned action majors (`actions/checkout@v4`, `setup-node@v4`, `setup-python@v5`, `release-please-action@v4`, `action-semantic-pull-request@v5`) are behind the latest majors. Dependabot will propose updates; review their changelogs before merging.
- Node 20 (only Node 22 was run).
- macOS and Linux. Setting the exec bit and refusing file symlinks were exercised only through simulation and Windows junctions.
- `npx github:<owner>/<repo>` and pnpm/yarn variants.

`.claude/settings.json` deny rules use the documented `Bash(cmd *)` and `Read(./path)` forms (checked against the Claude Code permissions docs on 2026-11-11). Prefix deny rules are a guard rail, not a sandbox: a reordered command (`git push origin main --force`) is not matched.

## Adding a preset or pack

1. Create `presets/<name>/` (or `packs/<name>/`) with a `manifest.txt`. Put files under `files/<dest path>` and `AGENTS.md`/ignore-file fragments under `fragments/`.
2. Add an `AGENTS.md` block that lists the unit's skills in a table with a `Skill` column, plus a tooling table of only what the unit installs and enforces.
3. Put a setup guide in `docs/<name>.md` and install it with `copy docs/agent-kit/<name>.md from=docs/<name>.md`.
4. Run `node bin/agent-kit.js validate --template` and `npm test`. Then install into a scratch repo and actually run the tools.

Manifest format (one entry per line, `#` comments, fields split on whitespace, paths without spaces):

```
copy       <path> [requires=<pack>] [from=<unit-relative source>]   # create; identical -> unchanged; different -> <path>.new
copy-once  <path> [requires=<pack>] [from=<unit-relative source>]   # create only if missing
block      <id> <dest> <fragment> [style=html|hash] [requires=<pack>]
implies    <pack>                                                   # selecting this unit also selects the pack
# description: <one line shown by `agent-kit list`>
# run: <command>                                                    # printed after install (presets need at least one)
```

`requires=<pack>` entries install only when that pack is selected. `style=hash` uses `# BEGIN/END` markers (for `.gitignore`-style files). Presets may ship the same destination as another preset. The installer refuses to combine presets whose contents for that file differ.

## Monorepos

See [docs/monorepo.md](docs/monorepo.md).

## Development

```bash
npm test                                   # node:test, no dependencies
node bin/agent-kit.js validate --template  # check manifests, sources, fragments, skills
```

The package is publish-ready (`files`, `bin`, `engines`), but it is not published. Replace the `@your-scope` placeholder name and the `UNLICENSED` license before publishing.
