import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fromParams } from "../assets/js/planner.js";
import { SUPPORT_ITEMS, itemAmount, perMonth, eaedcAfterEarnings, compareScenarios } from "../assets/js/support.js";

const params = JSON.parse(readFileSync(new URL("../data/MA/planner-parameters.json", import.meta.url)));
const resources = JSON.parse(readFileSync(new URL("../data/MA/resources.json", import.meta.url)));
const P = fromParams(params);
const close = (a, b) => assert.ok(Math.abs(a - b) < 0.01, `${a} ≈ ${b}`);
const base = { benefit: "ssi", hours: 0, wage: 15, housing: "voucher", rent: 1800, afcLevel: 0, years: 5 };

test("every support item has an amount in the data and a matching resource", () => {
  for (const it of SUPPORT_ITEMS) {
    assert.ok(typeof itemAmount(it, params) === "number", `${it.id} amount`);
    assert.ok(resources.some(r => r.id === it.resource), `${it.id} resource`);
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
