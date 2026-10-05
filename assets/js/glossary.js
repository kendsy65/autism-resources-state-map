// Glossary assistant: matches questions to vetted terms in data/glossary.json. No AI, nothing leaves the browser.
// Figures in definitions come from planner-parameters.json via {{section.key}} tokens.

const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const norm = s => String(s || "").toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();

// Format one planner parameter for reading.
export function fmtParam(p) {
  if (p == null) return null;
  if (typeof p === "number" || typeof p === "string") return String(p);
  const money = v => "$" + v.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: v % 1 ? 2 : 0 });
  const unit = (v, u = "") => /^years$/.test(u) ? `${v}` : /fraction/.test(u) ? `${Math.round(v * 100)}%`
    : money(v) + (/month/.test(u) ? "/mo" : /year/.test(u) ? "/yr" : /day/.test(u) ? "/day" : /hour/.test(u) ? "/hr" : /one-time/.test(u) ? " one time" : "");
  if ("value" in p) return unit(p.value, p.unit);
  if ("min" in p) return `${unit(p.min, p.unit)}–${unit(p.max, p.unit)}` + ("rate" in p ? ` at ${p.rate * 100}%` : "");
  if ("monthly" in p) return `${money(p.monthly)}/mo (${money(p.annual)}/yr)`;
  return null;
}

// Replace {{path}} tokens. Returns null if any value is missing, so we never show a half-filled figure.
export function fill(text, params) {
  if (!text) return "";
  let ok = true;
  const out = text.replace(/\{\{([\w.]+)\}\}/g, (_, path) => {
    const v = path.split(".").reduce((o, k) => o?.[k], params);
    const s = fmtParam(v);
    if (s == null) ok = false;
    return s ?? "";
  });
  return ok ? out : null;
}

// Find glossary terms mentioned in a question. Longer phrases win over shorter ones inside them.
export function findTerms(query, terms, max = 3) {
  const q = norm(query);
  const hits = [];
  for (const t of terms) {
    for (const a of [t.term, ...(t.aliases || [])]) {
      const re = new RegExp(`(^|[^a-z0-9])${escRe(norm(a))}(?=$|[^a-z0-9])`);
      const m = re.exec(q);
      if (m) hits.push({ t, start: m.index + m[1].length, end: m.index + m[1].length + norm(a).length });
    }
  }
  hits.sort((a, b) => (b.end - b.start) - (a.end - a.start) || a.start - b.start);
  const taken = [], out = [];
  for (const h of hits) {
    if (taken.some(s => h.start >= s.start && h.end <= s.end)) continue; // inside a longer match
    taken.push(h);
    if (!out.some(x => x.t.id === h.t.id)) out.push(h);
  }
  return out.sort((a, b) => a.start - b.start).slice(0, max).map(h => h.t);
}

const STOP = new Set("what whats is are the a an of for to do does mean means how who can i my our we they their it in on and or with about this that there be get getting vs versus difference between when where why which will would should could if any some".split(" "));

// Resources that mention a term (by its search phrase) or, failing that, the question's keywords.
export function relatedResources(query, term, resources, max = 3) {
  if (term?.search) {
    const re = new RegExp(`(^|[^a-z0-9])${escRe(norm(term.search))}(?=$|[^a-z0-9])`);
    const hit = resources.filter(r => re.test(norm(r.name)));
    const more = resources.filter(r => !hit.includes(r) && re.test(norm(r.description)));
    return [...hit, ...more].slice(0, max);
  }
  if (term) return [];
  const words = norm(query).split(/[^a-z0-9$%]+/).filter(w => w.length > 2 && !STOP.has(w));
  if (!words.length) return [];
  return resources
    .map(r => ({ r, n: words.filter(w => norm(`${r.name} ${r.description} ${r.eligibility}`).includes(w)).length }))
    .filter(x => x.n === words.length || (words.length > 2 && x.n >= words.length - 1))
    .sort((a, b) => b.n - a.n).slice(0, max).map(x => x.r);
}

// Turn a question into an answer the UI can show.
export function answer(query, terms, { params = null, resources = [] } = {}) {
  const matches = findTerms(query, terms);
  const byId = Object.fromEntries(terms.map(t => [t.id, t]));
  if (matches.length) {
    return {
      kind: "terms",
      cards: matches.map(t => ({
        id: t.id, term: t.term, short: t.short, more: t.more || "",
        figure: params ? fill(t.figure, params) || "" : "",
        source: t.source || "", siteTerm: t.kind === "site",
        related: relatedResources(query, t, resources),
      })),
      suggestions: [...new Set(matches.flatMap(t => t.see_also || []))].filter(id => !matches.some(m => m.id === id)).slice(0, 4).map(id => byId[id]).filter(Boolean),
    };
  }
  const related = relatedResources(query, null, resources);
  return { kind: related.length ? "resources" : "none", cards: [], related, suggestions: ["ssi", "ssdi", "section8", "ami", "able", "not_published"].map(id => byId[id]).filter(Boolean) };
}
