// The caregiver's answers about their dependent, and what we suggest from them.
// Answers stay in this browser only (localStorage) — never in URLs, never sent anywhere.

import { ssiAfterEarnings, monthlyEarnings } from "./planner.js";
import { miles } from "./geo.js";

export const SSI_STATUS = {
  ssi: "Receives SSI",
  ssdi: "Receives SSDI (or SSI and SSDI)",
  applied: "Applied, waiting for a decision",
  none: "Doesn't receive SSI",
  unsure: "Not sure",
};
// Autism support levels as written in a diagnosis (DSM-5).
export const SUPPORT = {
  "1": { label: "Level 1", note: "Requiring support" },
  "2": { label: "Level 2", note: "Requiring substantial support" },
  "3": { label: "Level 3", note: "Requiring very substantial support" },
  unsure: { label: "Not sure", note: "" },
};
export const FOCUS = { Housing: "Housing", Employment: "Employment", Both: "Housing and employment" };
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const KEY = "dependent-profile";

export function loadProfile() {
  try { return validProfile(JSON.parse(localStorage.getItem(KEY) || "null")); } catch { return null; }
}
export function saveProfile(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {} }
export function clearProfile() { try { localStorage.removeItem(KEY); } catch {} }

// ---------- Dates (local calendar dates, no time zones) ----------

// "YYYY-MM-DD" -> {y, m (1-12), d} if it's a real date, else null.
export function parseDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
  if (!m) return null;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d ? { y, m: mo, d } : null;
}
export const toISO = (y, m, d) => `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const todayParts = (t = new Date()) => ({ y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() });

export function ageOn(birthdate, today = new Date()) {
  const b = parseDate(birthdate), t = todayParts(today);
  if (!b) return null;
  return t.y - b.y - (t.m < b.m || (t.m === b.m && t.d < b.d) ? 1 : 0);
}
// The date they turn `n`. Feb 29 birthdays count from Mar 1 in non-leap years.
export function dateTurning(birthdate, n) {
  const b = parseDate(birthdate);
  return b ? new Date(b.y + n, b.m - 1, b.d) : null;
}
export const fmtDate = dt => `${MONTHS[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`;

// Birthdate must be a real date, not in the future, and within 120 years.
export function validBirthdate(s, today = new Date()) {
  const a = ageOn(s, today);
  return a !== null && a >= 0 && a <= 120;
}

export function validProfile(p, today = new Date()) {
  if (!p || typeof p !== "object") return null;
  if (!/^\d{5}$/.test(p.zip || "") || !p.state || !validBirthdate(p.birthdate, today)) return null;
  if (!SUPPORT[p.support] || !SSI_STATUS[p.ssi] || !FOCUS[p.focus]) return null;
  return { zip: p.zip, state: String(p.state), birthdate: p.birthdate, support: p.support, ssi: p.ssi, focus: p.focus };
}

// ---------- Next steps ----------

const wants = (profile, focus) => profile.focus === "Both" || focus === "Both" || focus === profile.focus;

// How far ahead to show a step that isn't open yet.
export const LOOKAHEAD_YEARS = 4;
// City-specific steps show within this distance of home.
export const NEAR_MILES = 25;

// Steps from the state's timing list (planner-parameters.json) plus SSI steps (data/US/resources.json).
// Items with a `city` only show when isNear(city) says so (e.g. within 25 miles of home).
// Returns [{ when: "now" | "soon", title, detail, source, date? }], "now" first, "soon" by date.
export function nextSteps(profile, timing = [], federal = [], today = new Date(), isNear = () => true) {
  const age = ageOn(profile.birthdate, today);
  const steps = [];
  const fed = id => federal.find(r => r.id === id);
  const addFed = (id, title) => { const r = fed(id); if (r) steps.push({ when: "now", title, detail: r.description, source: r.source_url }); };

  if (profile.ssi === "unsure") addFed("us-ss-check-eligibility", "Find out if they could get SSI");
  if (profile.ssi === "none") addFed("us-ss-check-eligibility", "Check whether they could qualify for SSI");
  if (profile.ssi === "applied") addFed("us-ss-apply-for-ssi", "Check on the SSI application");
  if ((profile.ssi === "ssi" || profile.ssi === "ssdi") && wants(profile, "Employment") && age >= 18 && age <= 64)
    addFed("us-ss-ticket-to-work-help-line", "Get free benefits counseling before they start work");

  for (const t of timing) {
    if (!wants(profile, t.focus || "Both")) continue;
    if (t.city && !isNear(t.city)) continue;
    if (t.age_max != null && age > t.age_max) continue;
    const early = t.age_min != null && age < t.age_min;
    if (early && t.age_min - age > LOOKAHEAD_YEARS) continue;
    const date = early ? dateTurning(profile.birthdate, t.age_min) : null;
    steps.push({
      when: early ? "soon" : "now",
      title: t.item,
      detail: [early ? `Opens when they turn ${t.age_min} on ${fmtDate(date)}` : "", t.value, t.note].filter(Boolean).join(". "),
      source: t.source,
      date,
    });
  }
  const rank = s => (s.when === "now" ? 0 : 1);
  return steps.sort((a, b) => rank(a) - rank(b) || (a.date && b.date ? a.date - b.date : 0));
}

// ---------- Matching resources to the person ----------

const HIGHER_SUPPORT = /^(Residential program|Supported employment)$/;
const MORE_INDEPENDENT = /^(Program|Employer|Work incentive)$/;
const DDS = /\bDDS\b|Developmental Services/;
const NOT_FOR_HIGH = /not a fit for people who need high support/i;

// 1 = suggested for their support level, 0 = neutral, -1 = the source says it's not a fit.
export function supportFit(r, support) {
  if (support === "2" || support === "3") {
    if (NOT_FOR_HIGH.test(r.notes || "")) return -1;
    if (HIGHER_SUPPORT.test(r.subtype || "") || DDS.test(r.administrator || "")) return 1;
  }
  if (support === "1" && MORE_INDEPENDENT.test(r.subtype || "")) return 1;
  return 0;
}

// Adds .fit and .dist (miles from home, null for statewide) and sorts.
// sort: "suggested" (fit, then distance; statewide counts as near), "nearest", or "default" (original order).
export function rankResources(rows, { support, home } = {}, coordsOf = () => null, sort = "suggested") {
  const out = rows.map((r, i) => {
    const c = home && r.city ? coordsOf(r.city) : null;
    return { ...r, _i: i, fit: supportFit(r, support), dist: c ? miles(home, c) : null };
  });
  const d = (r, statewide) => (r.dist == null ? statewide : r.dist);
  if (sort === "suggested") out.sort((a, b) => b.fit - a.fit || d(a, 0) - d(b, 0) || a._i - b._i);
  if (sort === "nearest") out.sort((a, b) => d(a, Infinity) - d(b, Infinity) || a._i - b._i);
  return out;
}

// Monthly income at different work hours, to show how work and SSI interact.
export function workScenarios(P, wage, onSSI, hoursList = [0, 10, 20, 30, 40]) {
  return hoursList.map(hours => {
    const earn = monthlyEarnings(hours, wage);
    const ssi = onSSI ? ssiAfterEarnings(earn, P) : 0;
    return { hours, earn, ssi, income: earn + ssi };
  });
}
