## React + TypeScript

| Area | Skill | Load when |
|---|---|---|
| React | `react-principles` | Creating/refactoring components and Hooks, props, state, effects, abstractions, memoization |

### Tooling (installed by the react-typescript preset; don't work around it)

| Tool | Config | Enforces |
|---|---|---|
| commitlint + husky `commit-msg` | `commitlint.config.mjs`, `.husky/commit-msg` | Conventional Commit format on every commit |
| lint-staged + husky `pre-commit` | `.lintstagedrc.json`, `.husky/pre-commit` | ESLint and Prettier on staged files |
| ESLint | `eslint.config.mjs` | TypeScript, React, Hooks and jsx-a11y rules |
| Prettier | `.prettierrc.json`, `.prettierignore` | Formatting |
| EditorConfig | `.editorconfig` | Charset, line endings, indentation |

Never bypass these (`--no-verify`, disabling rules to make a check pass). Fix the underlying issue. Setup and versions: `docs/agent-kit/react-typescript.md`.
