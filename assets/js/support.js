// Who pays: government vs nonprofit support, put on the same monthly basis and compared side by side.
// Amounts come from planner-parameters.json; this file only says which items exist and when they likely apply.

import { monthlyEarnings, ssiAfterEarnings, ddsCharge } from "./planner.js";

export const SOURCES = ["Government", "Nonprofit"];

// to: "person" (adds to what the person has each month) or "family" (paid to the caregiver household).
// when(ctx): whether to tick it by default. ctx = { age, benefit, housing }.
export const SUPPORT_ITEMS = [
  { id: "ma_child_family_credit", source: "Government", to: "family", per: "year",
    param: ["financing", "ma_child_family_credit_per_dependent"], resource: "ma-fin-ma-child-and-family-tax-credit",
    name: "MA Child and Family Tax Credit", note: "Refundable. They must live with you more than half the year.",
    when: c => c.housing === "family" },
  { id: "federal_odc", source: "Government", to: "family", per: "year",
    param: ["financing", "federal_credit_other_dependents"], resource: "ma-fin-federal-credit-for-other-dependents",
    name: "Federal Credit for Other Dependents", note: "Nonrefundable: only lowers tax you already owe.",
    when: c => c.housing === "family" },
  { id: "lifeline", source: "Government", to: "person", per: "month",
    param: ["financing", "lifeline_monthly_discount"], resource: "ma-fin-lifeline-phone-internet-discount",
    name: "Lifeline phone/internet discount", note: "Anyone on SSI or SNAP qualifies.",
    when: c => c.benefit === "ssi" },
  { id: "heap", source: "Government", to: "person", per: "year",
    param: ["financing", "heap_max_2025_26"], field: "utility", resource: "ma-fin-home-energy-assistance-heap",
    name: "Fuel assistance (HEAP), gas/electric maximum", note: "A maximum, not a typical amount. Depends on income and fuel type.",
    when: () => false },
  { id: "kodi_lee", source: "Nonprofit", to: "person", per: "once",
    param: ["nonprofit", "kodi_lee_music_grant_max"], resource: "ma-fin-flutie-kodi-lee-gives-back-grant",
    name: "Kodi Lee Gives Back music grant (maximum)", note: "Music lessons, therapy or equipment. Ages 15+, once only.",
    when: c => c.age != null && c.age >= 15 },
  { id: "autism_alliance", source: "Nonprofit", to: "family", per: "once",
    param: ["nonprofit", "autism_alliance_family_grant_max"], resource: "ma-fin-autism-alliance-flutie-family-grant",
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

/**
 * Compare government only / nonprofit only / both.
 * inputs: { benefit: "ssi"|"eaedc"|"none", hours, wage, housing, rent, afcLevel, years }
 *   rent = market rent (or the family share), used whenever there is no housing subsidy.
 * supports: [{ source, to, per, amount }]  (ticked items plus anything the family typed in)
 */
export function compareScenarios(inputs, P, params, supports = []) {
  const years = Math.max(1, Math.round(inputs.years || 1));
  const earn = monthlyEarnings(inputs.hours, inputs.wage);
  const rent = Math.max(0, inputs.rent || 0);
  const fin = params.financing || {};

  function run(useGov, useNonprofit) {
    let benefit = 0;
    if (useGov && inputs.benefit === "ssi") benefit = ssiAfterEarnings(earn, P);
    if (useGov && inputs.benefit === "eaedc" && fin.eaedc_grant_1_person)
      benefit = eaedcAfterEarnings(earn, fin.eaedc_grant_1_person.value, fin.eaedc_earned_income_deduction?.value ?? 0);
    const income = earn + benefit;

    // Housing: subsidies only exist with government help; otherwise the family pays the market rent.
    let housingCost = rent, housingHelp = 0;
    if (useGov && inputs.housing === "voucher") {
      housingCost = P.rentShare * income;
      housingHelp = rent ? Math.max(0, rent - housingCost) : 0;
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
      overYears: { left: left * 12 * years, support: (govTotal + npTotal) * 12 * years },
    };
  }
  return { years, government: run(true, false), nonprofit: run(false, true), both: run(true, true) };
}
