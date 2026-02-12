"""Tool stubs for agent workflows.

Best-practice note:
- Keep tool interfaces deterministic and typed.
- Return metadata (confidence, source, timestamps) for auditability.
"""

from __future__ import annotations

from datetime import datetime, timezone


def lookup_policy(question: str) -> dict:
    return {
        "tool": "lookup_policy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "result": f"Stubbed policy lookup for: {question}",
        "confidence": 0.82,
    }


def summarize_context(context: str) -> dict:
    return {
        "tool": "summarize_context",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "result": f"Stubbed summary: {context[:120]}",
        "confidence": 0.79,
    }
