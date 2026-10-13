# Resource data template

Every state has `data/<STATE>/resources.json`: an array of objects with these fields. Keep the CSV in sync (same column order).

| Field | Type | Values / notes |
|---|---|---|
| `id` | string | `<state>-<cat>-<slug>`, unique, lowercase |
| `state` | string | `MA`, `CT`, `NY`, or `US` for federal resources in `data/US/` that apply in every state |
| `category` | string | `Housing`, `Financing`, `Employment` (job support: coaching, training, placement; shown as "Employment support"), `Employers` (businesses and programs that hire and pay people directly), `Social Security`, `Community Enrichment` |
| `subtype` | string | Optional. Employment: `Program`, `Supported employment`, `Work incentive`. Employers: `Employer`, `Paid training site`, `Hiring program`. Housing: `Residential program`. Financing: `Cash assistance`, `Discount`, `Tax credit`, `Savings & trusts`, `Paid caregiving & services`, `Grant`, `Loan` |
| `name` | string | Plain-language name |
| `level` | string | `Federal`, `State`, `City`, `Private/Nonprofit` — who the family deals with |
| `federally_funded` | boolean | True for federal programs and for federal money run by a state or city (e.g. MassAbility VR, housing authorities) |
| `administrator` | string | Agency or organization that runs it |
| `city` | string | City for city programs or single-location orgs; empty if statewide |
| `region` | string | Heat-map region (regions per state are listed in `planner-parameters.json`: towns for MA, counties for CT and NY) or `Statewide` |
| `description` | string | 1–2 plain sentences |
| `eligibility` | string | Who qualifies |
| `upfront_cost` | string | What the family pays to get in |
| `ongoing_cost` | string | Recurring cost |
| `max_benefit` | string | Dollar cap where published |
| `how_to_apply` | string | Phone, email, website |
| `source_url` | string | Official or primary page that was actually checked |
| `date_checked` | string | ISO date |
| `notes` | string | Waitlists, closures, caveats |
| `funding_route` | string | Optional. How the service is usually paid for: `Family-paid`, `MassHealth`, `DDS`, `DDS + MassHealth`, `DDS + MassAbility`, `State grant`, `Business revenue`, `Mixed`. Used to avoid counting a provider's cost and the state benefit that pays it twice |
| `needs_checking` | boolean | True when something about the entry is still unconfirmed. The site shows a "Not yet verified" tag |
| `to_check` | string | What still needs confirming. Required when `needs_checking` is true |
| `for_profit` | boolean | True for companies. `level` stays `Private/Nonprofit`; the site tags them "Company" and leaves them out of the Nonprofits card |
| `support_needs` | string | Optional, job entries: `Low support needs`, `Moderate to high support needs`, `Wide range`. The team's reading of who a program serves; drives the "Fits their support level" tag |
| `apply_steps` | string[] | Optional. Plain-language steps to apply, taken from the program's own page (CSV: joined with ` \| `). Required for nonprofit Financing entries |
| `apply_source` | string | Page the steps were checked against |
| `apply_window` | string | When to apply, in words ("Year-round", "Quarterly. Current cycle: …") |
| `apply_opens` | string | Optional. `YYYY-MM-DD`, or `YYYY-MM` when only the month is published |
| `apply_closes` | string | Optional. `YYYY-MM-DD`. The site shows "Open now · closes …", "Reopens …" or "Closed" from these dates |

## Rules

- Only record a figure that appears on the source page. Otherwise write `Not published`.
- Use current agency names (MA: EOHLC not DHCD; MassAbility not MRC).
- Confirm businesses are still open before adding them.
- Numbers the planner computes with go in `planner-parameters.json` as numeric values with a `source`, not in the text fields.

## Timing items (planner-parameters.json → `timing`)

Each item has `item`, `value`, `note`, `source`, plus these fields that drive the caregiver's "Next steps":

| Field | Values / notes |
|---|---|
| `focus` | `Housing`, `Employment` or `Both` — which caregivers see it |
| `age_min` | Optional number. Shown as "Coming up" up to 4 years before, "Now" from this age |
| `age_max` | Optional number. Hidden once the person is older |
| `city` | Optional. For city-only items; shown only within 25 miles of the person's ZIP |
| `id` | Short slug used by the Timing & waitlists tab (e.g. `section-8`) |
| `process` | `{ steps: [{title, detail, time?}], sources: [url], checked }`. The steps in order, each taken from the source pages; `time` only when a source states it. Shown as a numbered process map |

Only set ages that the `value` or `note` text (and its source) actually states.
