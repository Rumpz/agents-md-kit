### GitHub automation (react-typescript preset + github pack)

| Tool | Config | Enforces |
|---|---|---|
| CI | `.github/workflows/ci.yml` | Lint, format check, typecheck, test, build, dependency audit |
| release-please | `release-please-config.json`, `.release-please-manifest.json`, `.github/workflows/release-please.yml` | Version bumps, `CHANGELOG.md`, tags. Don't hand-edit `CHANGELOG.md` or version fields |
| Dependabot | `.github/dependabot.yml` | Weekly npm and GitHub Actions updates with Conventional Commit messages |
