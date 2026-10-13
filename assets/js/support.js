// Who pays: government vs nonprofit support, put on the same monthly basis and compared side by side.
// Amounts come from planner-parameters.json; this file only says which items exist and when they likely apply.

import { monthlyEarnings, ssiAfterEarnings, ddsCharge } from "./planner.js";

export const SOURCES = ["Government", "Nonprofit"];

// to: "person" (adds to what the person has each month) or "family" (paid to the caregiver household).
// resource: the matching directory entry without its state prefix (e.g. "ct-" + "fin-...").
// when(ctx): whether to tick it by default. ctx = { age, benefit, housing }.
export const SUPPORT_ITEMS = [
  { id: "ma_child_family_credit", source: "Government", to: "family", per: "year",
    param: ["financing", "ma_child_family_credit_per_dependent"], resource: "fin-ma-child-and-family-tax-credit",
    name: "MA Child and Family Tax Credit", note: "Refundable. They must live with you more than half the year.",
    when: c => c.housing === "family" },
  { id: "federal_odc", source: "Government", to: "family", per: "year",
    param: ["financing", "federal_credit_other_dependents"], resource: "fin-federal-credit-for-other-dependents",
    name: "Federal Credit for Other Dependents", note: "Nonrefundable: only lowers tax you already owe.",
    when: c => c.housing === "family" },
  { id: "lifeline", source: "Government", to: "person", per: "month",
    param: ["financing", "lifeline_monthly_discount"], resource: "fin-lifeline-phone-internet-discount",
    name: "Lifeline phone/internet discount", note: "Anyone on SSI or SNAP qualifies.",
    when: c => c.benefit === "ssi" },
  { id: "heap", source: "Government", to: "person", per: "year",
    param: ["financing", "heap_max_2025_26"], field: "utility", resource: "fin-home-energy-assistance-heap",
    name: "Fuel assistance (HEAP), gas/electric maximum", note: "A maximum, not a typical amount. Depends on income and fuel type.",
    when: () => false },
  { id: "kodi_lee", source: "Nonprofit", to: "person", per: "once",
    param: ["nonprofit", "kodi_lee_music_grant_max"], resource: "fin-flutie-kodi-lee-gives-back-grant",
    name: "Kodi Lee Gives Back music grant (maximum)", note: "Music lessons, therapy or equipment. Ages 15+, once only.",
    when: c => c.age != null && c.age >= 15 },
  { id: "act_today", source: "Nonprofit", to: "family", per: "once",
    param: ["nonprofit", "act_today_grant_max"], resource: "fin-act-today-family-grants",
    name: "ACT Today! family grant (maximum)", note: "Paid straight to the provider or vendor. Household income is considered.",
    when: () => false },
  { id: "autism_alliance", source: "Nonprofit", to: "family", per: "once",
    param: ["nonprofit", "autism_alliance_family_grant_max"], resource: "fin-autism-alliance-flutie-family-grant",
    name: "Autism Alliance family grant (maximum)", note: "Aimed at MetroWest families of a child; check it fits.",
    when: () => false },
];

// Amount for an item from the parameters file, or null if it isn't there.
export function itemAmount(item, params) {
  const p = item.param.reduce((o, k) => o?.[k], params);
  if (!p) return null;
  const v = item.field ? p[item.field] : p.value;
  return typeof v === "number" ? v : null;
}

// Normalize to a monthly amount. One-time money is spread over the years being planned.
export function perMonth(amount, per, years) {
  if (!amount) return 0;
  if (per === "month") return amount;
  if (per === "year") return amount / 12;
  if (per === "once") return amount / (Math.max(1, years) * 12);
  throw new Error(`unknown period ${per}`);
}

// EAEDC after earnings. The source says the first $200 of job income isn't counted and income must be below
// the grant; we assume each counted dollar lowers the grant by a dollar (not stated by the source).
export function eaedcAfterEarnings(earn, grant, deduction) {
  return Math.max(0, grant - Math.max(0, earn - deduction));
}

// ---------- Inflation ----------
export const INFLATION_CHOICES = {
  fed: "Federal Reserve projections",
  cpi: "Recent inflation (CPI)",
  four: "Cautious: 4% a year",
  none: "No inflation (today's prices)",
  custom: "Custom rate",
};

// Yearly inflation rates for a plan of `years` years starting in `startYear`.
// rates[0] is 0 because year 1 uses this year's figures; rates[t] is the rise from year t-1 to year t.
export function inflationPath(choice, econ, startYear, years, custom = 0) {
  const inf = econ?.inflation || {};
  const rateFor = y => {
    if (choice === "fed") { const f = inf.fed_sep_pce_median; return f ? (f.by_year?.[y] ?? f.longer_run) : 0; }
    if (choice === "cpi") return inf.cpi_u_12_month?.value ?? 0;
    if (choice === "four") return 0.04;
    if (choice === "custom") return Math.max(0, custom);
    return 0;
  };
  return Array.from({ length: Math.max(1, years) }, (_, t) => (t === 0 ? 0 : rateFor(startYear + t)));
}
// Price level for each plan year relative to year 1.
export const priceFactors = rates => rates.reduce((acc, r, i) => [...acc, i === 0 ? 1 : acc[i - 1] * (1 + r)], []);

/**
 * Compare government only / nonprofit only / both, year by year.
 * inputs: { benefit: "ssi"|"eaedc"|"none", hours, wage, housing, rent, afcLevel, years }
 *   rent = market rent (or the family share), used whenever there is no housing subsidy.
 * supports: [{ source, to, per, amount }]  (ticked items plus anything the family typed in)
 * opts.rates: yearly inflation from inflationPath(); rent rises with it every year.
 * opts.benefitsRise: SSI/EAEDC rise with inflation too (Social Security's yearly COLA). Earnings,
 *   tax credits, grants and Adult Foster Care rates stay at today's amounts.
 * Top-level numbers are year 1; overYears adds up every year; yearly lists each year.
 */
export function compareScenarios(inputs, P, params, supports = [], { rates = null, benefitsRise = true, startYear = params.year } = {}) {
  const years = Math.max(1, Math.round(inputs.years || 1));
  const F = priceFactors(rates && rates.length >= years ? rates.slice(0, years) : Array(years).fill(0));
  const earn = monthlyEarnings(inputs.hours, inputs.wage);
  const rent = Math.max(0, inputs.rent || 0);
  const fin = params.financing || {};

  function run(useGov, useNonprofit, costF, benF) {
    let benefit = 0;
    if (useGov && inputs.benefit === "ssi") benefit = ssiAfterEarnings(earn, { ...P, ssiFull: P.ssiFull * benF });
    if (useGov && inputs.benefit === "eaedc" && fin.eaedc_grant_1_person)
      benefit = eaedcAfterEarnings(earn, fin.eaedc_grant_1_person.value * benF, fin.eaedc_earned_income_deduction?.value ?? 0);
    const income = earn + benefit;

    // Housing: subsidies only exist with government help; otherwise the family pays the market rent.
    const marketRent = rent * costF;
    let housingCost = marketRent, housingHelp = 0;
    if (useGov && inputs.housing === "voucher") {
      housingCost = P.rentShare * income;
      housingHelp = marketRent ? Math.max(0, marketRent - housingCost) : 0;
    } else if (useGov && inputs.housing === "dds") {
      housingCost = ddsCharge(benefit, earn, P);
    }

    const pick = src => supports.filter(s => s.source === src && (src === "Government" ? useGov : useNonprofit));
    const sum = (list, to) => list.filter(s => s.to === to).reduce((a, s) => a + perMonth(s.amount, s.per, years), 0);
    const gov = pick("Government"), np = pick("Nonprofit");
    const afcDaily = inputs.afcLevel === 1 ? P.afc1 : inputs.afcLevel === 2 ? P.afc2 : 0;
    const caregiverPay = useGov ? afcDaily * 365 / 12 : 0;

    const govPerson = sum(gov, "person"), npPerson = sum(np, "person");
    const govFamily = sum(gov, "family") + caregiverPay, npFamily = sum(np, "family");
    const left = income + govPerson + npPerson - housingCost;
    const govTotal = benefit + housingHelp + govPerson + govFamily;
    const npTotal = npPerson + npFamily;
    return {
      earn, benefit, income, housingCost, housingHelp, caregiverPay,
      govPerson, npPerson, govFamily, npFamily, left, familyExtra: govFamily + npFamily,
      supportTotal: govTotal + npTotal, govTotal, npTotal,
      govShare: govTotal + npTotal ? govTotal / (govTotal + npTotal) : 0,
    };
  }
  function scenario(useGov, useNonprofit) {
    const yearly = F.map((f, t) => ({ year: startYear + t, ...run(useGov, useNonprofit, f, benefitsRise ? f : 1) }));
    const add = k => yearly.reduce((a, y) => a + y[k] * 12, 0);
    return { ...yearly[0], yearly, overYears: { left: add("left"), support: add("supportTotal"), housing: add("housingCost") } };
  }
  return { years, factors: F, government: scenario(true, false), nonprofit: scenario(false, true), both: scenario(true, true) };
}

// ---------- Application windows ----------
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
// "2026-10-15" -> local date; "2027-04" -> first of that month (month precision).
function parseDay(s) {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(s || "");
  return m ? { date: new Date(+m[1], +m[2] - 1, m[3] ? +m[3] : 1), exact: !!m[3] } : null;
}
const label = ({ date, exact }) => exact ? `${MONTHS[date.getMonth()].slice(0, 3)} ${date.getDate()}, ${date.getFullYear()}` : `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;

// Whether applications are open today. Returns { state: "open"|"closed"|"upcoming"|"rolling"|"", text }.
export function applyStatus(r, today = new Date()) {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const opens = parseDay(r.apply_opens), closes = parseDay(r.apply_closes);
  if (opens && closes && closes.date < opens.date) {
    // Last round closed, next one announced.
    return t >= opens.date ? { state: "open", text: `Open since ${label(opens)}` } : { state: "upcoming", text: `Reopens ${label(opens)}` };
  }
  if (opens && t < opens.date) return { state: "upcoming", text: `Opens ${label(opens)}` };
  if (closes && t > closes.date) return { state: "closed", text: `Closed ${label(closes)}` };
  if (closes) {
    const days = Math.round((closes.date - t) / 864e5);
    return { state: "open", text: `Open now · closes ${label(closes)}${days <= 14 ? ` (${days === 0 ? "today" : days === 1 ? "1 day left" : `${days} days left`})` : ""}` };
  }
  if (/year-round/i.test(r.apply_window || "")) return { state: "rolling", text: "Apply any time" };
  return r.apply_window ? { state: "", text: r.apply_window } : { state: "", text: "" };
}

// Deadlines worth showing on the home page: windows closing soon, and windows opening soon.
// Returns [{ r, kind: "closes"|"opens", date, exact, days }], soonest first.
export function upcomingDeadlines(rows, today = new Date(), { closeWithin = 45, openWithin = 60 } = {}) {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysTo = d => Math.round((d - t) / 864e5);
  const out = [];
  for (const r of rows) {
    const opens = parseDay(r.apply_opens), closes = parseDay(r.apply_closes);
    const st = applyStatus(r, today).state;
    const reopening = opens && closes && closes.date < opens.date;
    if (st === "open" && closes && !reopening && daysTo(closes.date) >= 0 && daysTo(closes.date) <= closeWithin)
      out.push({ r, kind: "closes", date: closes.date, exact: closes.exact, days: daysTo(closes.date) });
    else if (st === "upcoming" && opens && daysTo(opens.date) <= openWithin)
      out.push({ r, kind: "opens", date: opens.date, exact: opens.exact, days: daysTo(opens.date) });
  }
  return out.sort((a, b) => a.days - b.days);
}
