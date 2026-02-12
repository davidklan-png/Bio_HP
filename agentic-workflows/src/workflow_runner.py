"""CLI entrypoint for running the agentic workflow skeleton."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import yaml

from agent import TaskState, execute_plan, finalize_response, plan_task, review_outputs


def load_config(path: Path) -> dict:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--task", required=True)
    parser.add_argument("--model", default="opus-4.6")
    parser.add_argument("--config", default="agentic-workflows/configs/workflow_config.yaml", type=Path)
    args = parser.parse_args()

    config = load_config(args.config)
    _ = config  # Placeholder for future step controls.

    state = TaskState(task=args.task, model=args.model)
    state = plan_task(state)
    state = execute_plan(state)
    state = review_outputs(state)
    final = finalize_response(state)

    print(json.dumps(final, indent=2))


if __name__ == "__main__":
    main()
