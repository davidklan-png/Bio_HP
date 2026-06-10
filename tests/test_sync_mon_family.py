#!/usr/bin/env python3
"""Tests for scripts/sync_mon_family.py (homepage -MON family generator).

Runnable without pytest:  python3 tests/test_sync_mon_family.py
"""
import importlib.util
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("sync_mon_family", ROOT / "scripts" / "sync_mon_family.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def test_html_escape():
    assert mod.html_escape("a & b <c>") == "a &amp; b &lt;c&gt;"


def test_render_cards_covers_every_entry():
    family = mod.load_family()
    html = mod.render_cards(family)
    assert html.count('class="mon-card"') == len(family)
    for e in family:
        assert f'data-i18n="fam.{e["slug"]}.desc"' in html
        assert f'data-i18n="fam.{e["slug"]}.tag"' in html
        assert f'assets/images/{e["icon"]}' in html
    # external links open in a new tab; internal ones do not
    ext = [e for e in family if e.get("external")]
    assert ext and all('target="_blank"' in mod.render_cards([e]) for e in ext)
    internal = [e for e in family if not e.get("external")]
    assert internal and all('target="_blank"' not in mod.render_cards([e]) for e in internal)


def test_i18n_block_has_two_keys_per_entry():
    family = mod.load_family()
    block = mod.render_i18n_block(family)
    for e in family:
        assert f'"fam.{e["slug"]}.desc"' in block
        assert f'"fam.{e["slug"]}.tag"' in block


def test_committed_homepage_is_in_sync():
    """The generated regions must match what is committed (CI parity)."""
    r = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "sync_mon_family.py"), "--check"],
        capture_output=True, text=True,
    )
    assert r.returncode == 0, (
        "index.html / strings.ja.json are stale vs shared/profile.json.\n"
        "Run: python3 scripts/sync_mon_family.py\n" + r.stdout + r.stderr
    )


if __name__ == "__main__":
    failures = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print(f"PASS {name}")
            except AssertionError as exc:
                failures += 1
                print(f"FAIL {name}: {exc}")
    print(f"\n{'ALL PASSED' if not failures else str(failures)+' FAILED'}")
    sys.exit(1 if failures else 0)
