# Using agent-kit in a monorepo

This is a guide only. agent-kit ships no monorepo configs, and the installer installs one preset per target directory. In a monorepo, install core (and packs) at the root, then add per-package pieces by hand or by running the installer per package with care.

## Layout

```
/
├── AGENTS.md                 # root rules: core block (+ web block), repo-wide tooling
├── CLAUDE.md                 # @AGENTS.md
├── MEMORY.md                 # one memory file, with a section per package
├── .claude/
│   ├── settings.json
│   └── skills/               # shared skills (core, packs)
├── packages/
│   ├── web/
│   │   ├── AGENTS.md         # package rules: stack, commands, package-only skills
│   │   ├── CLAUDE.md         # @AGENTS.md (needed for Claude Code, see below)
│   │   └── .claude/skills/   # optional: skills scoped to this package
│   └── api/
│       ├── AGENTS.md
│       └── CLAUDE.md         # @AGENTS.md
├── release-please-config.json
└── .release-please-manifest.json
```

## Root vs nested AGENTS.md

- Install core at the root: `install --target . --pack web --pack github`. The root `AGENTS.md` holds the universal rules and the shared skill index.
- Give each package its own `AGENTS.md` with what differs there: the stack, exact commands (`npm test -w packages/web`, `pytest packages/api`), and package-only conventions. Say in the nested file that the root rules still apply.
- **Claude Code: add a `CLAUDE.md` containing `@AGENTS.md` next to every nested `AGENTS.md`.** Because the kit installs a root `CLAUDE.md`, Claude Code by default reads `CLAUDE.md` files only and does not pick up `AGENTS.md` files directly, nested ones included. Subdirectory `CLAUDE.md` files load on demand, when Claude reads a file in that package. (Checked against the Claude Code memory docs, 2026-11-11. The alternative is the **Project instructions** setting `claude-md-and-agents-md`.)
- Keep nested files short. Rules that apply everywhere belong at the root, and on-demand files over Claude Code's per-file size limit are truncated.

## Presets per package

Presets assume they own the repository root (for example `eslint.config.mjs`, `.husky/`, `.pre-commit-config.yaml`), and the installer refuses to combine presets that ship different versions of the same file. Options:

- **One stack at the root.** If every package shares a stack (say, all TypeScript), install that preset at the root and use workspace-aware commands.
- **Mixed stacks.** Install the dominant preset at the root, then port the other stack's configs into its package by hand, using the preset's `files/` folder as the reference (for example `ruff.toml` and `pytest.ini` into `packages/api/`). Git hooks are per repository, so pick one hook runner (husky or pre-commit) and call the other stack's checks from it.
- Running `install --target packages/api --preset python` writes core files (skills, `MEMORY.md`, `AGENTS.md`) into the package too. That is usually not what you want. If you do it, delete the duplicated core files and keep only the preset's tooling and a nested `AGENTS.md`.

## Skills

- Shared skills live in the root `.claude/skills/`.
- Package-specific skills (for example `react-principles` used only by `packages/web`) can live in `packages/web/.claude/skills/`, if your agent loads skills from nested folders. Otherwise keep them at the root, and list them in the root index with "Load when: working in packages/web".
- `validate` checks the root `.claude/skills/` against the root `AGENTS.md`. It does not check nested skill folders.

## One MEMORY.md, sections per package

Keep a single root `MEMORY.md`, so agents read one file at session start. Add a short section per package (commands, gotchas, current state) and keep the 200-line budget. When a package's notes grow, move them to `docs/memory/<package>.md` and leave a one-line pointer (see the `agent-memory-protocol` skill, "Optional Scaling Pattern").

## Releases per package

release-please supports monorepos through `packages` in `release-please-config.json`:

```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "include-component-in-tag": true,
  "packages": {
    "packages/web": { "release-type": "node", "component": "web" },
    "packages/api": { "release-type": "python", "component": "api" }
  }
}
```

The `.release-please-manifest.json` then holds one version per path. Set `include-component-in-tag: true` (the presets use `false` for single-package repos), so tags become `web-v1.2.0`. Each package gets its own `CHANGELOG.md`. Use commit scopes or paths so release-please attributes changes to the right package: it decides by the files a commit touches. This is untested in this kit; check the release-please docs for your version.

## Where managed blocks help

- Use your own block ids in the root `AGENTS.md`, `.gitignore` or `.prettierignore` (for example `<!-- BEGIN agent-kit:pkg-web -->`), and keep a fragment per package in your repo. The markers keep generated sections apart from hand-written text, and `validate` checks that they stay paired and unique.
- The installer manages only the block ids its manifests define. Your own ids are left alone, so re-running `install` at the root never touches them.
