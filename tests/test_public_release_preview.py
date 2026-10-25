#!/usr/bin/env python3
"""Tests for scripts/preview_public_release.py (local public-release preview).

All fixtures are synthetic. Runnable without pytest:

    python3 tests/test_public_release_preview.py
"""
import hashlib
import importlib.util
import json
import subprocess
import sys
import tempfile
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "scripts" / "preview_public_release.py"

spec = importlib.util.spec_from_file_location("preview_public_release", SCRIPT)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)  # only write_atomic/PreviewError are used directly

# Synthetic revision (40 hex chars) and unique fake markers. Markers appear only
# in deliberately invalid/secret-bearing fixtures; they must never reach stdout
# or stderr.
REV = "0123abcd" * 5
MARKERS = (
    "MK-STMT", "MK-JA", "MK-PERIOD", "MK-PURPOSE", "MK-AUDIENCE",
    "MK-EXTRA", "MK-REV", "MK-DUP", "MK-ID", "MK-STATUS", "MKPATH",
    "MKMISSING", "MK-ARG",
)


def claim(cid, status="verified", statement=None, **optional):
    c = {"id": cid, "status": status,
         "statement": statement if statement is not None else f"Synthetic statement for {cid}."}
    c.update(optional)
    return c


def build_doc(claims_list=None, **top):
    doc = {
        "purpose": "profile-homepage",
        "audience": "public",
        "knowledge_revision": REV,
        "claims": claims_list if claims_list is not None else [claim("synth.alpha")],
    }
    doc.update(top)
    return doc


def encode(payload):
    if isinstance(payload, bytes):
        return payload
    if isinstance(payload, str):
        return payload.encode("utf-8")
    return json.dumps(payload, ensure_ascii=False).encode("utf-8")


def write_input(tmp, payload, name="input.json"):
    path = Path(tmp) / name
    path.write_bytes(encode(payload))
    return path


def run_cli(*args, script=SCRIPT):
    return subprocess.run(
        [sys.executable, str(script), *args],
        capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT),
    )


def disposable_project(tmp):
    """Byte-identical script copy in a synthetic project: (script, preview_path).

    Every test that can write output runs against this copy so the suite never
    touches this checkout's build/ tree (a developer's existing preview at
    build/preview/prompt-facts.txt must survive the documented suite run).
    """
    proj = Path(tmp) / "proj"
    (proj / "scripts").mkdir(parents=True)
    script = proj / "scripts" / "preview_public_release.py"
    script.write_bytes(SCRIPT.read_bytes())
    return script, proj / "build" / "preview" / "prompt-facts.txt"


def assert_no_markers(r):
    combined = r.stdout + r.stderr
    for marker in MARKERS:
        assert marker not in combined, f"unsafe output leaked {marker}: {combined!r}"


def expect_rejected(payload):
    """The CLI must reject payload safely: nonzero exit, ERROR, no marker leak."""
    with tempfile.TemporaryDirectory() as tmp:
        path = write_input(tmp, payload)
        r = run_cli(str(path))
        assert r.returncode != 0, f"expected rejection of {payload!r}"
        assert "ERROR" in (r.stdout + r.stderr), (r.returncode, r.stdout, r.stderr)
        assert_no_markers(r)
        return r


def run_valid(payload):
    """Valid run against a disposable project copy.

    Returns (result, input_bytes_after, preview_bytes); reads happen inside
    the temporary project's lifetime. The disposable preview directory must
    contain exactly the final preview file.
    """
    with tempfile.TemporaryDirectory() as tmp:
        script, preview = disposable_project(tmp)
        path = write_input(tmp, payload)
        r = run_cli(str(path), script=script)
        assert r.returncode == 0, (r.stdout, r.stderr)
        assert sorted(p.name for p in preview.parent.glob("*")) == [preview.name]
        return r, path.read_bytes(), preview.read_bytes()


def test_valid_minimal_input():
    stmt = "Synthetic minimal statement with kanji 検証 and emoji 🧠."
    payload = build_doc([claim("synth.min", statement=stmt)])
    raw = encode(payload)
    r, after, preview_bytes = run_valid(payload)
    digest = hashlib.sha256(raw).hexdigest()
    # Success output: safe metadata only.
    assert r.stdout.splitlines() == [
        f"input_sha256: {digest}",
        f"knowledge_revision: {REV}",
        "claims: 1",
        "local preview; not approved for use",
    ]
    text = preview_bytes.decode("utf-8")
    assert "LOCAL PREVIEW" in text and "NOT APPROVED FOR USE" in text
    assert "not a complete chronology" in text and "not a live prompt" in text
    assert "synth.min" in text
    assert "[synth.min] status: verified" in text
    assert f"statement: {stmt}" in text
    assert f"knowledge_revision: {REV}" in text
    assert f"input_sha256: {digest}" in text
    # No invented JA/period lines when the fields are absent.
    assert not any(line.startswith("ja: ") for line in text.splitlines())
    assert not any(line.startswith("period: ") for line in text.splitlines())
    # Input file untouched; run_valid asserts the preview dir holds only the
    # final preview itself.
    assert after == raw


def test_full_input_verbatim_and_deterministic():
    stmt_a = "Synthetic A — カタカナ・テスト 🧠 énd MK-free"
    ja_a = "合成文A（テスト用）そのまま"
    period_a = "2019-04 to 2021-09 (synthetic)"
    stmt_b = 'Synthetic B "quoted" with\nnewline kept verbatim'
    stmt_c = "Synthetic C decomposed é only"
    claims_list = [
        claim("synth.alpha", statement=stmt_a, statement_ja=ja_a, period=period_a),
        claim("synth.beta", status="historical", statement=stmt_b),
        claim("synth.gamma", statement=stmt_c, period="2022 (synthetic)"),
    ]
    payload = build_doc(claims_list)
    raw = encode(payload)
    with tempfile.TemporaryDirectory() as tmp:
        script, preview = disposable_project(tmp)
        src = write_input(tmp, payload)
        r1 = run_cli(str(src), script=script)
        assert r1.returncode == 0, (r1.stdout, r1.stderr)
        first = preview.read_bytes()
        r2 = run_cli(str(src), script=script)
        assert r2.returncode == 0, (r2.stdout, r2.stderr)
        second = preview.read_bytes()
    # Deterministic: identical input bytes -> identical preview bytes, twice.
    assert first == second
    digest = hashlib.sha256(raw).hexdigest()
    assert f"input_sha256: {digest}" in r1.stdout and "claims: 3" in r1.stdout
    text = first.decode("utf-8")
    # Exact verbatim EN/JA/period preservation, no normalization.
    assert f"statement: {stmt_a}" in text
    assert f"ja: {ja_a}" in text
    assert f"period: {period_a}" in text
    assert f"statement: {stmt_b}" in text
    assert f"statement: {stmt_c}" in text
    assert f"period: 2022 (synthetic)" in text
    assert text.count("é") == 2 and "é" not in text
    # IDs/statuses rendered in sorted document order.
    assert text.index("synth.alpha") < text.index("synth.beta") < text.index("synth.gamma")
    assert "status: historical" in text


def test_rejects_malformed_json_and_constants():
    expect_rejected(b'{"purpose": "profile-homepage", "audience":')  # syntax error
    expect_rejected('{"junk": NaN, "note": "MK-STMT"}')             # nonstandard constant
    expect_rejected(b'\xff\xfe{"purpose": "profile-homepage"}')     # not UTF-8


def test_rejects_duplicate_keys():
    expect_rejected(
        '{"purpose": "profile-homepage", "purpose": "MK-DUP", '
        f'"audience": "public", "knowledge_revision": "{REV}", ' +
        '"claims": [{"id": "synth.a", "status": "verified", "statement": "s"}]}'
    )


def test_rejects_top_level_problems():
    expect_rejected([1, 2, 3])                       # not an object
    doc = build_doc(); del doc["audience"]
    expect_rejected(doc)                             # missing key
    doc = build_doc(); doc["MK-EXTRA"] = "x"
    expect_rejected(doc)                             # extra key
    expect_rejected(build_doc(purpose="MK-PURPOSE"))
    expect_rejected(build_doc(audience="MK-AUDIENCE"))
    expect_rejected(build_doc(knowledge_revision="a" * 39))
    expect_rejected(build_doc(knowledge_revision="z" * 40))
    expect_rejected(build_doc(knowledge_revision=123))


def test_rejects_claim_problems():
    expect_rejected(build_doc([]))                                  # empty selection
    expect_rejected(build_doc({"not": "a list"}))
    expect_rejected(build_doc([{"id": "synth.a", "status": "verified"}]))  # missing statement
    expect_rejected(build_doc([dict(claim("synth.a"), **{"MK-EXTRA": "x"})]))
    expect_rejected(build_doc([claim("synth.a", status="MK-STATUS")]))
    expect_rejected(build_doc([dict(claim("synth.a", statement="MK-STMT"), id=" ")]))
    expect_rejected(build_doc([{"id": 7, "status": "verified", "statement": "s"}]))
    expect_rejected(build_doc([claim("synth.a", statement=" ")]))
    expect_rejected(build_doc([claim("synth.a", statement_ja=" ")]))
    expect_rejected(build_doc([claim("synth.a", statement_ja=["MK-JA"])]))
    expect_rejected(build_doc([claim("synth.a", period="")]))


def test_rejects_duplicate_and_unsorted_ids():
    expect_rejected(build_doc([claim("synth.dup"), claim("synth.dup", statement="MK-STMT")]))
    expect_rejected(build_doc([claim("synth.b"), claim("synth.a")]))


def test_failure_preserves_previous_preview():
    good = build_doc([claim("synth.keep", statement="Synthetic keeper statement.")])
    with tempfile.TemporaryDirectory() as tmp:
        script, preview = disposable_project(tmp)
        src = write_input(tmp, good)
        r1 = run_cli(str(src), script=script)
        assert r1.returncode == 0, (r1.stdout, r1.stderr)
        previous = preview.read_bytes()
        bad = build_doc([claim("synth.bad", status="MK-STATUS")])
        path = write_input(tmp, bad, name="bad.json")
        r2 = run_cli(str(path), script=script)
        assert r2.returncode != 0
        assert_no_markers(r2)
        assert path.read_bytes() == encode(bad)
        assert preview.read_bytes() == previous  # previous final preview untouched


def test_input_aliasing_output_rejected():
    """F1: an input that is (or aliases) the output destination must be refused."""
    payload = build_doc([claim("synth.alias", statement="Synthetic alias statement.")])
    with tempfile.TemporaryDirectory() as tmp:
        script, preview = disposable_project(tmp)
        preview.parent.mkdir(parents=True, exist_ok=True)
        preview.write_bytes(encode(payload))  # valid JSON placed at the output path
        before = preview.read_bytes()
        r = run_cli(str(preview), script=script)
        assert r.returncode != 0
        assert "ERROR" in (r.stdout + r.stderr)
        assert preview.read_bytes() == before  # input bytes preserved, exit nonzero
        # Symlink alias: input path elsewhere, resolving to the output destination.
        alias = Path(tmp) / "alias.json"
        alias.symlink_to(preview)
        r = run_cli(str(alias), script=script)
        assert r.returncode != 0
        assert "ERROR" in (r.stdout + r.stderr)
        assert preview.read_bytes() == before


def test_symlinked_output_dirs_rejected():
    """F2: symlinked build/ or build/preview must not redirect writes outside.

    Runs a byte-identical copy of the script inside a disposable synthetic
    project, so the symlink fixtures never touch this checkout's build/ tree
    (unrelated generated outputs under build/ must survive the suite).
    """
    with tempfile.TemporaryDirectory() as scratch:
        scratch = Path(scratch)
        script_copy, preview = disposable_project(scratch)
        build = preview.parents[1]  # <scratch>/proj/build

        # Case A: `build` itself is a symlink to an outside synthetic directory.
        outside = scratch / "outside-a"
        (outside / "preview").mkdir(parents=True)
        sentinel = outside / "preview" / "prompt-facts.txt"
        sentinel.write_bytes(b"SENTINEL-A")
        build.symlink_to(outside)
        src = write_input(scratch, build_doc())
        r = run_cli(str(src), script=script_copy)
        assert r.returncode != 0
        assert "ERROR" in (r.stdout + r.stderr)
        assert sentinel.read_bytes() == b"SENTINEL-A"
        assert sorted(str(p.relative_to(outside)) for p in outside.rglob("*")) == [
            "preview", "preview/prompt-facts.txt"
        ]
        build.unlink()

        # Case B: `build` is real, `build/preview` is a symlink to outside.
        outside = scratch / "outside-b"
        outside.mkdir()
        sentinel = outside / "prompt-facts.txt"
        sentinel.write_bytes(b"SENTINEL-B")
        build.mkdir()
        (build / "preview").symlink_to(outside)
        src = write_input(scratch, build_doc())
        r = run_cli(str(src), script=script_copy)
        assert r.returncode != 0
        assert "ERROR" in (r.stdout + r.stderr)
        assert sentinel.read_bytes() == b"SENTINEL-B"
        assert [p.name for p in outside.iterdir()] == ["prompt-facts.txt"]


def test_write_atomic_failure_cleans_up():
    with tempfile.TemporaryDirectory() as tmp:
        final = Path(tmp) / "prompt-facts.txt"
        final.write_bytes(b"previous final")
        with mock.patch("os.replace", side_effect=OSError("boom")):
            try:
                mod.write_atomic(final, b"new bytes")
                raised = False
            except mod.PreviewError:
                raised = True
        assert raised
        assert final.read_bytes() == b"previous final"
        assert [p.name for p in Path(tmp).iterdir()] == ["prompt-facts.txt"]


def test_unreadable_missing_and_bad_usage_safe():
    with tempfile.TemporaryDirectory() as tmp:
        # Directory-as-input: deterministic read failure on any UID (root
        # containers bypass mode bits, but cannot read() a directory).
        script, preview = disposable_project(tmp)
        not_a_file = Path(tmp) / "MKPATH-input.json"
        not_a_file.mkdir()
        r = run_cli(str(not_a_file), script=script)
        assert r.returncode != 0 and "ERROR" in (r.stdout + r.stderr)
        assert_no_markers(r)
        assert not preview.exists()  # failed read writes nothing
        r = run_cli(str(Path(tmp) / "MKMISSING.json"))
        assert r.returncode != 0 and "ERROR" in (r.stdout + r.stderr)
        assert_no_markers(r)
    r = run_cli()
    assert r.returncode != 0
    assert_no_markers(r)
    r = run_cli("a.json", "MK-ARG")
    assert r.returncode != 0
    assert_no_markers(r)


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
