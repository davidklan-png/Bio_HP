# Use-Case Notebooks

Business-oriented notebook walkthroughs for stakeholder communication and technical review.

## Included

- `01_customer_support_triage.ipynb`: classify and route support tickets.
- `02_rfp_response_assistant.ipynb`: draft structured RFP responses.

## Best Practices

- Start with business objective + KPI definition in the first markdown cell.
- Keep prompts/configs versioned outside notebooks for reproducibility.
- End each notebook with evaluation summary (quality, latency, cost).

## Agent Handover Notes (2026-02-13)

- Keep notebooks business-first: objective, KPI, method, result.
- Do not store secrets in notebooks; use environment variables or local config files excluded by git.
- If adding a notebook, include:
  - a short business scenario summary in the first markdown cell
  - reproducible sample inputs in `use-case-notebooks/data/`
  - an explicit evaluation section at the end
