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
