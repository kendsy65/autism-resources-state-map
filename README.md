# Autism Resources State Map

An interactive website that helps caregivers of autistic adults find housing, financing and employment resources in their state and plan the costs over several years.

**Team:** Sydney, Colm, Nnenna · MIT Sloan AI Seminar · Prototype due end of October 2026
**States in scope:** Connecticut, Massachusetts, New York

## Run the site

The site is plain HTML/JS with no build step. It loads the JSON files, so it needs a local web server (opening the file directly won't work):

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. Run the planner tests with `npm test` (Node 18+).

To publish, turn on GitHub Pages for the repo (deploy from the main branch, root folder).

## Deploying (Vercel)

The live site is hosted on Vercel, which reads this GitHub repo. Every push to `master` rebuilds the site automatically, usually within a minute; nothing needs redeploying by hand.

- **No secrets.** The site has no API keys or environment variables. Keep it that way: `.env` files are gitignored, and none should ever be committed.
- **What's public:** everything except the files listed in `.vercelignore` (`CLAUDE.md`, `prototype/`, `tests/`, `scripts/`, `package.json`). A new file anywhere else is public by default, so check before pushing anything that shouldn't be.
- **Settings:** `vercel.json` adds basic security headers and makes data files refresh on every visit.
- **Before pushing:** run `npm test` and check the site on localhost.

## What's here

```
index.html                   Landing page: "caring for someone" (5 questions) or "researching" (map)
state.html                   State page (state.html?s=MA): "Your plan", directory, cost planner
assets/css/style.css         Shared styles
assets/js/common.js          States in scope, data loading helpers
assets/js/planner.js         Planner math (reads planner-parameters.json)
assets/js/profile.js         Caregiver answers (kept in the browser only) → next steps, ranking, work scenarios
assets/js/geo.js             ZIP lookup, distances, nearest region
assets/js/support.js         Government vs nonprofit support, normalized per month, inflation, side-by-side scenarios
assets/js/glossary.js        Glossary matching for the "Ask about a term" assistant (data/glossary.json)
assets/js/chat.js            The assistant panel and tappable terms on the page
tests/                       Unit tests for the planner and the next-steps logic
data/
  SCHEMA.md                  The data template every resource follows
  US/resources.json          Federal SSI / Social Security resources shown in every state
  US/economic-parameters.json Inflation inputs: Fed projections, CPI, SSA COLA (refresh after each FOMC meeting: Mar, Jun, Sep, Dec)
  glossary.json              ~57 plain-language terms with sources, used by the assistant
  <STATE>/zips.json          ZIP -> town, county, lat/lon (GeoNames, CC BY 4.0; rebuild with scripts/build-zips.py)
  <STATE>/resources.json     Resources: CT 100, MA 132, NY 109 (housing, financing, employment support, employers)
  <STATE>/place-aliases.json Town names in the research that the ZIP file spells differently
  MA/resources.csv           Same data, for spreadsheets
  MA/planner-parameters.json Numbers the cost planner uses (SSI, rent shares, DDS charges, earnings limits, financing)
  CT/resources.json          Empty, to fill in Week 1
  NY/resources.json          Empty, to fill in Week 2
prototype/
  ma-directory.html          Original MA prototype (reference only; the site replaces it)
CLAUDE.md                    Instructions for Claude Code when working in this repo
```

Product brief and 3-week build plan live in the claude.ai project "Autism Resources State Map" (`claude/product-brief-draft.md`, `claude/build-plan-3-week.md`).

## Status (Oct 5, 2026)

| State | Housing | Financing | Employment support | Employers | Planner numbers |
|---|---|---|---|---|---|
| CT | 43 | 22 | 32 | 3 | Done (state supplement is needs-based; DDS residential charges not published) |
| MA | 50 | 23 | 49 | 11 | Done, incl. financing and inflation |
| NY | 46 | 22 | 33 | 8 | Done (OPWDD county max rents not published) |

Plus 5 federal Social Security resources (`data/US/`) shown in every state.

**MA open items:** 10 entries are marked `needs_checking` (see `to_check`). Held back until confirmed: Breaking Grounds Café (closed; its site redirects to Northeast Arc), Flutie Spectrum Enterprises (no longer mentioned by the Flutie Foundation), Autism Works Inc. of Lawrence (the website in our notes belongs to an unrelated company in Washington State), Citizens Bank Autism at Work (program page removed from its careers site), Bitty & Beau's Melrose (no longer on the company's locations page).

Site skeleton is built. A state lights up on the map automatically once its `resources.json` has entries; its planner tab turns on once `planner-parameters.json` exists.

Next: Connecticut housing and financing data (Week 1 checkpoint).

## Getting started with Claude Code

1. Clone or open this folder in Claude Code.
2. Ask it to read `CLAUDE.md` and `data/SCHEMA.md` first.
3. Good first prompts:
   - "Set up the site skeleton: US map landing page, state page that loads `data/<STATE>/resources.json`, and a Housing/Financing/Employment filter."
   - "Turn the estimator in `prototype/ma-directory.html` into a planner module that reads `planner-parameters.json`, with unit tests."
   - "Research Connecticut housing resources and add them to `data/CT/resources.json` following SCHEMA.md."

## Disclaimer

Figures are estimates drawn from public sources on the date checked. They can change. This is not legal or financial advice.
