# react-typescript preset: setup

Installed by agent-kit. This preset adds React + TypeScript tooling and the `react-principles` skill. It always brings the `web` pack (HTML/accessibility and SEO skills). With `--pack github` it also adds CI, release-please and Dependabot.

The installer never edits `package.json`. Run the commands below yourself.

## 1. Install the tooling

```bash
npm install -D \
  eslint@9 @eslint/js@9 typescript typescript-eslint globals \
  eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-jsx-a11y eslint-config-prettier \
  prettier husky lint-staged @commitlint/cli @commitlint/config-conventional

npm pkg set scripts.prepare="husky"
npm pkg set scripts.lint="eslint ."
npm pkg set scripts.format="prettier --write ."
npm pkg set scripts.format:check="prettier --check ."
npm pkg set scripts.typecheck="tsc --noEmit"

npm run prepare          # activates the git hooks in .husky/ (sets core.hooksPath)
```

`test` and `build` scripts come from your framework scaffold (Vite, Next.js, etc.). Add `tsconfig.json`, the framework config and a test runner (Vitest or Jest + React Testing Library) from your scaffolder. They are intentionally not included.

Using pnpm or yarn? Swap the install commands, replace `npm ci` / `npm audit` in `.github/workflows/ci.yml`, and change `npx` in `.husky/*` to `pnpm exec` / `yarn`.

### Why `eslint@9`?

Verified on 2026-11-11: plain `npm install eslint` resolves ESLint 10, but `eslint-plugin-jsx-a11y@6.10.2` only declares support up to ESLint 9, so npm fails with `ERESOLVE`. Forcing it with `--legacy-peer-deps` also pulls in TypeScript 7, which `typescript-eslint` rejects (it needs TypeScript 6.x). npm prints a "no longer supported" warning for ESLint 9; that is expected.

Once `eslint-plugin-jsx-a11y` supports ESLint 10 (`npm view eslint-plugin-jsx-a11y peerDependencies`), drop the `@9` pins and check that `npm run lint` still passes. Consider recording this in your `MEMORY.md` under Gotchas:

```
- [2026-11-11] Keep `eslint` and `@eslint/js` pinned to `@9` until eslint-plugin-jsx-a11y supports ESLint 10 (npm ERESOLVE otherwise). See docs/agent-kit/react-typescript.md. (verified)
```

## 2. Check it works

```bash
echo "feat(auth): add passkey login" | npx commitlint     # passes
echo "Added stuff." | npx commitlint                       # fails
npm run lint
npx prettier --check .
```

Husky v9 hook files have no shebang and need the exec bit on macOS/Linux (the installer sets it there). On Windows, run `git update-index --chmod=+x .husky/pre-commit .husky/commit-msg` before committing them, so they work for colleagues on other systems.

## 3. GitHub repository settings (only with `--pack github`)

1. **Pull requests: allow squash merging only**, with *Default to pull request title* as the commit message. This makes the PR title the release note.
2. **Branch protection on `main`**: require a pull request, require the `checks` and `pr-title` status checks, block force pushes.
3. **Actions > General > Workflow permissions**: *Read and write*, and tick **Allow GitHub Actions to create and approve pull requests** (needed by release-please).
4. Optional: add a `RELEASE_PLEASE_TOKEN` secret (PAT or GitHub App token) and pass it in `.github/workflows/release-please.yml`. PRs opened with the default `GITHUB_TOKEN` do not trigger other workflows, so without it CI does not run on the release PR.

## 4. How releases work (only with `--pack github`)

1. Merge PRs to `main` with Conventional Commit titles.
2. release-please opens (and keeps updating) a **release PR** with the next version and the generated `CHANGELOG.md` section.
3. Review and merge the release PR. release-please tags `vX.Y.Z` and creates the GitHub Release.

Version bumps: `fix` is patch, `feat` is minor, `!` or a `BREAKING CHANGE:` footer is major (below 1.0.0, breaking changes bump minor). The first release starts from `0.0.0` in `.release-please-manifest.json`. Changelog sections use Keep a Changelog names: `feat` is Added, `fix` is Fixed, `perf` and `revert` are Changed; other types are hidden.

Without the github pack, release-please files are not installed and the `changelog-and-versioning` skill uses manual mode.

## 5. Customize

- **Scopes:** uncomment `scope-enum` in `commitlint.config.mjs`.
- **Changelog sections:** edit `changelog-sections` in `release-please-config.json`.
- **Ignore lists:** add your own lines to `.gitignore` / `.prettierignore` outside the `agent-kit` markers. The installer only manages the text between the markers.
- **Not using release-please?** Delete `release-please-config.json`, `.release-please-manifest.json` and `.github/workflows/release-please.yml`. The `changelog-and-versioning` skill switches to manual mode when `release-please-config.json` is absent.
