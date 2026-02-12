# Agentic Workflows

Reusable multi-step task orchestration pattern with clear state transitions.

## Pattern

1. Plan task.
2. Execute tools.
3. Review outputs.
4. Finalize response.

## Run

```bash
python3 src/workflow_runner.py --task "Draft go-live mitigation plan" --model opus-4.6
```

## Engineering Notes

- Keep each role (`planner`, `executor`, `reviewer`) isolated for easier testing.
- Save intermediate state for observability.
- Add strict stop conditions to avoid runaway loops.
