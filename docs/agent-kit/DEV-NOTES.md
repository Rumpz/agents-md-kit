# DEV-NOTES (working memory for developing this kit)

Not shipped (not in package.json `files`). The template's own `MEMORY.md` lives at `core/files/MEMORY.md`.

## Current State
- [2026-11-11] HANDOFF.md steps 1-5 done: core, web + github packs, react-typescript, node-backend and python presets, installer, validator, tests, README, docs/monorepo.md. `_source/` removed.
- The original unzip at `./agent-kit/` was deleted by the user on 2026-11-11.
- [2026-11-11] Git repo initialised on `main` with one commit per milestone. No remote, nothing pushed.
- [2026-11-11] User decided to publish to npm as `agents-md-kit` (MIT), reversing the handoff's "do not publish" default. package.json: name, version 0.1.0, license, keywords; bin command `agents-md-kit`. Markers (`agent-kit:<id>`), `docs/agent-kit/` and `bin/agent-kit.js` keep the short name. Verified from a local `npm pack` tarball installed in a scratch project: `npx agents-md-kit` list, dry run, --apply, validate, re-apply (0 writes).
- [2026-11-11] Published `agents-md-kit@0.1.0` to npm (account `rumpz`, 2FA auth-and-writes) and pushed `main` to github.com/Rumpz/agents-md-kit. Verified `npx agents-md-kit` from the live registry. npm showed only a `0.0.0-stage` placeholder for about a minute after publishing (registry lag); that placeholder version still exists, harmless.
- [2026-11-12] Released 0.1.1 via the publish workflow (trusted publishing). Added `--help` listing packs/presets, and `.github/workflows/ci.yml` (Node 20/22/24 x Linux/macOS/Windows): all 9 jobs passed.
- Next: consider bumping GitHub Action majors in the presets' workflows (see Gotchas); run the presets' real tools on Linux/macOS.

## Commands (verified 2026-11-11, Node 22.18 / npm 11.19 / Python 3.13 on Windows 11)
| Task | Command |
|---|---|
| Everything | `npm run check` (type-check + tests + template check; needs `npm install` once) |
| Tests | `npm test` (= `node --test`) |
| Template check | `node bin/agent-kit.js validate --template` |
| Dry run | `node bin/agent-kit.js install --target <dir> --preset <p> --pack github` |

## Decisions
- [2026-11-11] Source stays JavaScript; types are JSDoc checked with `tsc --noEmit --checkJs` (strict). TypeScript and @types/node are dev dependencies only. A full TS conversion was rejected: Node will not strip types inside node_modules, so it would need a build step and break running from a clone.
- [2026-11-11] react-typescript always brings the web pack, via manifest line `implies <pack>` (user decision).
- [2026-11-11] release-please config, manifest and `CHANGELOG.md` are installed only with the github pack (`requires=github`), so the changelog skill's "config exists => automated mode" rule never points at release-please that cannot run.
- [2026-11-11] Presets are alternatives: `validate --template` allows presets to share a copy destination; the installer refuses to combine presets whose content for a shared destination differs.
- [2026-11-11] Prettier presets ignore kit-owned, overwritten files (`AGENTS.md`, `CLAUDE.md`, `.claude/`, `docs/agent-kit/`, GitHub templates) in their `.prettierignore` block. Without this, lint-staged reformats them and the next install reports conflicts. User-owned copy-once files (MEMORY.md, ADR template) are shipped Prettier-clean instead.
- Manifest extension `from=<unit-relative path>`; LF/CRLF-only differences count as unchanged; block conflicts write all proposed blocks for that file to one `.new`; existing `.new` refreshed only when content changes; missing target dir is an error; CLAUDE.md is a plain `copy`.
- `.claude/settings.json` deny rules use `Bash(cmd *)` (docs checked 2026-11-11).
- [2026-11-11] Setup commands live in manifests as `# run: <command>` lines (HANDOFF section 6: "the installer prints the commands"). `validate --template` requires at least one per preset.
- [2026-11-11] Verified in a real autocrlf=true clone: after git checks every file out as CRLF, re-install writes 0 files.
- [2026-11-11] Claude Code reads only CLAUDE.md when one exists, so nested AGENTS.md need a sibling CLAUDE.md with `@AGENTS.md` (docs/monorepo.md).
- CLI logic in `src/cli.js`; `bin/agent-kit.js` calls `main` unconditionally (npm runs bins via symlink).

## Gotchas
- [2026-11-11] `eslint-plugin-jsx-a11y@6.10.2` still caps ESLint at 9 (react preset keeps `eslint@9` pins). node-backend runs unpinned: ESLint 10.14 + TypeScript 6.0.3 (npm picks a TS that satisfies typescript-eslint's `<6.1.0` peer; TS 7.0.2 is latest). (verified)
- [2026-11-11] Workflows use actions/checkout@v4, setup-node@v4, setup-python@v5, release-please-action@v4, action-semantic-pull-request@v5; latest majors are v7, v7, v7, v5, v6. Not bumped because Actions can't be run here. (unverified compatibility)
- [2026-11-11] pre-commit: without `default_stages: [pre-commit]`, file hooks also run (as skipped) in the commit-msg stage.
- [2026-11-11] Kit upgrades of `copy` files appear as `.new` conflicts in installed repos (installer can't tell user edits from older kit versions). A future improvement: record installed hashes.
- [2026-11-11] Windows without Developer Mode cannot create file symlinks (EPERM); tests fall back to junctions, which `lstat` reports as symlinks. (verified)
- [2026-11-11] `node --test` with no args also runs `test/helpers.js` as a (0-test) file. Harmless.
