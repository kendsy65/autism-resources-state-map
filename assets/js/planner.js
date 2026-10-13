// Planner math. Pure functions so they can be unit-tested in Node and reused in the browser.
// All numbers come from data/<STATE>/planner-parameters.json — nothing is hard-coded here.

// NY's higher minimum wage covers NYC, Long Island and Westchester (planner key ny_minimum_wage_nyc_li_westchester).
const NY_HIGH_WAGE_COUNTIES = ["New York", "Kings", "Queens", "Bronx", "Richmond", "Nassau", "Suffolk", "Westchester"];

// Flatten a state's parameters file into the numbers the estimator uses. Each state names its programs
// differently, so take the first key that exists; federal Social Security rules come from `us.ssa`
// (data/US/economic-parameters.json) when the state file doesn't repeat them. `home` (a ZIP lookup)
// picks New York's regional minimum wage. Missing programs stay undefined and the page hides them.
export function fromParams(p, us = null, home = null) {
  const i = p.income || {}, h = p.housing || {}, e = p.employment || {}, fed = us?.ssa || {};
  const num = x => (x && typeof x.value === "number" ? x.value : undefined);
  const first = (...xs) => xs.map(num).find(n => n !== undefined);
  const stateSsp = first(i.ssi_plus_ssp_living_independently, i.ssi_plus_ssp_living_alone);
  const nyHigh = home && NY_HIGH_WAGE_COUNTIES.includes(home.county);
  return {
    state: p.state,
    year: p.year,
    ssiFull: stateSsp ?? first(i.ssi_federal_monthly, fed.ssi_federal_monthly),
    ssiLabel: stateSsp !== undefined ? "SSI + state supplement" : "Federal SSI",
    ssiNote: stateSsp === undefined ? (i.ct_state_supplement_how_it_works?.note || "") : "",
    genEx: first(i.ssi_general_income_exclusion, e.ssi_general_income_exclusion, fed.ssi_general_income_exclusion),
    earnEx: first(i.ssi_earned_income_exclusion, e.ssi_earned_income_exclusion, fed.ssi_earned_income_exclusion),
    countRate: first(i.ssi_earned_income_countable_rate, e.ssi_earned_income_countable_rate, fed.ssi_earned_income_countable_rate),
    afc1: num(i.afc_caregiver_min_pay_level1),
    afc2: num(i.afc_caregiver_min_pay_level2),
    rentShare: first(h.section8_tenant_share),
    // Only Massachusetts publishes a residential charge formula; elsewhere the option is hidden.
    ddsBen: num(h.dds_residential_charge_benefits),
    ddsEarn: num(h.dds_residential_charge_earnings),
    minWage: first(e.ma_minimum_wage, e.ct_minimum_wage, nyHigh ? e.ny_minimum_wage_nyc_li_westchester : e.ny_minimum_wage_rest_of_state),
    minWageNote: e.ny_minimum_wage_rest_of_state ? (nyHigh ? "NYC, Long Island and Westchester rate" : home ? "Rate outside NYC, Long Island and Westchester" : "Rate outside NYC, Long Island and Westchester ($17 there)") : "",
    sga: first(e.sga_non_blind, fed.sga_non_blind),
    twp: first(e.trial_work_period_month, fed.trial_work_period_month),
    b1619: first(e.section_1619b_ma_threshold, e.section_1619b_ct_threshold, e.section_1619b_ny_threshold),
    medicaid: p.state === "MA" ? "MassHealth" : "Medicaid",
    buyIn: h.commonhealth_premium ? "MassHealth CommonHealth" : e.med_connect_income_limit ? "Med-Connect (Medicaid for Employees with Disabilities)"
      : e.medicaid_buy_in_wpd_income_limit ? "the Medicaid Buy-In for Working People with Disabilities" : "",
  };
}

// Monthly earnings = hours/week × wage × 52 / 12
export function monthlyEarnings(hoursPerWeek, wage) {
  return Math.max(0, hoursPerWeek) * Math.max(0, wage) * 52 / 12;
}

// SSI countable earnings = max(0, (earnings − 20 − 65) × 0.5). Assumes no other unearned income.
export function countableEarnings(earn, P) {
  return Math.max(0, (earn - P.genEx - P.earnEx) * P.countRate);
}

// SSI + state supplement left after earnings.
export function ssiAfterEarnings(earn, P) {
  return Math.max(0, P.ssiFull - countableEarnings(earn, P));
}

// Earnings at which SSI reaches $0.
export function ssiBreakeven(P) {
  return P.ssiFull / P.countRate + P.genEx + P.earnEx;
}

// DDS 24-hr residential charge = 0.75 × benefits + 0.5 × max(0, earnings − 65)
export function ddsCharge(ssi, earn, P) {
  return P.ddsBen * ssi + P.ddsEarn * Math.max(0, earn - P.earnEx);
}

export const HOUSING = {
  voucher: "Voucher or public housing (30% of income)",
  dds: "DDS 24-hour residential",
  market: "Market-rate apartment",
  family: "With family, paying a set share",
};

// inputs: { onSSI, hours, wage, housing, rent, afcLevel (0|1|2), years }
export function estimate(inputs, P) {
  const { onSSI, hours, wage, housing, rent = 0, afcLevel = 0 } = inputs;
  const years = Math.max(1, Math.round(inputs.years || 1));
  const earn = monthlyEarnings(hours, wage);
  const ssi = onSSI ? ssiAfterEarnings(earn, P) : 0;
  const income = earn + ssi;

  let housingCost, housingLabel;
  if (housing === "voucher") { housingCost = P.rentShare * income; housingLabel = `Rent share (${Math.round(P.rentShare * 100)}% of income)`; }
  else if (housing === "dds") { housingCost = ddsCharge(ssi, earn, P); housingLabel = "DDS residential charge"; }
  else { housingCost = Math.max(0, rent); housingLabel = housing === "market" ? "Market rent" : "Share paid to family"; }

  const left = income - housingCost;
  const afcDaily = afcLevel === 1 ? P.afc1 : afcLevel === 2 ? P.afc2 : 0;
  const afcMonthly = afcDaily * 365 / 12;
  const ssiLoss = onSSI ? P.ssiFull - ssi : 0;

  const flags = [];
  const warn = text => flags.push({ warn: true, text });
  const info = text => flags.push({ warn: false, text });
  if (hours > 0 && wage < P.minWage) warn(`Wage is below the ${P.state} minimum wage of $${P.minWage}/hr.`);
  if (onSSI && earn > 0 && ssi > 0) info(`Working ${hours} hrs/week lowers SSI by ${usd(ssiLoss)}/mo, but total income rises by ${usd(earn - ssiLoss)}/mo.`);
  if (onSSI && ssi === 0) warn(`Earnings are past the SSI breakeven (about ${usd(ssiBreakeven(P))}/mo). SSI stops, but ${P.medicaid} can continue under 1619(b)${P.b1619 ? ` up to ${usd(P.b1619)}/yr` : ""}.`);
  if (P.twp && earn > P.twp) info(`Earnings over $${P.twp}/mo count as an SSDI Trial Work month (only matters if on SSDI).`);
  if (P.sga && earn > P.sga) warn(`Earnings are over the $${P.sga}/mo SGA limit. SSDI could stop after the trial period.`);
  if (P.b1619 && earn * 12 > P.b1619) warn(`Yearly earnings are above the 1619(b) threshold.${P.buyIn ? ` Look at ${P.buyIn}.` : ""}`);
  if (housing === "market" && left < 0) warn("Rent is more than income. A voucher (such as Section 8) or family support would be needed.");
  if (housing === "voucher") info("Assumes a voucher is already in hand. Waits are typically 5–12 years.");

  return {
    earn, ssi, income, housingCost, housingLabel, left, afcMonthly, years, flags,
    totals: { housing: housingCost * 12 * years, left: left * 12 * years, afc: afcMonthly * 12 * years },
  };
}

export function usd(n) {
  return (n < 0 ? "−" : "") + "$" + Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
}
