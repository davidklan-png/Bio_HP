#!/usr/bin/env bash
set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required to run site JS tests." >&2
  exit 1
fi

mapfile -t test_files < <(find site/tests tests/js -type f \( -name '*.test.js' -o -name '*.spec.js' \) 2>/dev/null | sort)

if [ "${#test_files[@]}" -eq 0 ]; then
  echo "No site JS tests found; skipping."
  exit 0
fi

node --test "${test_files[@]}"
