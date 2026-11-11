# python preset: setup

Installed by agent-kit. This preset adds Python tooling that does **not** need Node in your project: Ruff (lint + format), pytest, optional mypy, and git hooks through the [pre-commit](https://pre-commit.com) framework (Conventional Commit messages, Ruff, YAML/TOML/JSON syntax checks). With `--pack github` it also adds CI, release-please (`release-type: python`) and Dependabot.

All configuration lives in standalone files (`ruff.toml`, `pytest.ini`, `mypy.ini`, `.pre-commit-config.yaml`). The installer never edits `pyproject.toml`. Keep tool settings out of it too, or the two sources will disagree. Note that `pytest.ini` takes precedence over `[tool.pytest.ini_options]`.

## 1. Install the tools and the hooks

Use whatever you use for dev dependencies (pip, uv, Poetry, pipx). With pip in a virtualenv:

```bash
python -m pip install ruff==0.17.4 pytest pre-commit   # add mypy if you keep mypy.ini
pre-commit install          # installs the pre-commit and commit-msg hooks
```

`default_install_hook_types` in `.pre-commit-config.yaml` makes `pre-commit install` set up both hook types. The pinned hook revisions (verified 2026-11-11):

| Hook repo | rev | Hooks |
|---|---|---|
| `astral-sh/ruff-pre-commit` | `v0.17.4` | `ruff-check --fix`, `ruff-format` |
| `pre-commit/pre-commit-hooks` | `v6.0.0` | `check-yaml`, `check-toml`, `check-json`, `check-merge-conflict`, `check-added-large-files` |
| `compilerla/conventional-pre-commit` | `v4.5.0` | `conventional-pre-commit` (commit-msg stage) |

Update them with `pre-commit autoupdate`, and keep the `ruff==` pin in `.github/workflows/ci.yml` in sync with the ruff-pre-commit rev.

## 2. Check it works

```bash
ruff check .
ruff format --check .
pytest
mypy src            # optional
git commit -m "Added stuff."        # rejected by the commit-msg hook
git commit -m "feat: add totals"    # accepted
```

The commit-msg hook checks the Conventional Commits format and the allowed types. It does not enforce the 72-character header limit that commitlint enforces in the Node presets. Keep headers short anyway (see the `git-commit-and-workflow` skill).

## 3. GitHub repository settings (only with `--pack github`)

1. **Pull requests: allow squash merging only**, with *Default to pull request title* as the commit message. This makes the PR title the release note.
2. **Branch protection on `main`**: require a pull request, require the `checks` and `pr-title` status checks, block force pushes.
3. **Actions > General > Workflow permissions**: *Read and write*, and tick **Allow GitHub Actions to create and approve pull requests** (needed by release-please).
4. Optional: add a `RELEASE_PLEASE_TOKEN` secret (PAT or GitHub App token) and pass it in `.github/workflows/release-please.yml`, so CI also runs on the release PR.

CI (`.github/workflows/ci.yml`) installs Ruff and pytest, then `requirements.txt` / `requirements-dev.txt` if present and the project itself (`pip install -e .`) if `pyproject.toml` exists, and runs `ruff check`, `ruff format --check` and `pytest`. Adjust the install step if you use uv or Poetry. pytest exits with code 5 when it collects no tests, so add at least one test before enabling CI.

## 4. What release-please expects (only with `--pack github`)

With `release-type: python`, merging the release PR updates `CHANGELOG.md`, tags `vX.Y.Z`, and bumps the version in these files when they exist:

- `pyproject.toml`: a **static** `version = "..."` under `[project]` (or `[tool.poetry]`). A `dynamic = ["version"]` setup is not bumped.
- `setup.py` and `setup.cfg`.
- `<package>/__init__.py` or `src/<package>/__init__.py` (`__version__ = "..."`), where the package name comes from `[project] name` (dashes also tried as underscores).
- Any `version.py`.

The first release starts from `0.0.0` in `.release-please-manifest.json`. Set `version = "0.0.0"` in `pyproject.toml` to match, or put your current version in the manifest. `feat` is Added, `fix` is Fixed, `perf` and `revert` are Changed; other types are hidden.

Without the github pack, release-please files are not installed and the `changelog-and-versioning` skill uses manual mode.

## 5. Customize

- **Rules:** edit `select` in `ruff.toml`. Set `target-version` there if you have no `requires-python`.
- **Types:** delete `mypy.ini` if you don't type-check; otherwise add mypy to CI and, if you like, as a pre-commit hook (`pre-commit/mirrors-mypy`).
- **Ignore lists:** add your own lines to `.gitignore` outside the `agent-kit` markers.
- **Not using release-please?** Delete `release-please-config.json`, `.release-please-manifest.json` and `.github/workflows/release-please.yml`; the `changelog-and-versioning` skill switches to manual mode.
