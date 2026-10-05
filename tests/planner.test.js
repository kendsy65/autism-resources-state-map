// Run with: npm test   (or: node --test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as pl from "../assets/js/planner.js";

const params = JSON.parse(readFileSync(new URL("../data/MA/planner-parameters.json", import.meta.url)));
const P = pl.fromParams(params);
const close = (a, b) => assert.ok(Math.abs(a - b) < 0.01, `${a} ≈ ${b}`);

test("reads MA 2026 numbers from the parameters file", () => {
  assert.equal(P.ssiFull, 1122.82);
  assert.equal(P.genEx, 20);
  assert.equal(P.earnEx, 65);
  assert.equal(P.minWage, 15);
});

test("monthly earnings = hours × wage × 52 / 12", () => {
  close(pl.monthlyEarnings(15, 15), 975);
  assert.equal(pl.monthlyEarnings(0, 20), 0);
  assert.equal(pl.monthlyEarnings(-5, 20), 0);
});

test("first $85 of earnings does not reduce SSI", () => {
  assert.equal(pl.ssiAfterEarnings(0, P), 1122.82);
  assert.equal(pl.ssiAfterEarnings(85, P), 1122.82);
});

test("after $85, SSI drops $1 for every $2 earned", () => {
  close(pl.ssiAfterEarnings(975, P), 1122.82 - (975 - 85) / 2); // 677.82
});

test("SSI breakeven is about $2,330.64/mo and SSI never goes negative", () => {
  close(pl.ssiBreakeven(P), 2330.64);
  close(pl.ssiAfterEarnings(2330.64, P), 0);
  assert.equal(pl.ssiAfterEarnings(5000, P), 0);
});

test("DDS charge = 75% of benefits + 50% of earnings over $65", () => {
  close(pl.ddsCharge(1122.82, 0, P), 842.115);
  close(pl.ddsCharge(677.82, 975, P), 0.75 * 677.82 + 0.5 * 910);
});

test("voucher rent is 30% of total income", () => {
  const r = pl.estimate({ onSSI: true, hours: 15, wage: 15, housing: "voucher", years: 5 }, P);
  close(r.income, 975 + 677.82);
  close(r.housingCost, 0.3 * r.income);
  close(r.totals.housing, r.housingCost * 60);
});

test("market rent above income raises a warning", () => {
  const r = pl.estimate({ onSSI: true, hours: 0, wage: 15, housing: "market", rent: 1800, years: 1 }, P);
  assert.ok(r.left < 0);
  assert.ok(r.flags.some(f => f.warn && /Rent is more than income/.test(f.text)));
});

test("flags wage below minimum and earnings over SGA", () => {
  const low = pl.estimate({ onSSI: true, hours: 10, wage: 12, housing: "voucher", years: 1 }, P);
  assert.ok(low.flags.some(f => /minimum wage/.test(f.text)));
  const high = pl.estimate({ onSSI: true, hours: 40, wage: 20, housing: "voucher", years: 1 }, P);
  assert.equal(high.ssi, 0);
  assert.ok(high.flags.some(f => /SGA/.test(f.text)));
});

test("Adult Foster Care pay uses the daily minimums", () => {
  const r = pl.estimate({ onSSI: false, hours: 0, wage: 0, housing: "family", rent: 0, afcLevel: 2, years: 2 }, P);
  close(r.afcMonthly, 49 * 365 / 12);
  close(r.totals.afc, 49 * 365 * 2);
});
