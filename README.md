# Autism Resources State Map

An interactive website that helps caregivers of autistic adults find housing, financing and employment resources in their state and plan the costs over several years.

**Team:** Sydney, Colm, Nnenna · MIT Sloan AI Seminar · Prototype due end of October 2026
**States in scope:** Connecticut, Massachusetts, New York

## What's here

```
data/
  SCHEMA.md                  The data template every resource follows
  MA/resources.json          94 Massachusetts housing + employment resources
  MA/resources.csv           Same data, for spreadsheets
  MA/planner-parameters.json Numbers the cost planner uses (SSI, rent shares, DDS charges, earnings limits)
  CT/resources.json          Empty, to fill in Week 1
  NY/resources.json          Empty, to fill in Week 2
prototype/
  ma-directory.html          Working MA directory + estimator (open in a browser)
CLAUDE.md                    Instructions for Claude Code when working in this repo
```

Product brief and 3-week build plan live in the claude.ai project "Autism Resources State Map" (`claude/product-brief-draft.md`, `claude/build-plan-3-week.md`).

## Status (Oct 5, 2026)

| State | Housing | Financing | Employment | Planner numbers |
|---|---|---|---|---|
| MA | 45 resources | Partly (SSI, AFC, HMLP, RAFT in planner file) | 49 resources | Done |
| CT | Not started | Not started | Not started | Not started |
| NY | Not started | Not started | Not started | Not started |

Next: Connecticut housing and financing data (Week 1 checkpoint), then the site skeleton with the US map.

## Getting started with Claude Code

1. Clone or open this folder in Claude Code.
2. Ask it to read `CLAUDE.md` and `data/SCHEMA.md` first.
3. Good first prompts:
   - "Set up the site skeleton: US map landing page, state page that loads `data/<STATE>/resources.json`, and a Housing/Financing/Employment filter."
   - "Turn the estimator in `prototype/ma-directory.html` into a planner module that reads `planner-parameters.json`, with unit tests."
   - "Research Connecticut housing resources and add them to `data/CT/resources.json` following SCHEMA.md."

## Disclaimer

Figures are estimates drawn from public sources on the date checked. They can change. This is not legal or financial advice.
