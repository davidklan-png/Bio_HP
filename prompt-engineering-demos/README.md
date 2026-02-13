# Prompt Engineering Demos

Hands-on prompt template experiments with lightweight interactive testing.

## Contents

- `templates/`: reusable prompt patterns.
- `tests/interactive_prompt_test.py`: run template + input and validate output shape.

## Run

```bash
python3 tests/interactive_prompt_test.py \
  --template templates/structured_output_template.md \
  --input "Summarize recent churn reasons" \
  --model codex-5.3
```

## Evaluation Suggestions

- Add a fixed benchmark prompt set.
- Track adherence to expected response schema.
- Compare prompts across models with side-by-side scoring.

## Agent Handover Notes (2026-02-13)

- Keep templates in `templates/` model-agnostic where possible.
- For each new template, add at least one reproducible CLI test invocation.
- Prioritize deterministic output schema checks over style-only checks.
