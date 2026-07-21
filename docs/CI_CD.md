# CI/CD & Quality Gates

Reference documentation for the automated pipeline that runs on every pull
request and push to `main`. Intended for handoff: read this before touching
`.github/workflows/ci.yml`, `.github/dependabot.yml`, or the lint/test config
files it depends on.

Source of truth: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).
If this document and the workflow file disagree, the workflow file wins —
update this doc to match.

## 1. Overview

- **Platform:** GitHub Actions.
- **Workflow file:** `.github/workflows/ci.yml` (single workflow, name `CI`).
- **Triggers:** every `pull_request`, and every `push` to `main`.
- **Concurrency:** one run per branch/ref at a time — a new push cancels the
  in-flight run for the same ref (`cancel-in-progress: true`), so only the
  latest commit's results matter.
- **Permissions:** `contents: read` only. The workflow does not write to the
  repo, push tags, or need elevated tokens.
- **Monorepo-aware:** the repo hosts an independent `backend/` (Python/FastAPI)
  and `frontend/` (React/Vite) project. CI detects which side changed and
  only runs the relevant checks.

```
pull_request / push(main)
        │
        ▼
   [changes] ──detect backend/ and frontend/ diffs──┐
        │                                            │
        ├── backend/** changed? ──► [backend] (lint+test+coverage)
        │
        ├── frontend/** changed? ──► [frontend] (lint+test+build)
        │
        └── either changed? ──► [security] (report-only vuln scan)

[backend] + [frontend] ──► [ci-success] (required status check)
```

## 2. Jobs

### 2.1 `changes` — path-based change detection

Uses [`dorny/paths-filter`](https://github.com/dorny/paths-filter) to compare
the diff against two filters:

| Output     | Fires when...        |
|------------|-----------------------|
| `backend`  | any file under `backend/` changed  |
| `frontend` | any file under `frontend/` changed |

Every other job reads these outputs via `needs.changes.outputs.*` and no-ops
(`if:` condition false → job shows as **skipped**, not failed) when its side
of the repo wasn't touched. This keeps PRs that only touch, say, `frontend/`
from waiting on a Python environment spin-up.

### 2.2 `backend` — lint + test (Python)

Runs only if `changes.outputs.backend == 'true'`. Working directory:
`backend/`.

Steps, in order:

1. **Setup:** Python 3.11 via `actions/setup-python@v5`, pip cache keyed on
   `backend/requirements-dev.txt`.
2. **Install:** `pip install -r requirements-dev.txt` (this transitively
   installs `requirements.txt` — see `backend/requirements-dev.txt` line 1,
   `-r requirements.txt`).
3. **Ruff (lint):** `ruff check .` — fails the job on any violation.
4. **Black (format check):** `black --check .` — fails the job if any file
   isn't already formatted (never auto-formats in CI).
5. **Pytest (with coverage):**
   `pytest -v --cov=. --cov-report=term-missing --cov-report=xml --cov-fail-under=80`
   — fails the job if line/branch coverage drops below **80%**.
6. **Upload coverage artifact:** `backend/coverage.xml` is uploaded as the
   `backend-coverage` artifact (14-day retention), even if a prior step
   failed (`if: always()`), so a failing PR's coverage report is still
   inspectable.

Config lives in `backend/pyproject.toml` and `backend/requirements-dev.txt`,
not inline in the workflow — see §3.

### 2.3 `frontend` — lint + test + build (Node)

Runs only if `changes.outputs.frontend == 'true'`. Working directory:
`frontend/`.

Steps, in order:

1. **Setup:** Node 20 via `actions/setup-node@v4`, npm cache keyed on
   `frontend/package-lock.json`.
2. **Install:** `npm ci` (exact, lockfile-pinned install).
3. **ESLint — report-only:** `npm run lint` (→ `eslint .`) runs with
   `continue-on-error: true`. It **cannot fail the job**. This is deliberate
   pre-existing debt, not an oversight — see §4.
4. **Vitest:** `npm run coverage` (→ `vitest run --mode test --coverage`).
   Fails the job on any failing test. There is currently **no enforced
   coverage threshold** on the frontend (unlike the backend's 80% gate) —
   the coverage report is generated but not gated.
5. **Build:** `npm run build` (→ `vite build`), producing the production
   bundle. Runs with placeholder Firebase/Supabase/Google Maps env vars
   (`ci-placeholder`, dummy IDs) injected as step `env:` — these exist only
   to satisfy Vite's env-var validation at build time; they are not real
   credentials and are not used for anything that talks to a network.

### 2.4 `security` — dependency vulnerability scan (report-only)

Runs if either `backend` or `frontend` changed. Entire job has
`continue-on-error: true` — **it can never fail the workflow or block a
merge.** Its purpose is visibility, not enforcement.

- **Backend:** `pip-audit -r backend/requirements.txt` (installed ad hoc in
  this job, also pinned in `requirements-dev.txt` for local use).
- **Frontend:** `npm audit --omit=dev` (production dependencies only) run
  from `frontend/`.

Each half only runs if its corresponding side of the repo changed.

### 2.5 `ci-success` — required status check

A single aggregator job (`needs: [changes, backend, frontend]`, `if: always()`)
that exists so branch protection can require **one** check instead of two
independently-conditional ones. Logic:

```bash
backend_ok  = backend.result  in {success, skipped}
frontend_ok = frontend.result in {success, skipped}
exit 1 unless both are ok
```

Point GitHub branch protection at **`ci-success`**, not at `backend` /
`frontend` directly — those two show as "skipped" (not "success") on PRs
that don't touch their side of the repo, and GitHub's required-checks UI
does not treat "skipped" as satisfying a required check the way `ci-success`
does. `security` is intentionally excluded from `ci-success`'s `needs:` — a
vulnerability finding does not block merges.

## 3. Quality gate configuration reference

| Gate | Tool | Config file | Enforcement |
|---|---|---|---|
| Backend lint | Ruff | `backend/pyproject.toml` (`[tool.ruff]`) | **Blocking** |
| Backend format | Black | `backend/pyproject.toml` (`[tool.black]`) | **Blocking** |
| Backend tests | Pytest | `backend/pyproject.toml` (`[tool.pytest.ini_options]`) | **Blocking** |
| Backend coverage | pytest-cov | `--cov-fail-under=80` (inline in `ci.yml`) | **Blocking**, 80% floor |
| Backend dependency audit | pip-audit | n/a (CLI flags only) | Report-only |
| Frontend lint | ESLint | `frontend/eslint.config.js` | Report-only (`continue-on-error`) |
| Frontend tests | Vitest | `frontend/vite.config.js` (`test:` block) | **Blocking**, no coverage floor |
| Frontend build | Vite | `frontend/vite.config.js` | **Blocking** |
| Frontend dependency audit | npm audit | n/a (CLI flags only) | Report-only |
| Dependency freshness | Dependabot | `.github/dependabot.yml` | N/A (opens PRs, doesn't gate CI) |

### Backend: Ruff + Black scope (important gotcha)

`backend/pyproject.toml` scopes lint/format enforcement to **`tests/**/*.py`
only**:

```toml
[tool.ruff]
include = ["tests/**/*.py"]

[tool.black]
force-exclude = '^/(?!tests/).*\.py$'
```

`api_routes.py`, `graph_engine.py`, `llm_engine.py`, `main.py`, and
`models.py` predate this tooling and carry pre-existing style debt (unsorted
imports, trailing whitespace, bare excepts) that hasn't been cleaned up. The
plan recorded in a comment at the top of that config block: ratchet Ruff/Black
out to those files in a dedicated, logic-free formatting PR, then delete the
scoping. **Do not silently widen this scope as a side effect of an unrelated
change** — do it as its own PR so a failing diff is easy to attribute.

### Frontend: ESLint report-only (important gotcha)

`frontend/eslint.config.js` is fully configured (React Hooks rules, React
Refresh, unused-vars), but the CI step that runs it
(`.github/workflows/ci.yml`, "ESLint (report-only)") has
`continue-on-error: true` with a comment explaining why: existing components
predate ESLint enforcement and currently fail the check. This mirrors the
backend's scoping note. Until a cleanup pass lands, treat ESLint output in CI
logs as advisory, not a merge blocker.

### Coverage thresholds

- **Backend:** hard-enforced at 80% via `--cov-fail-under=80`. Excludes
  `tests/*`, `scripts/*`, `__pycache__/*`, `main.py` (see
  `[tool.coverage.run] omit` in `backend/pyproject.toml`).
- **Frontend:** `vitest run --coverage` produces a report (via
  `@vitest/coverage-v8`) but nothing in `vite.config.js` or `package.json`
  sets a `test.coverage.thresholds` block, so there is **no enforced
  minimum**. If you want parity with the backend gate, add a
  `thresholds` object under `test.coverage` in `frontend/vite.config.js`.

## 4. Known technical debt baked into the pipeline

These are intentional, documented exceptions — not bugs to "fix" casually:

1. **Frontend ESLint is report-only.** Flipping it to blocking will fail CI
   on every PR until the pre-existing lint debt in `frontend/src/**` is
   cleaned up.
2. **Backend Ruff/Black only cover `tests/`.** Same shape of problem on the
   Python side — the four core modules need a dedicated formatting-only PR
   before enforcement can widen.
3. **No frontend coverage floor.** Backend has one (80%), frontend doesn't.
4. **`security` job never blocks merges.** `pip-audit` / `npm audit` findings
   are visible in job logs/summary but require a human to act on them.

If you're picking up a "raise the bar" ticket, these four are the ranked
punch list.

## 5. Dependency updates (Dependabot)

`.github/dependabot.yml` configures three independent update streams, all
weekly:

| Ecosystem | Directory | Grouping |
|---|---|---|
| `pip` | `/backend` | minor/patch bumps grouped into one PR (`backend-minor-patch`) |
| `npm` | `/frontend` | minor/patch bumps grouped into one PR (`frontend-minor-patch`) |
| `github-actions` | `/` (workflow files) | ungrouped |

Major-version bumps are **not** grouped — they always open as individual PRs
so a breaking change doesn't get silently bundled with routine patches. Each
Dependabot PR runs through the same `ci.yml` workflow as any other PR.

## 6. Reproducing CI locally

Run these before pushing to avoid a red CI run:

**Backend** (from `backend/`, with `requirements-dev.txt` installed):
```bash
ruff check .
black --check .
pytest -v --cov=. --cov-report=term-missing --cov-fail-under=80
```

**Frontend** (from `frontend/`, after `npm ci`):
```bash
npm run lint        # advisory only — CI won't fail on this today
npm run coverage
npm run build
```

## 7. Extending the pipeline

- **New job:** add it under `jobs:` in `ci.yml`, gate it on the relevant
  `changes.outputs.*` flag if it's side-specific, and decide whether it
  belongs in `ci-success`'s `needs:` list (blocking) or stays standalone with
  `continue-on-error: true` (report-only), matching the pattern `security`
  uses.
- **New required check:** add the job name to `ci-success`'s `needs:` array
  and to its bash `_ok` checks — branch protection only needs to reference
  `ci-success`, not the new job directly, as long as you follow this pattern.
- **Raising a report-only gate to blocking:** remove `continue-on-error` (job
  or step level) only after the underlying debt (see §4) is cleared, otherwise
  every open PR starts failing at once.

## 8. Troubleshooting

| Symptom | Likely cause |
|---|---|
| `backend` / `frontend` job shows "skipped" on a PR | Expected — that side of the repo wasn't touched. Not a failure. |
| PR blocked with no visible failing check | Check `ci-success`'s logs directly — it aggregates `backend`/`frontend` results and is the one branch protection watches. |
| Coverage failure with `--cov-fail-under=80` | A new/changed backend module dropped overall coverage below 80%. Add tests under `backend/tests/unit/` or `backend/tests/integration/`. |
| `black --check .` fails | Only checked inside `tests/` (see §3) — run `black tests/` locally to auto-fix, don't run it repo-wide (would touch out-of-scope legacy files). |
| Frontend `npm run build` fails over env vars | Vite validates required `VITE_*` vars at build time; CI supplies placeholders (see §2.3 step 5) — if you added a new required env var, add its placeholder to the `build` step's `env:` block too. |
