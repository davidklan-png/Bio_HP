# TDD Policy

This repository follows **Red -> Green -> Refactor** for code changes.

## Scope

TDD is required for changes in:

- `worker/src/**/*.ts`
- `site/assets/js/**/*.js` and `assets/js/**/*.js`
- `agentic-workflows/src/**/*.py`

Content-only updates (`.md`, `.yml`, images) are exempt.

## Required Flow

1. Write/update a test first that fails for the intended behavior.
2. Implement the smallest change to make the test pass.
3. Refactor while keeping tests green.
4. Commit source and test updates together.

## Enforcement

- Local git hooks under `.githooks/` run `scripts/tdd_guard.py`.
- CI workflow `.github/workflows/tdd-quality-gates.yml` blocks merges when:
  - TDD guard fails
  - Worker typecheck/tests fail
  - Site JS tests fail (when tests exist)
  - Jekyll build fails
- In GitHub settings, mark these CI checks as **required** branch protections for `main`.

## Setup

```bash
./scripts/setup-git-hooks.sh
```

## Manual Commands

```bash
# guard changed files in current branch
python3 scripts/tdd_guard.py --against origin/main

# guard staged files (pre-commit mode)
python3 scripts/tdd_guard.py --staged

# worker tests
cd worker && npm run check && npm test

# jekyll build
bundle exec jekyll build
bundle exec jekyll build --source site --destination site/_site

# site JS tests
./scripts/run-site-js-tests.sh
```
