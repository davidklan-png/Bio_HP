#!/usr/bin/env python3
"""Render a local, unapproved preview of the frozen CS-02 public-release chat facts.

Validates a public-release candidate JSON file against the frozen closed shape
(top-level keys exactly ``purpose``/``audience``/``knowledge_revision``/``claims``;
claims with exactly ``id``/``status``/``statement`` plus optional
``statement_ja``/``period``; IDs unique and sorted) and renders a deterministic
chat-facts excerpt to ``build/preview/prompt-facts.txt`` (gitignored).

Usage::

    python3 scripts/preview_public_release.py <public-release-candidate.json>

This is format validation and local rendering only. It does not verify Git
revisions, evidence, private restrictions or owner consent, it approves
nothing, and it changes no live page, chat or worker consumer. Successful runs
print only the input SHA-256, the knowledge revision, the claim count and the
fixed notice ``local preview; not approved for use``.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "build" / "preview" / "prompt-facts.txt"

USAGE = "usage: python3 scripts/preview_public_release.py <public-release-candidate.json>"

TOP_KEYS = ("purpose", "audience", "knowledge_revision", "claims")
CLAIM_REQUIRED = ("id", "status", "statement")
CLAIM_OPTIONAL = ("statement_ja", "period")
STATUSES = ("verified", "historical")
REVISION_RE = re.compile(r"[0-9a-fA-F]{40}")


class PreviewError(Exception):
    """Validation or I/O failure carrying a terminal-safe message."""


class _DuplicateKeyError(ValueError):
    pass


def _reject_duplicate_keys(pairs):
    keys = [key for key, _ in pairs]
    if len(set(keys)) != len(keys):
        raise _DuplicateKeyError
    return dict(pairs)


def _reject_constant(_name):
    raise ValueError("nonstandard constant")


def read_input(path: str) -> bytes:
    try:
        with open(path, "rb") as fh:
            return fh.read()
    except OSError:
        raise PreviewError("cannot read input file")


def parse_document(raw: bytes):
    try:
        text = raw.decode("utf-8")
        return json.loads(
            text,
            object_pairs_hook=_reject_duplicate_keys,
            parse_constant=_reject_constant,
        )
    except _DuplicateKeyError:
        raise PreviewError("invalid JSON: duplicate object key")
    except (ValueError, RecursionError):
        raise PreviewError("invalid JSON document")


def validate_document(data) -> list:
    if not isinstance(data, dict):
        raise PreviewError("document must be a JSON object")
    for key in TOP_KEYS:
        if key not in data:
            raise PreviewError(f"missing required top-level key '{key}'")
    if any(key not in TOP_KEYS for key in data):
        raise PreviewError("unexpected additional top-level key(s)")
    if data["purpose"] != "profile-homepage":
        raise PreviewError("top-level key 'purpose' has an invalid value")
    if data["audience"] != "public":
        raise PreviewError("top-level key 'audience' has an invalid value")
    revision = data["knowledge_revision"]
    if not isinstance(revision, str) or not REVISION_RE.fullmatch(revision):
        raise PreviewError(
            "top-level key 'knowledge_revision' must be a 40-character hexadecimal string"
        )
    claims = data["claims"]
    if not isinstance(claims, list) or not claims:
        raise PreviewError("top-level key 'claims' must be a nonempty list")

    seen: set[str] = set()
    ids: list[str] = []
    for index, entry in enumerate(claims):
        if not isinstance(entry, dict):
            raise PreviewError(f"claims[{index}] must be a JSON object")
        for key in CLAIM_REQUIRED:
            if key not in entry:
                raise PreviewError(f"claims[{index}] is missing required key '{key}'")
        if any(key not in CLAIM_REQUIRED + CLAIM_OPTIONAL for key in entry):
            raise PreviewError(f"claims[{index}] has unexpected additional key(s)")
        for key in CLAIM_REQUIRED + CLAIM_OPTIONAL:
            if key in entry and (not isinstance(entry[key], str) or not entry[key].strip()):
                raise PreviewError(
                    f"claims[{index}] key '{key}' must be a nonblank string when present"
                )
        if entry["status"] not in STATUSES:
            raise PreviewError(f"claims[{index}] key 'status' has an invalid value")
        if entry["id"] in seen:
            raise PreviewError(f"claims[{index}] key 'id' duplicates an earlier claim")
        seen.add(entry["id"])
        ids.append(entry["id"])
    if ids != sorted(ids):
        raise PreviewError("claim ids must be sorted in ascending order")
    return claims


def render_preview(data: dict, claims: list, digest: str) -> bytes:
    lines = [
        "LOCAL PREVIEW - NOT APPROVED FOR USE",
        "Unapproved local excerpt; not a complete chronology; not a live prompt.",
        "",
        f"purpose: {data['purpose']}",
        f"audience: {data['audience']}",
        f"knowledge_revision: {data['knowledge_revision']}",
        f"input_sha256: {digest}",
        f"claims: {len(claims)}",
    ]
    for entry in claims:
        lines.append("")
        lines.append(f"[{entry['id']}] status: {entry['status']}")
        if "period" in entry:
            lines.append(f"period: {entry['period']}")
        lines.append(f"statement: {entry['statement']}")
        if "statement_ja" in entry:
            lines.append(f"ja: {entry['statement_ja']}")
    return ("\n".join(lines) + "\n").encode("utf-8")


def write_atomic(final: Path, payload: bytes) -> None:
    """Replace final atomically; on failure remove partials and keep the old file."""
    fd = None
    tmp: Path | None = None
    try:
        final.parent.mkdir(parents=True, exist_ok=True)
        fd, name = tempfile.mkstemp(dir=final.parent, prefix=".prompt-facts-", suffix=".tmp")
        tmp = Path(name)
        with os.fdopen(fd, "wb") as fh:
            fd = None
            fh.write(payload)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp, final)
        tmp = None
    except OSError:
        raise PreviewError("cannot write preview output")
    finally:
        if fd is not None:
            os.close(fd)
        if tmp is not None and tmp.exists():
            try:
                tmp.unlink()
            except OSError:
                pass


def main(argv=None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    if argv and argv[0] in ("-h", "--help"):
        print(__doc__)
        return 0
    if len(argv) != 1:
        print(USAGE, file=sys.stderr)
        return 2
    try:
        raw = read_input(argv[0])
        data = parse_document(raw)
        claims = validate_document(data)
        digest = hashlib.sha256(raw).hexdigest()
        write_atomic(OUTPUT, render_preview(data, claims, digest))
    except PreviewError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    except Exception:
        print("ERROR: preview generation failed", file=sys.stderr)
        return 1
    print(f"input_sha256: {digest}")
    print(f"knowledge_revision: {data['knowledge_revision']}")
    print(f"claims: {len(claims)}")
    print("local preview; not approved for use")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
