# Resource data template

Every state has `data/<STATE>/resources.json`: an array of objects with these fields. Keep the CSV in sync (same column order).

| Field | Type | Values / notes |
|---|---|---|
| `id` | string | `<state>-<cat>-<slug>`, unique, lowercase |
| `state` | string | `MA`, `CT`, `NY` |
| `category` | string | `Housing`, `Financing`, `Employment`, `Social Security`, `Community Enrichment` |
| `subtype` | string | Optional. Employment: `Program`, `Employer`, `Supported employment`, `Work incentive`. Housing: `Residential program` |
| `name` | string | Plain-language name |
| `level` | string | `Federal`, `State`, `City`, `Private/Nonprofit` — who the family deals with |
| `federally_funded` | boolean | True for federal programs and for federal money run by a state or city (e.g. MassAbility VR, housing authorities) |
| `administrator` | string | Agency or organization that runs it |
| `city` | string | City for city programs or single-location orgs; empty if statewide |
| `region` | string | Heat-map region (MA: Greater Boston, Northeast, Central, West, Southeast) or `Statewide` |
| `description` | string | 1–2 plain sentences |
| `eligibility` | string | Who qualifies |
| `upfront_cost` | string | What the family pays to get in |
| `ongoing_cost` | string | Recurring cost |
| `max_benefit` | string | Dollar cap where published |
| `how_to_apply` | string | Phone, email, website |
| `source_url` | string | Official or primary page that was actually checked |
| `date_checked` | string | ISO date |
| `notes` | string | Waitlists, closures, caveats |

## Rules

- Only record a figure that appears on the source page. Otherwise write `Not published`.
- Use current agency names (MA: EOHLC not DHCD; MassAbility not MRC).
- Confirm businesses are still open before adding them.
- Numbers the planner computes with go in `planner-parameters.json` as numeric values with a `source`, not in the text fields.
