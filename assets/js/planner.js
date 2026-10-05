// Planner math. Pure functions so they can be unit-tested in Node and reused in the browser.
// All numbers come from data/<STATE>/planner-parameters.json — nothing is hard-coded here.

// Flatten the parameters file into the handful of numbers the estimator uses.
export function fromParams(p) {
  const i = p.income, h = p.housing, e = p.employment;
  return {
    state: p.state,
    year: p.year,
    ssiFull: i.ssi_plus_ssp_living_independently.value,
    genEx: i.ssi_general_income_exclusion.value,
    earnEx: i.ssi_earned_income_exclusion.value,
    countRate: i.ssi_earned_income_countable_rate.value,
    afc1: i.afc_caregiver_min_pay_level1.value,
    afc2: i.afc_caregiver_min_pay_level2.value,
    rentShare: h.section8_tenant_share.value,
    ddsBen: h.dds_residential_charge_benefits.value,
    ddsEarn: h.dds_residential_charge_earnings.value,
    minWage: e.ma_minimum_wage.value,
    sga: e.sga_non_blind.value,
    twp: e.trial_work_period_month.value,
    b1619: e.section_1619b_ma_threshold.value,
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
  if (onSSI && ssi === 0) warn(`Earnings are past the SSI breakeven (about ${usd(ssiBreakeven(P))}/mo). SSI stops, but MassHealth can continue under 1619(b) up to ${usd(P.b1619)}/yr.`);
  if (earn > P.twp) info(`Earnings over $${P.twp}/mo count as an SSDI Trial Work month (only matters if on SSDI).`);
  if (earn > P.sga) warn(`Earnings are over the $${P.sga}/mo SGA limit. SSDI could stop after the trial period.`);
  if (earn * 12 > P.b1619) warn("Yearly earnings are above the 1619(b) threshold. Look at MassHealth CommonHealth.");
  if (housing === "market" && left < 0) warn("Rent is more than income. A voucher (AHVP, Section 8) or family support would be needed.");
  if (housing === "voucher") info("Assumes a voucher is already in hand. Waits are typically 5–12 years.");

  return {
    earn, ssi, income, housingCost, housingLabel, left, afcMonthly, years, flags,
    totals: { housing: housingCost * 12 * years, left: left * 12 * years, afc: afcMonthly * 12 * years },
  };
}

export function usd(n) {
  return (n < 0 ? "−" : "") + "$" + Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
}
