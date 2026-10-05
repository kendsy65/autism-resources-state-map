# CLAUDE.md

Context for Claude Code working in this repo.

## Project
A clickable prototype for caregivers of autistic adults: pick a state on a US map, browse resources by category, then model multi-year housing costs minus government support. Scope, priorities, schedule and roles are in the claude.ai project docs `claude/product-brief-draft.md` and `claude/build-plan-3-week.md`. Guiding principle: two categories done well beat five done poorly.

## Users
Caregivers with no attorney or professional help. Use plain language, no jargon, and never assume expert knowledge. Show a clear "estimates only, not legal or financial advice" disclaimer wherever numbers appear.

## Data
- Resources: `data/<STATE>/resources.json`, following `data/SCHEMA.md` exactly.
- Planner numbers: `data/<STATE>/planner-parameters.json`. Every value carries a `source` URL.
- Never invent figures. If a source doesn't state it, use `Not published`.
- Mark level of support on every resource (Federal / State / City / Private/Nonprofit) plus `federally_funded`.
- Each resource has `date_checked`; update it when re-verifying.

## Planner logic (MA, 2026) — see prototype for the reference implementation
- Monthly earnings = hours/week × wage × 52 / 12
- SSI countable earnings = max(0, (earnings − 20 − 65) / 2); SSI+SSP = max(0, 1122.82 − countable)
- Voucher/public housing rent ≈ 30% of income (real programs use adjusted income)
- DDS 24-hr residential charge = 0.75 × benefits + 0.5 × max(0, earnings − 65)
- Flags: SGA $1,690/mo, Trial Work $1,210/mo, 1619(b) $52,015/yr, MA min wage $15/hr
- Known simplifications: no other unearned income; unverified whether MA SSP reduces the same way as federal SSI. Write unit tests for these formulas and test against the founder's real case (Sam, CT) — never store his personal identifiers.

## Conventions
- Keep the site static and simple (no accounts, no live data) for this sprint.
- Keep the CSV and JSON in sync if you edit data.
