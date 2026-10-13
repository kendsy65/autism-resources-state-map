// States in scope and small helpers shared by every page.

export const STATES = {
  CT: { name: "Connecticut", fips: "09" },
  MA: { name: "Massachusetts", fips: "25" },
  NY: { name: "New York", fips: "36" },
};

export const CATEGORIES = ["Housing", "Financing", "Employment", "Employers"];
// What each category is called on screen. "Employment" holds job support (coaching, training, placement).
export const CATEGORY_LABEL = { Housing: "Housing", Financing: "Financing", Employment: "Employment support", Employers: "Employers" };
// Which categories each caregiver focus covers.
export const FOCUS_CATEGORIES = { Housing: ["Housing"], Employment: ["Employment", "Employers"], Both: CATEGORIES };

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

// Optional dark mode. Light is the default for everyone; the choice is remembered in this browser only.
export function initThemeToggle(btn) {
  if (!btn) return;
  const root = document.documentElement;
  const sync = () => {
    const dark = root.dataset.theme === "dark";
    btn.setAttribute("aria-pressed", String(dark));
    btn.textContent = dark ? "Light mode" : "Dark mode";
  };
  btn.addEventListener("click", () => {
    const dark = root.dataset.theme !== "dark";
    if (dark) root.dataset.theme = "dark"; else delete root.dataset.theme;
    try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch {}
    sync();
  });
  sync();
}
