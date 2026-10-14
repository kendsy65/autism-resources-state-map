Autism Resources State Map

A free, plain-language guide for families planning the future of an autistic adult: find verified state, federal and nonprofit resources, then model what housing and support will cost over several years.

Live site → · Connecticut · Massachusetts · New York

<!-- Add a screenshot: save one as docs/screenshot.png and uncomment the line below --> <!-- ![State page showing the resource directory and cost planner](docs/screenshot.png) -->
The problem

When an autistic person turns 22 and school services end, their family has to piece together housing, income, employment and care from dozens of agencies and nonprofits. The information is scattered across government sites, written in program jargon, and often missing the numbers a family needs to plan. Families with an attorney or financial advisor can find their way through it. Most families don't have one.

This project started from one family's experience supporting an autistic adult in Connecticut. Even with professional help, they hit problems that better information would have prevented.

What it does
Pick a state. Start from a US map and choose CT, MA or NY.
Browse the directory. Housing, employment, financing and caregiver programs are grouped by who runs them (federal, state, city or nonprofit). Each row expands to show who qualifies, what it costs, the maximum benefit, how to apply, and a link to the source page.
Filter by need. Show only the programs that fit the person's level of support.
Plan the costs. A multi-year cost planner combines earnings, SSI and the state supplement, and housing costs under different programs. It flags benefit cliffs such as SSI breakeven, the Substantial Gainful Activity limit and the Medicaid 1619(b) threshold.
Know the timeline. A timing tab shows waitlists, application windows and age deadlines (for example, when to apply for adult developmental disability services).

Every figure is either taken from a linked public source and dated, or marked "Not published." Nothing is estimated without saying so.

By the numbers
3 states, with 250+ resources checked by hand against official or primary sources
4 levels of support tagged on every entry, plus whether it is federally funded
One data schema shared by every state, so adding a state is a data task rather than a code change
How it's built
Layer	Approach
Front end	Static HTML, CSS and vanilla JavaScript; responsive, accessible, with a dark mode
Data	One JSON file (with a matching CSV) per state and category, following a shared schema (data/SCHEMA.md)
Planner	Formulas for SSI earned-income rules, voucher rent shares and state residential charges, driven by planner-parameters.json, where every value carries its source URL
Hosting	Vercel
Process	Built with AI-assisted development (Claude Code) and source-by-source verification of every data point
data/
  SCHEMA.md                         Field definitions and data rules
  <STATE>/resources.json|csv        Housing, employment and financing resources
  <STATE>/caregiver-support.json|csv  Respite, family support and planning help
  <STATE>/planner-parameters.json   Planner inputs, each with a source URL
index.html                          US map landing page
state.html                          State directory, cost planner and timing
<!-- Check this tree against the repo before publishing -->
Data principles
Source or nothing. A dollar figure appears only if the linked page states it.
Dated. Every entry records the date it was checked.
Plain language. Written for a caregiver with no attorney or advisor.
Privacy. The real case used to test the planner contributes only aggregate support amounts and costs, never personal identifiers.
Team

Built by Sydney, Colm and Nnenna for 15.S23 (AI Seminar), MIT Sloan, Fall 2026.

<!-- Optional: add a line on your own role, e.g. "My role: product lead and data research — designed the data schema and verified 250+ resources across three states." -->
Roadmap
Validate the planner against more real cases, starting with partners such as NEXT for Autism
Add Social Security and community-living categories
Expand beyond the three pilot states
Disclaimer

All figures are estimates taken from public sources on the date shown, and they can change. This site is not legal or financial advice.
