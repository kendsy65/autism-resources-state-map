import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { findTerms, fill, answer, relatedResources } from "../assets/js/glossary.js";

const read = p => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const { terms } = read("../data/glossary.json");
const params = read("../data/MA/planner-parameters.json");
const resources = [...read("../data/MA/resources.json"), ...read("../data/US/resources.json")];
const ids = q => findTerms(q, terms).map(t => t.id);

test("glossary is well formed", () => {
  const seen = new Set();
  for (const t of terms) {
    assert.ok(!seen.has(t.id), `duplicate ${t.id}`); seen.add(t.id);
    assert.ok(t.term && t.short, t.id);
    if (t.kind !== "site") assert.match(t.source, /^https:\/\//, `${t.id} needs a source`);
    for (const s of t.see_also || []) assert.ok(terms.some(x => x.id === s), `${t.id} → ${s}`);
  }
});

test("every figure fills from the MA planner numbers", () => {
  for (const t of terms) if (t.figure) assert.ok(fill(t.figure, params), `${t.id}: ${t.figure}`);
  assert.equal(fill("{{employment.sga_non_blind}}", params), "$1,690/mo");
  assert.equal(fill("{{nope.missing}}", params), null);
});

test("finds terms in natural questions", () => {
  assert.deepEqual(ids("What's the difference between SSI and SSDI?"), ["ssi", "ssdi"]);
  assert.deepEqual(ids("what does AMI mean"), ["ami"]);
  assert.deepEqual(ids("how do I get a Section 8 voucher"), ["section8"]);
  assert.deepEqual(ids("what is a pooled trust"), ["pooled_trust"]); // not also "trust"
  assert.deepEqual(ids("1619(b)?"), ["s1619b"]);
  assert.deepEqual(ids("what is MRC"), ["massability"]);
  assert.deepEqual(ids("assistance"), []); // "ssi" inside a word doesn't count
});

test("answers include sourced figures, related resources and follow-ups", () => {
  const a = answer("what is SGA", terms, { params, resources });
  assert.equal(a.kind, "terms");
  assert.match(a.cards[0].figure, /\$1,690\/mo/);
  assert.match(a.cards[0].source, /ssa\.gov/);
  assert.ok(a.suggestions.some(t => t.id === "twp"));
  const s8 = answer("section 8", terms, { params, resources });
  assert.ok(s8.cards[0].related.some(r => /Section 8/.test(r.name)));
  const ssi = answer("what is SSI", terms, { params, resources }).cards[0].related;
  assert.ok(ssi.length && ssi.every(r => /\bSSI\b/.test(r.name + " " + r.description)), ssi.map(r => r.name).join(", ")); // not "aSSIstance"
});

test("unknown questions fall back to resources or suggestions, never a made-up definition", () => {
  const a = answer("music lessons", terms, { params, resources });
  assert.equal(a.cards.length, 0);
  assert.ok(a.related.some(r => /Kodi Lee/.test(r.name)));
  const b = answer("zzzz qqqq", terms, { params, resources });
  assert.equal(b.kind, "none");
  assert.ok(b.suggestions.length > 0);
  assert.deepEqual(relatedResources("the and of", null, resources), []);
});
