#!/usr/bin/env python3
"""Generate the homepage -MON family grid from shared/profile.json.

Single source of truth: the ``mon_family`` array in ``shared/profile.json``.
This script rewrites two generated regions so the static homepage can never
drift behind the data again:

1. ``index.html`` — the ``mon-card`` grid, between the AUTOGEN markers.
2. ``i18n/strings.ja.json`` — the per-card ``fam.<slug>.desc`` / ``fam.<slug>.tag``
   Japanese strings (the contiguous block right after ``fam.lead``).

Usage::

    python3 scripts/sync_mon_family.py          # rewrite the generated regions
    python3 scripts/sync_mon_family.py --check   # CI: fail if regions are stale

Only the -MON *family* grid is generated. The curated "FEATURED PROJECTS"
section is intentionally hand-maintained and is NOT touched here.
"""
from __future__ import annotations

import argparse
import difflib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROFILE = ROOT / "shared" / "profile.json"
INDEX = ROOT / "index.html"
I18N = ROOT / "i18n" / "strings.ja.json"

INDEX_PATTERN = re.compile(
    r"(<!-- AUTOGEN:mon-family:start[^\n]*-->\n).*?(\n[ \t]*<!-- AUTOGEN:mon-family:end -->)",
    re.DOTALL,
)
# The generated JA block is the contiguous run of fam.<slug>.desc/.tag keys
# immediately after the (hand-maintained) "fam.lead" line.
I18N_PATTERN = re.compile(
    r'("fam\.lead": [^\n]*\n)((?:    "fam\.[a-z]{2,4}\.(?:desc|tag)": [^\n]*\n)+)'
)


def html_escape(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def load_family() -> list[dict]:
    data = json.loads(PROFILE.read_text(encoding="utf-8"))
    family = data.get("mon_family")
    if not family:
        sys.exit("ERROR: shared/profile.json has no non-empty 'mon_family' array")
    return family


def render_cards(family: list[dict]) -> str:
    cards = []
    for e in family:
        target = ' target="_blank" rel="noreferrer"' if e.get("external") else ""
        ja = (
            f' <span class="mon-card__ja">{e["name_ja"]}</span>'
            if e.get("name_ja")
            else ""
        )
        slug = e["slug"]
        cards.append(
            f'      <a class="mon-card" href="{e["href"]}"{target} data-fade>\n'
            f'        <div class="mon-card__art"><img src="assets/images/{e["icon"]}" alt="{html_escape(e["name"])}"></div>\n'
            f'        <div class="mon-card__body">\n'
            f'          <div class="mon-card__name">{html_escape(e["name"])}{ja}</div>\n'
            f'          <p class="mon-card__desc" data-i18n="fam.{slug}.desc">{html_escape(e["desc_en"])}</p>\n'
            f'          <span class="mon-card__tag" data-i18n="fam.{slug}.tag">{html_escape(e["tag_en"])}</span>\n'
            f"        </div>\n"
            f"      </a>"
        )
    return "\n".join(cards)


def render_i18n_block(family: list[dict]) -> str:
    lines = []
    for e in family:
        lines.append(f'    "fam.{e["slug"]}.desc": {json.dumps(e["desc_ja"], ensure_ascii=False)},')
        lines.append(f'    "fam.{e["slug"]}.tag": {json.dumps(e["tag_ja"], ensure_ascii=False)},')
    return "\n".join(lines) + "\n"


def apply_index(text: str, family: list[dict]) -> str:
    cards = render_cards(family)
    if not INDEX_PATTERN.search(text):
        sys.exit("ERROR: AUTOGEN:mon-family markers not found in index.html")
    return INDEX_PATTERN.sub(lambda m: m.group(1) + cards + m.group(2), text)


def apply_i18n(text: str, family: list[dict]) -> str:
    block = render_i18n_block(family)
    if not I18N_PATTERN.search(text):
        sys.exit("ERROR: fam.lead anchor / fam.* block not found in strings.ja.json")
    new = I18N_PATTERN.sub(lambda m: m.group(1) + block, text)
    json.loads(new)  # never emit invalid JSON
    return new


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--check", action="store_true", help="fail if regions are stale")
    args = ap.parse_args()

    family = load_family()
    targets = [
        (INDEX, apply_index(INDEX.read_text(encoding="utf-8"), family)),
        (I18N, apply_i18n(I18N.read_text(encoding="utf-8"), family)),
    ]

    stale = False
    for path, new_text in targets:
        current = path.read_text(encoding="utf-8")
        if current == new_text:
            continue
        stale = True
        if args.check:
            diff = difflib.unified_diff(
                current.splitlines(True), new_text.splitlines(True),
                fromfile=f"{path.name} (committed)", tofile=f"{path.name} (generated)",
            )
            sys.stdout.writelines(diff)
        else:
            path.write_text(new_text, encoding="utf-8")
            print(f"updated {path.relative_to(ROOT)}")

    if args.check and stale:
        print(
            "\nERROR: generated regions are stale. "
            "Run: python3 scripts/sync_mon_family.py",
            file=sys.stderr,
        )
        return 1
    if not args.check and not stale:
        print("already in sync; nothing to do")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
