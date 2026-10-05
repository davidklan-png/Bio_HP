#!/usr/bin/env python3
"""Import David's public LinkedIn articles into the site and keep the homepage
"Writing" block in sync.

Source of truth after import: one file per article under ``_articles/``
(a Jekyll collection rendered at ``/articles/<slug>/``). The LinkedIn original
is recorded in each file as ``original_url``.

Why a crawler instead of the LinkedIn API: LinkedIn's member APIs do not expose
a member's own long-form articles without partner approval, and the profile's
"articles" listing is bot-blocked. Each public article page, however, renders
server-side and links to the author's other articles, so discovery walks that
graph starting from the articles already imported (plus any ``--seed`` URL).

Usage::

    python3 scripts/linkedin_articles.py import            # fetch new articles, then sync
    python3 scripts/linkedin_articles.py import --refresh  # re-fetch bodies, keep curated fields
    python3 scripts/linkedin_articles.py import --seed https://www.linkedin.com/pulse/<slug>
    python3 scripts/linkedin_articles.py sync              # rewrite homepage block only
    python3 scripts/linkedin_articles.py check             # CI: fail if homepage block is stale

Images (cover and inline) are downloaded into ``assets/images/articles/<slug>/``
because LinkedIn media URLs carry expiry tokens and stop working.
"""
from __future__ import annotations

import argparse
import difflib
import html as htmllib
import json
import math
import re
import shutil
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ARTICLES_DIR = ROOT / "_articles"
IMAGES_DIR = ROOT / "assets" / "images" / "articles"
INDEX = ROOT / "index.html"

AUTHOR_NAME = "David Klan"
AUTHOR_SLUG = "david-klan"
PULSE_BASE = "https://www.linkedin.com/pulse/"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124 Safari/537.36"
)
FETCH_DELAY_SECONDS = 3
HOME_LIMIT = 3
MAX_IMAGE_BYTES = 400_000
# Front-matter keys a human may curate; --refresh never overwrites them.
# ``summary`` is the auto excerpt and is always regenerated; a hand-written
# ``description`` takes precedence over it wherever a blurb is shown.
CURATED_KEYS = ("description", "featured", "tags")

PULSE_RE = re.compile(
    r"https://(?:[a-z]{2}\.|www\.)?linkedin\.com/pulse/([a-z0-9-]*-" + AUTHOR_SLUG + r"-[a-z0-9]{5})"
)
INDEX_PATTERN = re.compile(
    r"(<!-- AUTOGEN:articles:start[^\n]*-->)\n?.*?\n?([ \t]*<!-- AUTOGEN:articles:end -->)",
    re.DOTALL,
)


# ---------------------------------------------------------------- URLs ----

def short_slug(url_or_slug: str) -> str:
    """``.../pulse/ant-spider-bee-david-klan-ncavc?trk=x`` -> ``ant-spider-bee``."""
    slug = url_or_slug.split("?", 1)[0].rstrip("/").rsplit("/", 1)[-1]
    return re.sub(r"-" + AUTHOR_SLUG + r"-[a-z0-9]{5}$", "", slug)


def discover_links(page_html: str) -> set[str]:
    """Pulse slugs by this author linked from a page (sidebar 'more articles')."""
    return {m.group(1) for m in PULSE_RE.finditer(page_html)}


def clean_href(href: str) -> str | None:
    href = htmllib.unescape(href or "").strip()
    parts = urllib.parse.urlsplit(href)
    if parts.scheme not in ("http", "https", "mailto"):
        return None
    if parts.netloc.endswith("linkedin.com") and parts.path.startswith("/redir/redirect"):
        target = urllib.parse.parse_qs(parts.query).get("url", [""])[0]
        return clean_href(target) if target else None
    query = [(k, v) for k, v in urllib.parse.parse_qsl(parts.query, keep_blank_values=True) if k != "trk"]
    return urllib.parse.urlunsplit(parts._replace(query=urllib.parse.urlencode(query)))


# ------------------------------------------------------------ extract ----

VOID = {"br", "img", "hr", "meta", "link", "input", "source", "wbr", "col", "area"}


class _BodyCapture(HTMLParser):
    """Collect the raw inner HTML of ``div[data-test-id=article-content-blocks]``.

    LinkedIn renders each paragraph, heading, image and divider as its own
    sibling block inside that container, so the container is the article body.
    """

    def __init__(self) -> None:
        super().__init__(convert_charrefs=False)
        self.capturing = False
        self.done = False
        self.depth = 0
        self.out: list[str] = []

    def handle_starttag(self, tag, attrs):
        if self.done:
            return
        if not self.capturing:
            if tag == "div" and dict(attrs).get("data-test-id") == "article-content-blocks":
                self.capturing = True
            return
        self.out.append(self.get_starttag_text())
        if tag not in VOID:
            self.depth += 1

    def handle_startendtag(self, tag, attrs):
        if self.capturing:
            self.out.append(self.get_starttag_text())

    def handle_endtag(self, tag):
        if not self.capturing or tag in VOID:
            return
        if self.depth == 0:
            self.capturing, self.done = False, True
            return
        self.depth -= 1
        self.out.append(f"</{tag}>")

    def handle_data(self, data):
        if self.capturing:
            self.out.append(data)

    def handle_entityref(self, name):
        if self.capturing:
            self.out.append(f"&{name};")

    def handle_charref(self, name):
        if self.capturing:
            self.out.append(f"&#{name};")


def _meta(page_html: str, prop: str) -> str | None:
    m = re.search(r'<meta[^>]+(?:property|name)="' + re.escape(prop) + r'"[^>]+content="([^"]*)"', page_html)
    return htmllib.unescape(m.group(1)) if m else None


def _cover(page_html: str) -> str | None:
    # Not og:image: for articles without a cover LinkedIn falls back to the
    # author's profile avatar there.
    for tag in re.findall(r"<img\b[^>]*>", page_html):
        if 'data-embed-id="cover-image"' in tag:
            m = re.search(r'\ssrc="([^"]+)"', tag)
            return htmllib.unescape(m.group(1)) if m else None
    return None


def extract_article(page_html: str) -> dict:
    ld = {}
    for m in re.finditer(r'<script type="application/ld\+json"[^>]*>(.*?)</script>', page_html, re.S):
        try:
            data = json.loads(m.group(1))
        except json.JSONDecodeError:
            continue
        if isinstance(data, dict) and data.get("@type") in ("Article", "NewsArticle", "BlogPosting"):
            ld = data
            break
    cap = _BodyCapture()
    cap.feed(page_html)
    title = (ld.get("name") or ld.get("headline") or _meta(page_html, "og:title") or "").strip()
    return {
        "title": re.sub(r"\s+", " ", title),
        "date": (ld.get("datePublished") or "")[:10],
        "author": (ld.get("author") or {}).get("name", ""),
        "url": ld.get("url") or ld.get("mainEntityOfPage") or "",
        "cover_url": _cover(page_html),
        "body_raw": "".join(cap.out),
    }


# -------------------------------------------------------------- clean ----

ALLOWED = {"p", "h2", "h3", "h4", "ul", "ol", "li", "a", "strong", "em", "blockquote",
           "figure", "figcaption", "img", "hr", "br", "pre", "code"}
RENAME = {"b": "strong", "i": "em", "h1": "h2"}
DROP_WITH_CONTENT = {"script", "style", "template", "button", "icon", "svg", "noscript", "iframe"}
TOP_BLOCK = ("p", "h2", "h3", "h4", "ul", "ol", "figure", "blockquote", "pre")


class _Sanitizer(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.out: list[str] = []
        self.stack: list[str | None] = []  # emitted tag per open element (None = unwrapped)
        self.drop = 0
        self.pre = 0
        self.images: list[str] = []

    def handle_starttag(self, tag, attrs):
        if self.drop or tag in DROP_WITH_CONTENT:
            if tag not in VOID:
                self.drop += 1
            return
        a = dict(attrs)
        if "data-nosnippet" in a or "inline-articles" in (a.get("class") or ""):
            # "Recommended by LinkedIn" cards injected mid-article: not David's content.
            if tag not in VOID:
                self.drop += 1
            return
        emit = RENAME.get(tag, tag)
        if tag == "span":
            cls = a.get("class") or ""
            emit = "strong" if "font-[700]" in cls else "em" if "italic" in cls else None
        if emit not in ALLOWED:
            emit = None
        if emit == "img":
            src = a.get("data-delayed-url") or a.get("data-src") or a.get("src") or ""
            if src.startswith("http"):
                self.images.append(htmllib.unescape(src))
                alt = htmllib.escape(a.get("alt") or "", quote=True)
                self.out.append(f'<img src="{htmllib.escape(src, quote=True)}" alt="{alt}" loading="lazy">')
            return
        if emit in ("br", "hr"):
            self.out.append(f"<{emit}>")
            return
        if tag in VOID:
            return
        if emit == "a":
            href = clean_href(a.get("href") or "")
            if href:
                ext = ' target="_blank" rel="noopener"' if href.startswith("http") else ""
                self.out.append(f'<a href="{htmllib.escape(href, quote=True)}"{ext}>')
            else:
                emit = None
        elif emit:
            self.out.append(f"<{emit}>")
        if emit == "pre":
            self.pre += 1
        self.stack.append(emit)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID and not self.drop:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        if self.drop:
            self.drop -= 1
            return
        if not self.stack:
            return
        emit = self.stack.pop()
        if emit == "pre":
            self.pre -= 1
        if emit:
            self.out.append(f"</{emit}>")

    def handle_data(self, data):
        if self.drop:
            return
        if not self.pre:
            # LinkedIn's SSR pads mentions etc. with newline+indent; that padding is
            # layout, not content. Plain single spaces between spans are content.
            data = re.sub(r"^\s*\n\s*|\s*\n\s*$", "", data)
            data = re.sub(r"\s+", " ", data)
        self.out.append(htmllib.escape(data, quote=False))


BULLET_RE = re.compile(r"^[\u2022\u2013\u2014*-]\s+")


def _pre_to_paragraphs(text_html: str) -> str:
    """Prose published as one preformatted block: blank-line paragraphs,
    ``#`` headings and bullet lines (•, –, -, *) become real HTML."""
    out = []
    for chunk in re.split(r"\n\s*\n", text_html.strip()):
        lines = [ln.strip() for ln in chunk.strip().split("\n") if ln.strip()]
        if len(lines) == 1 and (h := re.match(r"^(#{1,4})\s+(.*)", lines[0])):
            level = min(4, max(2, len(h.group(1))))
            out.append(f"<h{level}>{h.group(2)}</h{level}>")
            continue
        para: list[str] = []
        items: list[str] = []
        for ln in lines:
            if BULLET_RE.match(ln):
                if para:
                    out.append("<p>" + "<br>".join(para) + "</p>")
                    para = []
                items.append("<li>" + BULLET_RE.sub("", ln) + "</li>")
            else:
                if items:
                    out.append("<ul>" + "".join(items) + "</ul>")
                    items = []
                para.append(ln)
        if para:
            out.append("<p>" + "<br>".join(para) + "</p>")
        if items:
            out.append("<ul>" + "".join(items) + "</ul>")
    return "\n".join(out)


def clean_body(raw_html: str) -> tuple[str, list[str]]:
    s = _Sanitizer()
    s.feed(raw_html)
    s.close()
    out = "".join(s.out).strip()
    # Some articles were published as one big preformatted block: treat as prose.
    m = re.fullmatch(r"<pre>(.*)</pre>", out, re.S)
    if m and "<pre>" not in m.group(1):
        out = _pre_to_paragraphs(m.group(1))
    # Lists/figures wrapped in <p> are invalid HTML; lift them out.
    block_in_p = re.compile(r"<p>\s*(<(ul|ol|figure|blockquote|h[2-4])>.*?</\2>)\s*</p>", re.S)
    prev = None
    while prev != out:
        prev, out = out, block_in_p.sub(r"\1", out)
    for _ in range(2):
        out = re.sub(r"<(p|strong|em|li|h[2-4])>(?:\s|<br>)*</\1>", "", out)
    # One top-level block per line keeps diffs of re-imports readable.
    out = re.sub(r"\s*(</(?:" + "|".join(TOP_BLOCK) + r")>|<hr>)\s*", r"\1\n", out)
    return out.strip() + "\n", s.images


def plain_text(body_html: str) -> str:
    text = re.sub(r"<(?:br|/?(?:p|h[1-6]|li|ul|ol|figure|figcaption|blockquote|pre|hr))\b[^>]*>", " ", body_html)
    text = re.sub(r"<[^>]+>", "", text)  # inline tags join without adding spaces
    return re.sub(r"\s+", " ", htmllib.unescape(text)).strip()


def excerpt(body_html: str, limit: int = 220, min_len: int = 80) -> str:
    """First substantial paragraph (skips 'Abstract'-style lead-ins)."""
    paras = [plain_text(p) for p in re.findall(r"<p>(.*?)</p>", body_html, re.S)]
    paras = [p for p in paras if p] or [plain_text(body_html)]
    text = next((p for p in paras if len(p) >= min_len), paras[0])
    if len(text) <= limit:
        return text
    return text[:limit].rsplit(" ", 1)[0].rstrip(",;:—-") + "…"


def reading_minutes(body_html: str) -> int:
    return max(1, math.ceil(len(plain_text(body_html).split()) / 220))


# -------------------------------------------------------- front matter ----

FRONT_ORDER = ("layout", "title", "date", "description", "summary", "original_url", "cover",
               "reading_minutes", "source", "featured", "tags")


def _yaml_scalar(value) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, list):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        return value  # unquoted so Jekyll parses it as a date
    return json.dumps(str(value), ensure_ascii=False)  # JSON strings are valid YAML


def render_article_file(meta: dict, body_html: str) -> str:
    data = {"layout": "article", "source": "linkedin", **meta}
    keys = [k for k in FRONT_ORDER if k in data] + sorted(k for k in data if k not in FRONT_ORDER)
    lines = ["---"] + [f"{k}: {_yaml_scalar(data[k])}" for k in keys if data[k] is not None] + ["---", ""]
    return "\n".join(lines) + body_html


def parse_article_file(text: str) -> tuple[dict, str]:
    m = re.match(r"---\n(.*?)\n---\n?(.*)", text, re.S)
    if not m:
        raise ValueError("missing front matter")
    meta = {}
    for line in m.group(1).splitlines():
        key, _, raw = line.partition(": ")
        try:
            meta[key] = json.loads(raw)
        except json.JSONDecodeError:
            meta[key] = raw
    return meta, m.group(2)


def load_articles() -> list[dict]:
    arts = []
    for path in sorted(ARTICLES_DIR.glob("*.html")):
        meta, _ = parse_article_file(path.read_text(encoding="utf-8"))
        meta["slug"] = path.stem
        meta["date"] = str(meta.get("date", ""))
        arts.append(meta)
    return sorted(arts, key=lambda a: a["date"], reverse=True)


# ---------------------------------------------------------- homepage ----

def _e(text) -> str:
    return htmllib.escape(str(text), quote=True)


def _t(text) -> str:
    return htmllib.escape(str(text), quote=False)


def _fmt_date(iso: str) -> str:
    return time.strftime("%b %Y", time.strptime(iso, "%Y-%m-%d")).upper()


def render_home_block(articles: list[dict]) -> str:
    latest = sorted(articles, key=lambda a: a["date"], reverse=True)[:HOME_LIMIT]
    cards = []
    for a in latest:
        cards.append(
            f'      <a class="writing-card" href="/articles/{_e(a["slug"])}/" data-fade>\n'
            f'        <span class="writing-card__meta">{_e(_fmt_date(a["date"]))} · {_e(a.get("reading_minutes", 1))} min</span>\n'
            f'        <h3 class="writing-card__title">{_t(a["title"])}</h3>\n'
            f'        <p class="writing-card__desc">{_t(a.get("description") or a.get("summary", ""))}</p>\n'
            f"      </a>"
        )
    return "\n".join(cards)


def update_index(text: str, block: str) -> str:
    if not INDEX_PATTERN.search(text):
        sys.exit("ERROR: AUTOGEN:articles markers not found in index.html")
    return INDEX_PATTERN.sub(lambda m: m.group(1) + "\n" + block + "\n" + m.group(2), text, count=1)


def sync(check: bool) -> int:
    current = INDEX.read_text(encoding="utf-8")
    updated = update_index(current, render_home_block(load_articles()))
    if current == updated:
        print("homepage writing block: up to date")
        return 0
    if check:
        sys.stdout.writelines(difflib.unified_diff(
            current.splitlines(True), updated.splitlines(True), "index.html (committed)", "index.html (expected)"))
        print("\nERROR: homepage writing block is stale. Run: python3 scripts/linkedin_articles.py sync")
        return 1
    INDEX.write_text(updated, encoding="utf-8")
    print("homepage writing block: rewritten")
    return 0


# -------------------------------------------------------------- import ----

def fetch(url: str, cache_dir: Path | None, binary: bool = False):
    cache = None
    if cache_dir and not binary:
        cache = cache_dir / (urllib.parse.quote(url, safe="") + ".html")
        if cache.exists():
            return cache.read_text(encoding="utf-8"), None
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept-Language": "en-US,en"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                data, ctype = resp.read(), resp.headers.get("Content-Type", "")
            break
        except Exception as exc:  # noqa: BLE001 - retried, then surfaced
            if attempt == 3:
                raise
            print(f"  retry {url}: {exc}", file=sys.stderr)
            time.sleep(FETCH_DELAY_SECONDS * 2 ** (attempt + 1))
    time.sleep(FETCH_DELAY_SECONDS)
    if binary:
        return data, ctype
    text = data.decode("utf-8", "replace")
    if cache:
        cache_dir.mkdir(parents=True, exist_ok=True)
        cache.write_text(text, encoding="utf-8")
    return text, ctype


EXT = {"image/jpeg": ".jpg", "image/png": ".png", "image/gif": ".gif", "image/webp": ".webp"}


def save_image(url: str, dest_stem: Path) -> str | None:
    try:
        data, ctype = fetch(url, None, binary=True)
    except Exception as exc:  # noqa: BLE001
        print(f"  WARN image not saved ({exc}): {url}", file=sys.stderr)
        return None
    dest = dest_stem.with_suffix(EXT.get((ctype or "").split(";")[0].strip(), ".jpg"))
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    return "/" + optimize_image(dest).relative_to(ROOT).as_posix()


def optimize_image(path: Path) -> Path:
    """Re-encode heavy images as JPEG (ImageMagick, if installed). LinkedIn
    serves some covers as 1.5 MB PNGs; the site should not ship those."""
    convert = shutil.which("convert")
    if not convert or path.stat().st_size <= MAX_IMAGE_BYTES or path.suffix == ".gif":
        return path
    out = path.with_suffix(".jpg") if path.suffix != ".jpg" else path.with_name(path.stem + ".tmp.jpg")
    subprocess.run([convert, str(path), "-resize", "1280x>", "-strip", "-quality", "82", str(out)], check=True)
    if out.name.endswith(".tmp.jpg"):
        out.replace(path)
        return path
    path.unlink()
    return out


def import_one(pulse_slug: str, page_html: str) -> str:
    art = extract_article(page_html)
    if art["author"] != AUTHOR_NAME or not art["title"] or not art["date"]:
        raise ValueError(f"{pulse_slug}: not an article by {AUTHOR_NAME} (author={art['author']!r})")
    slug = short_slug(pulse_slug)
    path = ARTICLES_DIR / f"{slug}.html"
    previous = parse_article_file(path.read_text(encoding="utf-8"))[0] if path.exists() else {}

    body, images = clean_body(art["body_raw"])
    img_dir = IMAGES_DIR / slug
    for n, url in enumerate(images, 1):
        local = save_image(url, img_dir / f"img-{n:02d}")
        if local:
            body = body.replace(htmllib.escape(url, quote=True), local)
    cover = save_image(art["cover_url"], img_dir / "cover") if art["cover_url"] else None

    meta = {
        "title": art["title"],
        "date": art["date"],
        "summary": excerpt(body),
        "original_url": PULSE_BASE + pulse_slug,
        "cover": cover,
        "reading_minutes": reading_minutes(body),
    }
    for key in CURATED_KEYS:
        if key in previous:
            meta[key] = previous[key]
    ARTICLES_DIR.mkdir(exist_ok=True)
    path.write_text(render_article_file(meta, body), encoding="utf-8")
    return slug


def run_import(seeds: list[str], refresh: bool, cache_dir: Path | None) -> int:
    known = {short_slug(a["original_url"]): a["original_url"].rsplit("/", 1)[-1] for a in load_articles()}
    queue = list(known.values()) + [s.split("?")[0].rstrip("/").rsplit("/", 1)[-1] for s in seeds]
    seen: set[str] = set()
    imported = []
    while queue:
        pulse_slug = queue.pop(0)
        if pulse_slug in seen:
            continue
        seen.add(pulse_slug)
        print(f"fetch {pulse_slug}")
        try:
            page, _ = fetch(PULSE_BASE + pulse_slug, cache_dir)
        except Exception as exc:  # noqa: BLE001
            print(f"  WARN fetch failed: {exc}", file=sys.stderr)
            continue
        queue.extend(sorted(discover_links(page) - seen))
        if short_slug(pulse_slug) in known and not refresh:
            continue
        try:
            imported.append(import_one(pulse_slug, page))
        except ValueError as exc:
            print(f"  skip: {exc}", file=sys.stderr)
    print(f"discovered {len(seen)} article(s); wrote {len(imported)}: {', '.join(imported) or '-'}")
    return sync(check=False)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    imp = sub.add_parser("import", help="fetch new LinkedIn articles into _articles/")
    imp.add_argument("--seed", action="append", default=[], help="LinkedIn article URL to start from")
    imp.add_argument("--refresh", action="store_true", help="re-import existing articles (keeps curated fields)")
    imp.add_argument("--cache-dir", type=Path, help="cache fetched pages here (avoids re-fetching)")
    sub.add_parser("sync", help="rewrite the homepage writing block")
    sub.add_parser("check", help="exit 1 if the homepage writing block is stale")
    args = ap.parse_args()
    if args.cmd == "import":
        return run_import(args.seed, args.refresh, args.cache_dir)
    return sync(check=args.cmd == "check")


if __name__ == "__main__":
    sys.exit(main())
