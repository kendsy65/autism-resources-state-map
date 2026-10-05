// States in scope and small helpers shared by every page.

export const STATES = {
  CT: { name: "Connecticut", fips: "09" },
  MA: { name: "Massachusetts", fips: "25" },
  NY: { name: "New York", fips: "36" },
};

export const CATEGORIES = ["Housing", "Financing", "Employment"];

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Only link to real web addresses.
export const safeUrl = u => (/^https?:\/\//i.test(u || "") ? u : "");

export async function loadJSON(path) {
  const r = await fetch(path, { cache: "no-cache" });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

// Resources for one state; empty array if the file is missing or empty.
export async function loadResources(code) {
  try { return await loadJSON(`data/${code}/resources.json`); } catch { return []; }
}
