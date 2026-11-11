# node-backend preset: setup

Installed by agent-kit. This preset adds tooling for a Node.js + TypeScript backend: ESLint (typescript-eslint, Node globals), Prettier, EditorConfig, and commitlint + husky + lint-staged. With `--pack github` it also adds CI, release-please and Dependabot. It adds no skills of its own: the core skills (`backend-architecture-principles`, `api-design-rest`, `backend-security`, `database-best-practices`) already cover backend work.

The installer never edits `package.json`. Run the commands below yourself.

## 1. Install the tooling

```bash
npm install -D \
  eslint @eslint/js typescript typescript-eslint globals eslint-config-prettier \
  prettier husky lint-staged @commitlint/cli @commitlint/config-conventional

npm pkg set scripts.prepare="husky"
npm pkg set scripts.lint="eslint ."
npm pkg set scripts.format="prettier --write ."
npm pkg set scripts.format:check="prettier --check ."
npm pkg set scripts.typecheck="tsc --noEmit"

npm run prepare          # activates the git hooks in .husky/ (sets core.hooksPath)
```

Verified on 2026-11-11 with npm 11: this resolves ESLint 10 and TypeScript 6.0.x. `typescript-eslint` 8.x supports ESLint 10 but only TypeScript below 6.1, and npm picks a compatible TypeScript automatically. If you pin TypeScript yourself, stay on 6.0.x until `typescript-eslint` supports TypeScript 7 (`npm view typescript-eslint peerDependencies`).

Add `tsconfig.json`, a test runner (`node:test`, Vitest or Jest) and `test` / `build` scripts for your project. They are intentionally not included.

Using pnpm or yarn? Swap the install commands, replace `npm ci` / `npm audit` in `.github/workflows/ci.yml`, and change `npx` in `.husky/*` to `pnpm exec` / `yarn`.

## 2. Check it works

```bash
echo "feat(api): add order export" | npx commitlint      # passes
echo "Added stuff." | npx commitlint                     # fails
npm run lint
npx prettier --check .
```

Husky v9 hook files have no shebang and need the exec bit on macOS/Linux (the installer sets it there). On Windows, run `git update-index --chmod=+x .husky/pre-commit .husky/commit-msg` before committing them.

## 3. GitHub repository settings (only with `--pack github`)

1. **Pull requests: allow squash merging only**, with *Default to pull request title* as the commit message. This makes the PR title the release note.
2. **Branch protection on `main`**: require a pull request, require the `checks` and `pr-title` status checks, block force pushes.
3. **Actions > General > Workflow permissions**: *Read and write*, and tick **Allow GitHub Actions to create and approve pull requests** (needed by release-please).
4. Optional: add a `RELEASE_PLEASE_TOKEN` secret (PAT or GitHub App token) and pass it in `.github/workflows/release-please.yml`. PRs opened with the default `GITHUB_TOKEN` do not trigger other workflows, so without it CI does not run on the release PR.

CI (`.github/workflows/ci.yml`) runs `npm ci`, then lint, format check, typecheck, test and build (each with `--if-present`; remove the flag once the script exists so a missing script fails the build), and `npm audit --omit=dev --audit-level=high`. Set `node-version` to the version you deploy on.

## 4. How releases work (only with `--pack github`)

release-please uses `release-type: node`: it bumps `version` in `package.json`, writes `CHANGELOG.md` and tags `vX.Y.Z` when you merge its release PR. The first release starts from `0.0.0` in `.release-please-manifest.json`. `feat` is Added, `fix` is Fixed, `perf` and `revert` are Changed; other types are hidden. Below 1.0.0, breaking changes bump minor.

Without the github pack, release-please files are not installed and the `changelog-and-versioning` skill uses manual mode.

## 5. Customize

- **Scopes:** uncomment `scope-enum` in `commitlint.config.mjs`.
- **Type-aware lint rules:** switch to `tseslint.configs.recommendedTypeChecked` and add `languageOptions.parserOptions.projectService: true` once `tsconfig.json` exists (slower, catches floating promises and unsafe `any`).
- **Ignore lists:** add your own lines to `.gitignore` / `.prettierignore` outside the `agent-kit` markers.
- **Not using release-please?** Delete `release-please-config.json`, `.release-please-manifest.json` and `.github/workflows/release-please.yml`; the `changelog-and-versioning` skill switches to manual mode.
