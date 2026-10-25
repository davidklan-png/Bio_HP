#!/usr/bin/env python3
"""Tests for scripts/linkedin_articles.py (LinkedIn article importer).

Runnable without pytest:  python3 tests/test_linkedin_articles.py
No network access: every test works on inline HTML fixtures.
"""
import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("linkedin_articles", ROOT / "scripts" / "linkedin_articles.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

LD = {
    "@context": "http://schema.org",
    "@type": "Article",
    "name": "The Ant, the Spider, and the Bee",
    "datePublished": "2026-03-08T02:00:00.000+00:00",
    "author": {"@type": "Person", "name": "David Klan", "url": "https://jp.linkedin.com/in/david-klan"},
}

PAGE = f"""<html><head>
<meta property="og:image" content="https://media.licdn.com/profile-avatar-96.jpg">
<meta property="og:description" content="Bacon's 1620 framework.">
<script type="application/ld+json">{json.dumps(LD)}</script>
</head><body>
<figure class="cover-img"><div><img class="cover-img__image" src="https://media.licdn.com/cover.jpg?e=1&amp;t=x" data-embed-id="cover-image" alt="t"></div></figure>
<div data-test-id="article-content-blocks">
<div class="article-main__content" data-test-id="publishing-text-block">
  <h3><span class>The spark</span><!----></h3>
</div>
<!----><hr data-test-id="publishing-divider-block" class="my-4">
<div class="article-main__content" data-test-id="publishing-text-block">
  <p><span class>Plain </span><span class="font-[700]">bold</span><span class="italic">italic</span></p>
  <p><span class>
    <ul><li><span class>one</span></li><li><span class>two</span></li></ul>
  </span></p>
  <p><span class><a href="https://www.linkedin.com/redir/redirect?url=https%3A%2F%2Fwww%2Edwarkesh%2Ecom%2Fp%2Fada-palmer&amp;urlhash=FHh2&amp;trk=x" target="_blank" data-tracking-will-navigate>link</a></span></p>
  <figure><img data-delayed-url="https://media.licdn.com/body1.png?e=2" alt="chart"><figcaption>Fig 1</figcaption></figure>
  <div><div>nested</div></div>
</div>
</div>
<a href="https://www.linkedin.com/pulse/lobster-test-david-klan-2ghvc">More</a>
<a href="https://jp.linkedin.com/pulse/hello-world-david-klan-koaic?trk=a">More</a>
<a href="https://www.linkedin.com/pulse/someone-else-jane-doe-abcde">Other author</a>
</body></html>"""


def test_short_slug_strips_author_suffix():
    assert mod.short_slug("ant-spider-bee-david-klan-ncavc") == "ant-spider-bee"
    assert mod.short_slug("https://www.linkedin.com/pulse/hello-world-david-klan-koaic?trk=x") == "hello-world"


def test_discover_links_is_author_scoped_and_normalized():
    found = mod.discover_links(PAGE)
    assert found == {"lobster-test-david-klan-2ghvc", "hello-world-david-klan-koaic"}


def test_unwrap_redirect_and_strip_tracking():
    href = "https://www.linkedin.com/redir/redirect?url=https%3A%2F%2Fwww%2Edwarkesh%2Ecom%2Fp%2Fada-palmer&urlhash=FHh2"
    assert mod.clean_href(href) == "https://www.dwarkesh.com/p/ada-palmer"
    assert mod.clean_href("https://kosa.bountymon.com/p/x?trk=article-ssr&a=1") == "https://kosa.bountymon.com/p/x?a=1"
    assert mod.clean_href("https://github.com/n8k/X?trk=foo") == "https://github.com/n8k/X"
    assert mod.clean_href("javascript:alert(1)") is None


def test_extract_article_metadata():
    art = mod.extract_article(PAGE)
    assert art["title"] == "The Ant, the Spider, and the Bee"
    assert art["date"] == "2026-03-08"
    assert art["author"] == "David Klan"
    assert art["cover_url"] == "https://media.licdn.com/cover.jpg?e=1&t=x"
    assert "The spark" in art["body_raw"]
    # the capture stops at the article div; sidebar links are not body content
    assert "lobster-test" not in art["body_raw"]
    assert "nested" in art["body_raw"]
    # every sibling block is captured, not just the first one
    assert "<hr" in art["body_raw"] and "dwarkesh" in art["body_raw"]


def test_cover_falls_back_to_none_not_profile_avatar():
    # og:image on cover-less articles is the author's avatar; never use it as a cover
    page = PAGE.replace('data-embed-id="cover-image"', "")
    assert mod.extract_article(page)["cover_url"] is None


def test_clean_body_sanitizes_and_maps_emphasis():
    art = mod.extract_article(PAGE)
    html, images = mod.clean_body(art["body_raw"])
    assert "<strong>bold</strong>" in html
    assert "<em>italic</em>" in html
    assert "<span" not in html and "class=" not in html and "data-" not in html
    # lists are not left wrapped inside paragraphs (invalid HTML)
    assert "<p><ul>" not in html.replace("\n", "").replace(" ", "")
    assert "<li>one</li>" in html
    assert 'href="https://www.dwarkesh.com/p/ada-palmer"' in html
    assert 'rel="noopener"' in html
    assert images == ["https://media.licdn.com/body1.png?e=2"]
    assert "<figcaption>Fig 1</figcaption>" in html
    assert "<div" not in html


def test_clean_body_turns_single_pre_into_paragraphs():
    raw = '<pre class="font-mono"><span class>Hello, World.\n\nLine A\nLine B</span></pre>'
    html, _ = mod.clean_body(raw)
    assert "<pre" not in html
    assert "<p>Hello, World.</p>" in html
    assert "<p>Line A<br>Line B</p>" in html


def test_clean_body_drops_linkedin_recommendations_and_empty_paragraphs():
    raw = (
        "<p><span>Keep me</span></p><p><!----><br></p>"
        '<div class="inline-articles bg" data-nosnippet="true"><h2>Recommended by LinkedIn</h2>'
        '<a href="https://www.linkedin.com/pulse/other-person-abcde"><img src="https://x/y.png">Other</a></div>'
        "<p><span>And me</span></p>"
    )
    html, images = mod.clean_body(raw)
    assert "Recommended" not in html and "Other" not in html
    assert images == []
    assert "<p><br></p>" not in html
    assert "<p>Keep me</p>" in html and "<p>And me</p>" in html


def test_pre_article_markdown_headings_and_bullets():
    raw = "<pre><span>Intro line.\n\n## A heading\n\nMy list:\n\u2022 one\n\u2022 two\n\nEnd.</span></pre>"
    html, _ = mod.clean_body(raw)
    assert "<h2>A heading</h2>" in html
    assert "<p>My list:</p>\n<ul><li>one</li><li>two</li></ul>" in html
    assert "<p>End.</p>" in html


def test_excerpt_skips_short_lead_paragraphs():
    body = "<p>Abstract</p><p>" + "word " * 10 + "</p><p>" + "This paragraph is long enough to describe the article well. " * 2 + "</p>"
    assert mod.excerpt(body).startswith("This paragraph is long enough")
    assert mod.excerpt("<h3>Only</h3><p>Short.</p>") == "Short."


def test_plain_text_does_not_space_out_inline_tags():
    assert mod.plain_text("<p>read <em>The Network State</em>, then</p>") == "read The Network State, then"
    assert mod.plain_text("<p>a</p><p>b<br>c</p>") == "a b c"


def test_clean_body_escapes_text():
    html, _ = mod.clean_body("<p><span>a &lt;script&gt; b</span></p><script>alert(1)</script>")
    assert "<script" not in html
    assert "&lt;script&gt;" in html


def test_front_matter_round_trip():
    meta = {
        "title": 'Quote "me": colon',
        "date": "2026-03-08",
        "original_url": "https://www.linkedin.com/pulse/ant-spider-bee-david-klan-ncavc",
        "description": "Desc",
        "cover": "/assets/images/articles/ant-spider-bee/cover.jpg",
        "reading_minutes": 5,
    }
    text = mod.render_article_file(meta, "<p>Body</p>")
    assert text.startswith("---\n")
    parsed, body = mod.parse_article_file(text)
    assert parsed["title"] == meta["title"]
    assert parsed["date"] == "2026-03-08"
    assert parsed["layout"] == "article"
    assert body.strip() == "<p>Body</p>"


def test_render_home_block_lists_latest_three_newest_first():
    arts = [
        {"slug": "a", "title": "A", "date": "2026-01-01", "description": "da", "reading_minutes": 3},
        {"slug": "b", "title": "B & co", "date": "2026-05-01", "summary": "auto db", "reading_minutes": 4},
        {"slug": "c", "title": "C", "date": "2026-03-01", "description": "dc", "reading_minutes": 5},
        {"slug": "d", "title": "D", "date": "2026-04-01", "description": "dd", "reading_minutes": 6},
    ]
    block = mod.render_home_block(arts)
    assert block.count('class="writing-card"') == 3
    assert block.index("/articles/b/") < block.index("/articles/d/") < block.index("/articles/c/")
    assert "/articles/a/" not in block
    assert "B &amp; co" in block
    assert "auto db" in block  # falls back to the auto summary when not curated


def test_update_index_replaces_only_marked_region():
    text = "before\n  <!-- AUTOGEN:articles:start x -->\nOLD\n  <!-- AUTOGEN:articles:end -->\nafter"
    out = mod.update_index(text, "NEW")
    assert "OLD" not in out and "NEW" in out
    assert out.startswith("before") and out.endswith("after")


def _with_temp_dirs(fn):
    """Run fn with the importer writing into a throwaway directory."""
    import tempfile
    saved = (mod.ARTICLES_DIR, mod.IMAGES_DIR, mod.save_image)
    with tempfile.TemporaryDirectory() as tmp:
        mod.ARTICLES_DIR = Path(tmp) / "_articles"
        mod.IMAGES_DIR = Path(tmp) / "images"
        try:
            fn(Path(tmp))
        finally:
            mod.ARTICLES_DIR, mod.IMAGES_DIR, mod.save_image = saved


def test_import_aborts_when_an_inline_image_cannot_be_saved():
    # LinkedIn image URLs expire, so publishing one is a time bomb: skip the
    # article (leaving any existing copy untouched) instead.
    def run(tmp):
        mod.save_image = lambda url, dest: None if "body1" in url else "/img/ok.jpg"
        mod.ARTICLES_DIR.mkdir()
        existing = mod.ARTICLES_DIR / "ant-spider-bee.html"
        previous = mod.render_article_file({"title": "Old", "date": "2026-03-08"}, "<p>previous copy</p>")
        existing.write_text(previous)
        try:
            mod.import_one("ant-spider-bee-david-klan-ncavc", PAGE)
        except ValueError as exc:
            assert "image" in str(exc)
        else:
            raise AssertionError("expected ValueError")
        assert existing.read_text() == previous
    _with_temp_dirs(run)


def test_import_aborts_when_the_cover_cannot_be_saved():
    def run(tmp):
        mod.save_image = lambda url, dest: None if "cover" in url else "/img/ok.jpg"
        try:
            mod.import_one("ant-spider-bee-david-klan-ncavc", PAGE)
        except ValueError:
            pass
        else:
            raise AssertionError("expected ValueError")
        assert not (mod.ARTICLES_DIR / "ant-spider-bee.html").exists()
    _with_temp_dirs(run)


def test_import_rewrites_image_urls_to_local_copies():
    def run(tmp):
        mod.save_image = lambda url, dest: "/assets/images/articles/x/" + dest.name + ".png"
        mod.import_one("ant-spider-bee-david-klan-ncavc", PAGE)
        text = (mod.ARTICLES_DIR / "ant-spider-bee.html").read_text()
        assert "media.licdn.com" not in text.split("---", 2)[2]
        assert 'src="/assets/images/articles/x/img-01.png"' in text
        assert 'cover: "/assets/images/articles/x/cover.png"' in text
    _with_temp_dirs(run)


def test_committed_homepage_matches_committed_articles():
    """CI guard: the homepage writing block must match _articles/."""
    arts = mod.load_articles()
    assert arts, "expected imported articles under _articles/"
    index = (ROOT / "index.html").read_text(encoding="utf-8")
    assert mod.update_index(index, mod.render_home_block(arts)) == index
    for a in arts:
        assert a["original_url"].startswith("https://www.linkedin.com/pulse/")
        if a.get("cover"):
            assert (ROOT / a["cover"].lstrip("/")).exists(), a["cover"]


if __name__ == "__main__":
    failures = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print(f"ok   {name}")
            except Exception as exc:  # noqa: BLE001
                failures += 1
                print(f"FAIL {name}: {exc!r}")
    sys.exit(1 if failures else 0)
