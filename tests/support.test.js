import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fromParams } from "../assets/js/planner.js";
import { SUPPORT_ITEMS, itemAmount, perMonth, eaedcAfterEarnings, compareScenarios, applyStatus, inflationPath, priceFactors, upcomingDeadlines } from "../assets/js/support.js";

const econ = JSON.parse(readFileSync(new URL("../data/US/economic-parameters.json", import.meta.url)));
const params = JSON.parse(readFileSync(new URL("../data/MA/planner-parameters.json", import.meta.url)));
const resources = JSON.parse(readFileSync(new URL("../data/MA/resources.json", import.meta.url)));
const P = fromParams(params);
const close = (a, b) => assert.ok(Math.abs(a - b) < 0.01, `${a} ≈ ${b}`);
const base = { benefit: "ssi", hours: 0, wage: 15, housing: "voucher", rent: 1800, afcLevel: 0, years: 5 };

test("every support item has an amount in the data and a matching resource", () => {
  for (const it of SUPPORT_ITEMS) {
    assert.ok(typeof itemAmount(it, params) === "number", `${it.id} amount`);
    assert.ok(resources.some(r => r.id === `ma-${it.resource}`), `${it.id} resource`);
  }
});

test("normalizes monthly, yearly and one-time amounts to per month", () => {
  assert.equal(perMonth(9.25, "month", 5), 9.25);
  close(perMonth(440, "year", 5), 36.67);
  close(perMonth(1000, "once", 5), 1000 / 60);
  close(perMonth(1000, "once", 1), 1000 / 12);
  assert.equal(perMonth(0, "year", 5), 0);
});

test("EAEDC: first $200 of earnings ignored", () => {
  assert.equal(eaedcAfterEarnings(0, 441.1, 200), 441.1);
  assert.equal(eaedcAfterEarnings(200, 441.1, 200), 441.1);
  close(eaedcAfterEarnings(400, 441.1, 200), 241.1);
  assert.equal(eaedcAfterEarnings(2000, 441.1, 200), 0);
});

test("government only: SSI plus voucher; nonprofit money not counted", () => {
  const np = [{ source: "Nonprofit", to: "person", per: "once", amount: 1000 }];
  const r = compareScenarios(base, P, params, np).government;
  close(r.benefit, 1122.82);
  close(r.housingCost, 0.3 * 1122.82);
  close(r.housingHelp, 1800 - 0.3 * 1122.82);
  assert.equal(r.npTotal, 0);
  assert.equal(r.govShare, 1);
});

test("nonprofit only: no SSI and full market rent", () => {
  const np = [{ source: "Nonprofit", to: "person", per: "once", amount: 1000 }];
  const r = compareScenarios(base, P, params, np).nonprofit;
  assert.equal(r.benefit, 0);
  assert.equal(r.housingCost, 1800);
  close(r.npPerson, 1000 / 60);
  close(r.left, 1000 / 60 - 1800);
  assert.equal(r.govShare, 0);
});

test("both = government + nonprofit, and shares add to 100%", () => {
  const sup = [
    { source: "Government", to: "family", per: "year", amount: 440 },
    { source: "Nonprofit", to: "person", per: "once", amount: 1000 },
  ];
  const s = compareScenarios(base, P, params, sup);
  close(s.both.supportTotal, s.government.supportTotal + s.nonprofit.supportTotal);
  close(s.both.left, s.government.left + s.nonprofit.npPerson);
  close(s.both.govShare + s.both.npTotal / s.both.supportTotal, 1);
  close(s.both.overYears.support, s.both.supportTotal * 60);
});

test("Adult Foster Care pay and DDS housing are government-only", () => {
  const s = compareScenarios({ ...base, housing: "dds", afcLevel: 1 }, P, params, []);
  close(s.government.caregiverPay, 25 * 365 / 12);
  close(s.government.housingCost, 0.75 * 1122.82);
  assert.equal(s.nonprofit.caregiverPay, 0);
  assert.equal(s.nonprofit.housingCost, 1800);
});

test("application windows: open, closing soon, reopening, year-round", () => {
  const OCT5 = new Date(2026, 9, 5);
  const act = resources.find(r => r.id === "ma-fin-act-today-family-grants");
  assert.deepEqual(applyStatus(act, OCT5), { state: "open", text: "Open now · closes Oct 15, 2026 (10 days left)" });
  assert.equal(applyStatus(act, new Date(2026, 9, 16)).state, "closed");
  assert.equal(applyStatus(act, new Date(2026, 8, 1)).state, "upcoming");
  const kodi = resources.find(r => r.id === "ma-fin-flutie-kodi-lee-gives-back-grant");
  assert.deepEqual(applyStatus(kodi, OCT5), { state: "upcoming", text: "Reopens April 2027" });
  assert.equal(applyStatus(kodi, new Date(2027, 3, 2)).state, "open");
  const loans = resources.find(r => r.id === "ma-fin-ma-alternative-finance-program");
  assert.equal(applyStatus(loans, OCT5).state, "rolling");
});

test("every nonprofit money program has application steps from a source", () => {
  const np = resources.filter(r => r.category === "Financing" && r.level === "Private/Nonprofit");
  assert.ok(np.length >= 6);
  for (const r of np) {
    assert.ok(r.apply_steps.length >= 3, r.id);
    assert.match(r.apply_source, /^https:\/\//, r.id);
  }
});

test("inflation paths: Fed projections by year, then the long-run rate", () => {
  assert.deepEqual(inflationPath("fed", econ, 2026, 6), [0, 0.023, 0.021, 0.02, 0.02, 0.02]);
  assert.deepEqual(inflationPath("cpi", econ, 2026, 3), [0, 0.034, 0.034]);
  assert.deepEqual(inflationPath("four", econ, 2026, 3), [0, 0.04, 0.04]);
  assert.deepEqual(inflationPath("none", econ, 2026, 3), [0, 0, 0]);
  assert.deepEqual(inflationPath("custom", econ, 2026, 2, 0.05), [0, 0.05]);
  const f = priceFactors([0, 0.04, 0.04]);
  close(f[2], 1.0816);
});

test("no inflation gives the same answer as before; totals add up year by year", () => {
  const flat = compareScenarios(base, P, params, []);
  close(flat.both.overYears.support, flat.both.supportTotal * 60);
  close(flat.nonprofit.overYears.housing, 1800 * 60);
});

test("with inflation: rent rises; SSI rises only if benefits keep up", () => {
  const rates = inflationPath("four", econ, 2026, 3);
  const up = compareScenarios({ ...base, years: 3 }, P, params, [], { rates });
  close(up.nonprofit.yearly[2].housingCost, 1800 * 1.0816);
  close(up.government.yearly[2].benefit, 1122.82 * 1.0816);
  close(up.nonprofit.overYears.housing, 1800 * 12 * (1 + 1.04 + 1.0816));
  const flatBen = compareScenarios({ ...base, years: 3 }, P, params, [], { rates, benefitsRise: false });
  close(flatBen.government.yearly[2].benefit, 1122.82);
  assert.ok(flatBen.government.yearly[2].housingHelp > up.government.yearly[0].housingHelp); // voucher covers more as rent rises
  assert.equal(up.both.yearly[2].year, 2028);
});

test("upcoming deadlines: closing soon first, opening soon later, past ones dropped", () => {
  const ids = d => upcomingDeadlines(resources, d).map(x => `${x.r.id}:${x.kind}:${x.days}`);
  assert.deepEqual(ids(new Date(2026, 9, 13)), ["ma-fin-act-today-family-grants:closes:2"]);
  assert.deepEqual(ids(new Date(2026, 9, 16)), []); // ACT closed, Kodi Lee still months away
  assert.deepEqual(ids(new Date(2027, 2, 15)), ["ma-fin-flutie-kodi-lee-gives-back-grant:opens:17"]);
});
