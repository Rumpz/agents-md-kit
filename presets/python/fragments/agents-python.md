## Python

### Tooling (installed by the python preset; don't work around it)

| Tool | Config | Enforces |
|---|---|---|
| pre-commit `commit-msg` | `.pre-commit-config.yaml` (conventional-pre-commit) | Conventional Commit format on every commit |
| pre-commit `pre-commit` | `.pre-commit-config.yaml` | Ruff lint (with fixes) and format; YAML/TOML/JSON syntax; merge markers; large files |
| Ruff | `ruff.toml` | Lint rules (pyflakes, bugbear, bandit, pyupgrade, imports) and formatting |
| pytest | `pytest.ini` | Test discovery in `tests/`, strict markers and config |
| mypy (optional) | `mypy.ini` | Strict type checking |
| EditorConfig | `.editorconfig` | Charset, line endings, indentation |

Never bypass these (`--no-verify`, disabling rules to make a check pass). Fix the underlying issue. Keep this configuration out of `pyproject.toml`. Setup and versions: `docs/agent-kit/python.md`.
