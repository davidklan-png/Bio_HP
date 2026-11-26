#!/usr/bin/env python3
"""Tests for scripts/build_ja_home.py (generated Japanese home page).

Runnable without pytest:  python3 tests/test_build_ja_home.py
"""
import importlib.util
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("build_ja_home", ROOT / "scripts" / "build_ja_home.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

PAGE = """---
layout: home
title: "x"
permalink: /
---
<section id="projects">
  <h2 data-i18n="h2">Five <em>products</em> &amp; more</h2>
  <p data-i18n="lead.html">Plain <strong>EN</strong></p>
  <div data-i18n="outer"><div>nested</div><div>twice</div></div>
  <img src="/assets/a.png" alt="EN alt" data-i18n-attr="alt:img.alt">
  <a href="/projects/p/">p</a> <a href="/articles/a/">a</a> <a href="/#family">f</a>
  <a href="https://example.com/x">ext</a> <a href="#connect">local</a>
  <!-- AUTOGEN:x:start --> &copy; &#169;
</section>
"""
STRINGS = {
    "title": "タイトル", "meta.description": "説明",
    "h2": "5つの <プロダクト> & more",
    "lead.html": "日本語 <strong>JA</strong>",
    "outer": "外側",
    "img.alt": 'JA "alt"',
}
JA_URLS = {"/ja/projects/p/"}


def body_of(text):
    return mod.split_front_matter(text)[1]


def test_identity_round_trip_of_real_home_page():
    """With no strings and no link map the parser must re-emit index.html byte for byte."""
    body = body_of((ROOT / "index.html").read_text(encoding="utf-8"))
    assert "".join(mod.translate(body, None, None).out) == body


def test_text_is_escaped_and_html_keys_are_markup():
    out, missing, _ = mod.build(PAGE, STRINGS, JA_URLS)
    assert not missing, missing
    assert '<h2 data-i18n="h2">5つの &lt;プロダクト&gt; &amp; more</h2>' in out
    assert '<p data-i18n="lead.html">日本語 <strong>JA</strong></p>' in out


def test_nested_same_tag_content_is_replaced_whole():
    out, _, _ = mod.build(PAGE, STRINGS, JA_URLS)
    assert '<div data-i18n="outer">外側</div>' in out
    assert "nested" not in out and "twice" not in out


def test_attributes_are_translated_and_escaped():
    out, _, _ = mod.build(PAGE, STRINGS, JA_URLS)
    assert 'alt="JA &quot;alt&quot;"' in out


def test_internal_links_move_to_ja_only_when_a_ja_page_exists():
    out, _, _ = mod.build(PAGE, STRINGS, JA_URLS)
    assert 'href="/ja/projects/p/"' in out          # JA page exists
    assert 'href="/articles/a/"' in out             # English-only page stays
    assert 'href="/ja/#family"' in out              # home anchor -> JA home anchor
    assert 'href="https://example.com/x"' in out    # external untouched
    assert 'href="#connect"' in out                 # same-page anchor untouched


def test_entities_and_comments_survive():
    out, _, _ = mod.build(PAGE, STRINGS, JA_URLS)
    assert "<!-- AUTOGEN:x:start --> &copy; &#169;" in out


def test_front_matter_is_ja_home():
    out, _, _ = mod.build(PAGE, STRINGS, JA_URLS)
    fm = out.split("---")[1]
    assert "layout: home" in fm and "lang: ja" in fm and "permalink: /ja/" in fm
    assert 'title: "タイトル"' in fm and 'description: "説明"' in fm


def test_missing_key_is_reported():
    strings = dict(STRINGS)
    del strings["outer"]
    _, missing, _ = mod.build(PAGE, strings, JA_URLS)
    assert missing == ["outer"]


def test_unused_key_is_reported():
    strings = dict(STRINGS, stale="古い")
    _, _, unused = mod.build(PAGE, strings, JA_URLS)
    assert unused == ["stale"]


def test_localize_href_edge_cases():
    urls = {"/ja/about/"}
    assert mod.localize_href("/", urls) == "/ja/"
    assert mod.localize_href("/about/#x", urls) == "/ja/about/#x"
    assert mod.localize_href("/ja/about/", urls) == "/ja/about/"
    assert mod.localize_href("//cdn.example/x", urls) == "//cdn.example/x"
    assert mod.localize_href("mailto:a@b", urls) == "mailto:a@b"


def test_committed_ja_home_is_in_sync():
    r = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "build_ja_home.py"), "--check"],
        capture_output=True, text=True,
    )
    assert r.returncode == 0, (
        "ja/index.html is stale vs index.html + i18n/strings.ja.json.\n"
        "Run: python3 scripts/build_ja_home.py\n" + r.stdout + r.stderr
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
