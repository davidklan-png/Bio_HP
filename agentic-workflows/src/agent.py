"""Minimal agent components for planner/executor/reviewer workflow.

Agent handover notes:
- Keep the stage order stable: plan -> execute -> review -> finalize.
- Preserve the dictionary contract returned by ``finalize_response``.
- Avoid embedding provider-specific logic in this module; keep it orchestration-only.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from tools import lookup_policy, summarize_context


# Handover guardrail: downstream consumers parse these keys from finalize_response().
FINAL_RESPONSE_KEYS = (
    "task",
    "model",
    "plan",
    "tool_outputs",
    "review_notes",
    "final_recommendation",
)


@dataclass
class TaskState:
    task: str
    model: str
    plan: list[str] = field(default_factory=list)
    tool_outputs: list[dict[str, Any]] = field(default_factory=list)
    review_notes: list[str] = field(default_factory=list)


def plan_task(state: TaskState) -> TaskState:
    state.plan = [
        "Clarify objective and constraints",
        "Gather relevant policy/context",
        "Draft recommendation and risk notes",
    ]
    return state


def execute_plan(state: TaskState) -> TaskState:
    for step in state.plan:
        if "policy" in step.lower() or "context" in step.lower():
            state.tool_outputs.append(lookup_policy(state.task))
        else:
            state.tool_outputs.append(summarize_context(f"Step: {step} | Task: {state.task}"))
    return state


def review_outputs(state: TaskState) -> TaskState:
    low_confidence = [o for o in state.tool_outputs if o.get("confidence", 0.0) < 0.8]
    if low_confidence:
        state.review_notes.append("Some tool outputs are low confidence; recommend human review.")
    state.review_notes.append("All required workflow stages completed.")
    return state


def finalize_response(state: TaskState) -> dict:
    # Keep final output structured so downstream systems can parse it reliably.
    response = {
        "task": state.task,
        "model": state.model,
        "plan": state.plan,
        "tool_outputs": state.tool_outputs,
        "review_notes": state.review_notes,
        "final_recommendation": "Proceed with mitigation plan and verify policy exceptions.",
    }
    # Defensive check for future refactors that might break integration expectations.
    for key in FINAL_RESPONSE_KEYS:
        if key not in response:
            raise KeyError(f"Missing required final response key: {key}")
    return response
