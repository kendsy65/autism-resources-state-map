import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fromParams } from "../assets/js/planner.js";
import { lookupZip, placeIndex, miles, nearestRegion } from "../assets/js/geo.js";
import {
  validProfile, nextSteps, workScenarios, ageOn, dateTurning, validBirthdate, supportFit, rankResources,
} from "../assets/js/profile.js";

const read = p => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const params = read("../data/MA/planner-parameters.json");
const federal = read("../data/US/resources.json");
const maRes = read("../data/MA/resources.json");
const zips = { MA: read("../data/MA/zips.json"), CT: read("../data/CT/zips.json"), NY: read("../data/NY/zips.json") };
const P = fromParams(params);
const TODAY = new Date(2026, 9, 5); // Oct 5, 2026
const born = age => `${2026 - age}-03-04`; // birthday already passed this year
const prof = o => ({ zip: "01060", state: "MA", birthdate: born(19), support: "unsure", ssi: "ssi", focus: "Both", ...o });
const steps = p => nextSteps(p, params.timing, federal, TODAY);
const titles = p => steps(p).map(s => s.title);

// ---------- dates ----------
test("age from birthdate counts whether the birthday has happened yet", () => {
  assert.equal(ageOn("2007-10-05", TODAY), 19); // birthday today
  assert.equal(ageOn("2007-10-06", TODAY), 18); // tomorrow
  assert.equal(ageOn("2008-02-29", new Date(2026, 1, 28)), 17); // leap-day birthday, not yet
  assert.equal(ageOn("2008-02-29", new Date(2026, 2, 1)), 18);
});

test("rejects impossible or future birthdates", () => {
  assert.equal(validBirthdate("2007-02-30", TODAY), false);
  assert.equal(validBirthdate("2027-01-01", TODAY), false);
  assert.equal(validBirthdate("1850-01-01", TODAY), false);
  assert.equal(validBirthdate("2007-13-01", TODAY), false);
  assert.equal(validBirthdate("2007-06-15", TODAY), true);
});

test("date they turn N", () => {
  assert.equal(dateTurning("2011-03-04", 18).toDateString(), new Date(2029, 2, 4).toDateString());
});

// ---------- profile ----------
test("rejects incomplete or odd profiles", () => {
  assert.equal(validProfile(null), null);
  assert.equal(validProfile({ ...prof(), zip: "1060" }, TODAY), null);
  assert.equal(validProfile({ ...prof(), support: "4" }, TODAY), null);
  assert.equal(validProfile({ state: "MA", age: 19, ssi: "ssi", focus: "Both" }, TODAY), null); // old saved format
  assert.deepEqual(validProfile(prof(), TODAY), prof());
});

// ---------- ZIP ----------
test("ZIP lookup finds town, county and state", () => {
  const z = lookupZip("01060", zips);
  assert.equal(z.state, "MA");
  assert.equal(z.place, "Northampton");
  assert.equal(z.county, "Hampshire");
  assert.equal(lookupZip("06103", zips).state, "CT");
  assert.equal(lookupZip("10001", zips).state, "NY");
  assert.equal(lookupZip("90210", zips), null);
});

test("distances are sensible (Boston to Springfield ≈ 80 miles)", () => {
  const at = placeIndex(zips.MA);
  const d = miles(at("Boston"), at("Springfield"));
  assert.ok(d > 70 && d < 90, `${d}`);
});

test("region is the region of the nearest listed town", () => {
  const at = placeIndex(zips.MA);
  const region = zip => nearestRegion(lookupZip(zip, zips), params.regions, at);
  assert.equal(region("01060"), "West"); // Northampton
  assert.equal(region("02139"), "Greater Boston"); // Cambridge
  assert.equal(region("01608"), "Central"); // Worcester
  assert.equal(region("02301"), "Southeast"); // Brockton
  assert.equal(region("01852"), "Northeast"); // Lowell
});

// ---------- next steps ----------
test("not sure about SSI → points to the federal eligibility check first", () => {
  const s = steps(prof({ ssi: "unsure" }));
  assert.match(s[0].title, /could get SSI/);
  assert.match(s[0].source, /ssa\.gov\/prepare\/check-eligibility/);
});

test("housing-only focus hides employment steps", () => {
  const t = titles(prof({ focus: "Housing" }));
  assert.ok(t.includes("Section 8 voucher wait"));
  assert.ok(!t.some(x => /NextGen|Pre-Employment|benefits counseling/.test(x)));
});

test("age windows: past windows hidden, upcoming ones dated and in date order", () => {
  assert.ok(!titles(prof({ birthdate: born(25) })).includes("Pre-Employment Transition Services"));
  assert.ok(titles(prof({ birthdate: born(25) })).includes("NextGen Careers"));
  const teen = steps(prof({ birthdate: "2011-03-04" })); // 15
  assert.equal(teen.find(s => s.title.startsWith("Pre-Employment")).when, "now");
  const s8 = teen.find(s => s.title.startsWith("Section 8"));
  assert.equal(s8.when, "soon");
  assert.match(s8.detail, /turn 18 on March 4, 2029/);
  const soon = teen.filter(s => s.when === "soon").map(s => s.date.getTime());
  assert.deepEqual(soon, [...soon].sort((a, b) => a - b));
  assert.ok(!titles(prof({ birthdate: born(10) })).some(x => x.startsWith("Section 8"))); // > 4 years away
});

test("city-specific steps only show near home", () => {
  const at = placeIndex(zips.MA);
  const near = home => city => miles(lookupZip(home, zips), at(city)) <= 25;
  const t = home => nextSteps(prof({ focus: "Housing" }), params.timing, federal, TODAY, near(home)).map(s => s.title);
  assert.ok(t("02139").includes("Boston public housing wait")); // Cambridge
  assert.ok(!t("01060").includes("Boston public housing wait")); // Northampton
});

// ---------- support level ----------
test("support level: higher needs favor residential, supported employment and DDS", () => {
  const byId = id => maRes.find(r => r.id === id);
  assert.equal(supportFit(byId("ma-hou-amego-adult-residential"), "3"), 1);
  assert.equal(supportFit(byId("ma-emp-dds-employment-day-supports"), "2"), 1);
  assert.equal(supportFit(byId("ma-emp-newton-youthworks-internships"), "3"), -1); // source says not a fit
  assert.equal(supportFit(byId("ma-emp-newton-youthworks-internships"), "1"), 1);
  assert.equal(supportFit(byId("ma-hou-amego-adult-residential"), "unsure"), 0);
});

test("suggested order: good fits first, then nearest; statewide never dropped", () => {
  const at = placeIndex(zips.MA);
  const home = lookupZip("01060", zips);
  const ranked = rankResources(maRes, { support: "3", home }, at, "suggested");
  assert.equal(ranked.length, maRes.length);
  const fits = ranked.map(r => r.fit);
  assert.deepEqual(fits, [...fits].sort((a, b) => b - a));
  const nearest = rankResources(maRes, { support: "3", home }, at, "nearest");
  const local = nearest.filter(r => r.dist != null).map(r => r.dist);
  assert.deepEqual(local, [...local].sort((a, b) => a - b));
  assert.equal(nearest.at(-1).dist, null); // statewide after local
});

// ---------- work ----------
test("work scenarios: more hours always means more total income on SSI", () => {
  const rows = workScenarios(P, 15, true);
  assert.equal(rows[0].income, P.ssiFull);
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i].income > rows[i - 1].income);
  assert.equal(rows.at(-1).ssi, 0);
});
