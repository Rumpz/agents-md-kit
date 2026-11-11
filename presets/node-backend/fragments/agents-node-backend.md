## Node.js backend (TypeScript)

### Tooling (installed by the node-backend preset; don't work around it)

| Tool | Config | Enforces |
|---|---|---|
| commitlint + husky `commit-msg` | `commitlint.config.mjs`, `.husky/commit-msg` | Conventional Commit format on every commit |
| lint-staged + husky `pre-commit` | `.lintstagedrc.json`, `.husky/pre-commit` | ESLint and Prettier on staged files |
| ESLint | `eslint.config.mjs` | TypeScript rules, Node globals, no `eval`, no stray `console` |
| Prettier | `.prettierrc.json`, `.prettierignore` | Formatting |
| EditorConfig | `.editorconfig` | Charset, line endings, indentation |

Never bypass these (`--no-verify`, disabling rules to make a check pass). Fix the underlying issue. Setup and versions: `docs/agent-kit/node-backend.md`.
