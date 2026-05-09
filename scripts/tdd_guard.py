#!/usr/bin/env python3
"""TDD guardrail for this repository.

Fails when source files are changed without corresponding test-file changes
in the same diff. Use in CI and git hooks.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from dataclasses import dataclass
from pathlib import PurePosixPath
from typing import Iterable


@dataclass(frozen=True)
class Rule:
    name: str
    source_patterns: tuple[str, ...]
    test_patterns: tuple[str, ...]
    source_exclude_patterns: tuple[str, ...] = ()


RULES: tuple[Rule, ...] = (
    Rule(
        name="Cloudflare Worker TypeScript",
        source_patterns=("worker/src/*.ts", "worker/src/**/*.ts"),
        source_exclude_patterns=(
            "worker/src/*.test.ts",
            "worker/src/**/*.test.ts",
            "worker/src/*.spec.ts",
            "worker/src/**/*.spec.ts",
        ),
        test_patterns=(
            "worker/src/*.test.ts",
            "worker/src/**/*.test.ts",
            "worker/src/*.spec.ts",
            "worker/src/**/*.spec.ts",
        ),
    ),
    Rule(
        name="Site widget JavaScript",
        source_patterns=("assets/js/*.js", "assets/js/**/*.js"),
        source_exclude_patterns=(
            "assets/js/*.test.js",
            "assets/js/**/*.test.js",
            "assets/js/*.spec.js",
            "assets/js/**/*.spec.js",
        ),
        test_patterns=(
            "tests/*.test.js",
            "tests/**/*.test.js",
            "tests/*.spec.js",
            "tests/**/*.spec.js",
        ),
    ),
    Rule(
        name="Agentic workflows Python",
        source_patterns=("agentic-workflows/src/*.py", "agentic-workflows/src/**/*.py"),
        test_patterns=(
            "agentic-workflows/tests/test_*.py",
            "agentic-workflows/tests/**/*_test.py",
            "agentic-workflows/tests/**/*test*.py",
        ),
    ),
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Enforce repository TDD guardrails")
    parser.add_argument(
        "--staged",
        action="store_true",
        help="Check staged files only (intended for pre-commit hooks)",
    )
    parser.add_argument(
        "--against",
        default="origin/main",
        help="Base ref for diff when not using --staged (default: origin/main)",
    )
    return parser.parse_args()


def run_git_diff(staged: bool, against: str) -> list[str]:
    if staged:
        cmd = ["git", "diff", "--cached", "--name-only", "--diff-filter=ACMR"]
    else:
        cmd = ["git", "diff", "--name-only", "--diff-filter=ACMR", f"{against}...HEAD"]

    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        print(proc.stderr.strip() or "Failed to compute git diff.", file=sys.stderr)
        sys.exit(proc.returncode)

    files = [line.strip() for line in proc.stdout.splitlines() if line.strip()]
    return files


def path_matches(path: str, patterns: Iterable[str]) -> bool:
    posix = PurePosixPath(path)
    return any(posix.match(pattern) for pattern in patterns)


def find_violations(changed_files: list[str]) -> list[tuple[Rule, list[str]]]:
    violations: list[tuple[Rule, list[str]]] = []

    for rule in RULES:
        changed_source = [
            path
            for path in changed_files
            if path_matches(path, rule.source_patterns)
            and not path_matches(path, rule.source_exclude_patterns)
        ]
        if not changed_source:
            continue

        has_changed_test = any(path_matches(path, rule.test_patterns) for path in changed_files)
        if not has_changed_test:
            violations.append((rule, changed_source))

    return violations


def main() -> int:
    args = parse_args()
    changed_files = run_git_diff(staged=args.staged, against=args.against)

    if not changed_files:
        print("TDD guard: no changed files to evaluate.")
        return 0

    violations = find_violations(changed_files)
    if not violations:
        print("TDD guard: PASS (source changes include corresponding test changes).")
        return 0

    print("TDD guard: FAIL", file=sys.stderr)
    print(
        "Source files changed without test changes in the same diff. "
        "Follow Red -> Green -> Refactor and include/modify tests first.",
        file=sys.stderr,
    )

    for rule, files in violations:
        print(f"\nRule: {rule.name}", file=sys.stderr)
        print("Changed source files:", file=sys.stderr)
        for path in files:
            print(f"- {path}", file=sys.stderr)
        print("Expected test file change matching one of:", file=sys.stderr)
        for pattern in rule.test_patterns:
            print(f"- {pattern}", file=sys.stderr)

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
