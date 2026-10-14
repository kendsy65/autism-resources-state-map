// Connecticut and New York: data checks plus the planner, region and nearby logic that differ by state.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fromParams, estimate } from "../assets/js/planner.js";
import { lookupZip, placeIndex, regionForHome, miles } from "../assets/js/geo.js";
import { nextSteps } from "../assets/js/profile.js";
import { upcomingDeadlines } from "../assets/js/support.js";

const read = p => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const us = read("../data/US/economic-parameters.json");
const S = Object.fromEntries(["CT", "NY", "MA"].map(c => [c, {
  res: read(`../data/${c}/resources.json`),
  params: read(`../data/${c}/planner-parameters.json`),
  zips: read(`../data/${c}/zips.json`),
  aliases: (() => { try { return read(`../data/${c}/place-aliases.json`); } catch { return {}; } })(),
}]));
const allZips = Object.fromEntries(Object.entries(S).map(([c, s]) => [c, s.zips]));
const at = c => placeIndex(S[c].zips, S[c].aliases);
const TODAY = new Date(2026, 9, 13);

for (const c of ["CT", "NY"]) {
  test(`${c}: resources follow the schema`, () => {
    const { res } = S[c];
    assert.ok(res.length > 70);
    assert.equal(new Set(res.map(r => r.id)).size, res.length);
    const fields = Object.keys(S.MA.res[0]);
    for (const r of res) {
      assert.deepEqual(Object.keys(r), fields, r.id);
      assert.equal(r.state, c);
      assert.match(r.source_url, /^https?:\/\//, r.id);
      assert.ok(["Housing", "Financing", "Employment", "Employers", "Caregiver Support"].includes(r.category), r.id);
      assert.ok(["Federal", "State", "City", "Private/Nonprofit"].includes(r.level), r.id);
    }
    assert.ok(!res.some(r => r.category === "Employment" && r.subtype === "Employer"));
  });

  test(`${c}: every program city can be placed on the map`, () => {
    const coords = at(c);
    const missing = [...new Set(S[c].res.filter(r => r.city).map(r => r.city))].filter(city => !coords(city));
    assert.deepEqual(missing, []);
  });

  test(`${c}: timing items are tagged for the plan and the Timing tab`, () => {
    const ids = new Set();
    for (const t of S[c].params.timing) {
      assert.ok(t.id && !ids.has(t.id), t.item); ids.add(t.id);
      assert.ok(["Housing", "Employment", "Both"].includes(t.focus), t.item);
      assert.match(t.source, /^https?:\/\//, t.item);
    }
  });
}

test("CT planner: federal SSI (CT's supplement is needs-based), CT minimum wage and 1619(b)", () => {
  const P = fromParams(S.CT.params, us);
  assert.equal(P.ssiFull, 994);
  assert.equal(P.ssiLabel, "Federal SSI");
  assert.match(P.ssiNote, /No flat CT supplement/);
  assert.equal(P.minWage, 16.94);
  assert.equal(P.b1619, 55480);
  assert.equal(P.twp, 1210); // from the federal file
  assert.equal(P.countRate, 0.5);
  assert.equal(P.ddsBen, undefined); // no published residential charge
  assert.equal(P.afc1, undefined);
  assert.match(P.buyIn, /Med-Connect/);
});

test("NY planner: SSI + state supplement, minimum wage depends on the ZIP", () => {
  const nyc = fromParams(S.NY.params, us, lookupZip("11201", allZips)); // Brooklyn
  const roc = fromParams(S.NY.params, us, lookupZip("14604", allZips)); // Rochester
  assert.equal(nyc.ssiFull, 1081);
  assert.equal(nyc.ssiLabel, "SSI + state supplement");
  assert.equal(nyc.minWage, 17);
  assert.equal(roc.minWage, 16);
  assert.equal(fromParams(S.NY.params, us).minWage, 16); // no ZIP: the rest-of-state rate, with a note
  assert.match(fromParams(S.NY.params, us).minWageNote, /\$17/);
  assert.equal(nyc.b1619, 68654);
  assert.equal(nyc.sga, 1690);
});

test("estimator flags use each state's program names", () => {
  const P = fromParams(S.NY.params, us);
  const r = estimate({ onSSI: true, hours: 40, wage: 40, housing: "voucher", years: 1 }, P);
  assert.ok(r.flags.some(f => /Medicaid can continue under 1619\(b\)/.test(f.text)));
  assert.ok(r.flags.some(f => /Medicaid Buy-In for Working People/.test(f.text)));
  assert.ok(!r.flags.some(f => /MassHealth/.test(f.text)));
});

test("MA planner numbers are unchanged", () => {
  const P = fromParams(S.MA.params, us);
  assert.equal(P.ssiFull, 1122.82);
  assert.equal(P.minWage, 15);
  assert.equal(P.ddsBen, 0.75);
  assert.equal(P.medicaid, "MassHealth");
});

test("regions: county lists (CT, NY) and town lists (MA)", () => {
  const region = (c, zip) => regionForHome(lookupZip(zip, allZips), S[c].params.regions, S[c].res, at(c));
  assert.equal(region("NY", "11201"), "New York City"); // Kings County
  assert.equal(region("NY", "14604"), "Western NY & Finger Lakes"); // Monroe County
  assert.equal(region("CT", "06830"), "Fairfield County"); // Greenwich
  assert.ok(region("CT", "06103")); // Hartford: ZIP file uses the new planning regions, falls back to nearest
  assert.equal(region("MA", "01060"), "West");
});

test("NYC-only timing items show near NYC, not in Rochester", () => {
  const prof = { zip: "", state: "NY", birthdate: "2004-05-01", support: "unsure", ssi: "ssi", focus: "Housing" };
  const near = home => city => { const c = at("NY")(city); return !c || miles(home, c) <= 25; };
  const items = zip => nextSteps(prof, S.NY.params.timing, [], TODAY, near(lookupZip(zip, allZips))).map(s => s.title);
  assert.ok(items("11201").includes("NYCHA Section 8 waitlist"));
  assert.ok(!items("14604").includes("NYCHA Section 8 waitlist"));
  assert.ok(items("14604").includes("Rochester Housing Authority public housing"));
});

test("Rochester's list closing Oct 26 reaches the deadlines board", () => {
  const rows = S.NY.params.timing.filter(t => t.apply_closes).map(t => ({ id: t.id, name: t.item, apply_closes: t.apply_closes }));
  const d = upcomingDeadlines(rows, TODAY);
  assert.equal(d.length, 1);
  assert.equal(d[0].days, 13);
});

test("caregiver support: every state has it, sources and towns check out, cross-listed programs count", () => {
  for (const c of ["CT", "MA", "NY"]) {
    const res = S[c].res;
    const own = res.filter(r => r.category === "Caregiver Support");
    const cross = res.filter(r => (r.also_categories || []).includes("Caregiver Support"));
    assert.ok(own.length >= 10, `${c} caregiver entries`);
    assert.ok(cross.length >= 2, `${c} cross-listed`);
    for (const r of own) assert.match(r.source_url, /^https?:\/\//, r.id);
    const coords = at(c);
    const missing = [...new Set(own.filter(r => r.city).map(r => r.city))].filter(city => !coords(city));
    assert.deepEqual(missing, [], `${c} towns`);
    assert.ok(!cross.some(r => r.category === "Caregiver Support"));
  }
});
