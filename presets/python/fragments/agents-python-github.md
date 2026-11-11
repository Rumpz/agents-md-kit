### GitHub automation (python preset + github pack)

| Tool | Config | Enforces |
|---|---|---|
| CI | `.github/workflows/ci.yml` | Ruff lint, Ruff format check, pytest |
| release-please | `release-please-config.json`, `.release-please-manifest.json`, `.github/workflows/release-please.yml` | Version bumps (`pyproject.toml` and related files), `CHANGELOG.md`, tags. Don't hand-edit `CHANGELOG.md` or version fields |
| Dependabot | `.github/dependabot.yml` | Weekly pip and GitHub Actions updates with Conventional Commit messages |
