// "Ask about a term" panel, plus tappable glossary terms on the page.
import { answer, norm } from "./glossary.js";
import { esc, safeUrl } from "./common.js";

// Too common to underline everywhere; they still work when typed into the chat.
const NO_AUTOLINK = new Set(["rent", "both", "government", "nonprofit", "voucher", "trust", "per month", "30%", "30 percent", "one-time",
  "spread", "normalize", "normalized", "waitlist", "waiting list", "ticket", "verified", "medicaid", "stipend", "pass", "able", "first party",
  "third party", "first-party", "third-party", "tax credit", "refundable", "earned income", "family support", "housing authority", "foster care",
  "age 22", "level 1", "level 2", "level 3", "severity", "rent share", "median income", "market rent", "group home", "24 hour"]);

const STARTERS = [
  ["What's the difference between SSI and SSDI?", "SSI vs SSDI"],
  ["What does AMI mean?", "What's AMI?"],
  ["What is an ABLE account?", "ABLE account"],
  ["What does \"Not published\" mean?", "\"Not published\""],
];

export function mountChat({ terms, params = null, resources = [], openResource = null }) {
  const root = document.createElement("div");
  root.className = "chat-root";
  root.innerHTML = `
    <button class="chat-fab" id="chat-fab" aria-expanded="false" aria-controls="chat-panel"><span aria-hidden="true">?</span> Ask about a term</button>
    <section class="chat-panel" id="chat-panel" role="dialog" aria-modal="false" aria-labelledby="chat-h" hidden>
      <header class="chat-head"><h2 id="chat-h">Ask about a term</h2><button class="chat-x" id="chat-x" aria-label="Close">×</button></header>
      <p class="chat-note">Plain-language answers from this site's glossary, with sources. It can't give advice about your situation. Nothing you type leaves this browser.</p>
      <div class="chat-log" id="chat-log" aria-live="polite"></div>
      <div class="chat-chips" id="chat-chips">${STARTERS.map(([q, l]) => `<button class="chip-q" data-q="${esc(q)}">${esc(l)}</button>`).join("")}</div>
      <form class="chat-form" id="chat-form"><label for="chat-in" class="sr">Your question</label>
        <input id="chat-in" autocomplete="off" placeholder="e.g. What is SGA?" maxlength="200"><button class="btn" type="submit">Ask</button></form>
    </section>`;
  document.body.appendChild(root);
  const $ = id => root.querySelector(`#${id}`);
  const byId = Object.fromEntries(terms.map(t => [t.id, t]));

  const open = () => { $("chat-panel").hidden = false; $("chat-fab").setAttribute("aria-expanded", "true"); $("chat-in").focus(); };
  const close = () => { $("chat-panel").hidden = true; $("chat-fab").setAttribute("aria-expanded", "false"); $("chat-fab").focus(); };
  $("chat-fab").addEventListener("click", () => ($("chat-panel").hidden ? open() : close()));
  $("chat-x").addEventListener("click", close);
  root.addEventListener("keydown", e => { if (e.key === "Escape" && !$("chat-panel").hidden) close(); });

  const say = (who, html) => {
    const m = document.createElement("div");
    m.className = `msg ${who}`;
    m.innerHTML = html;
    $("chat-log").appendChild(m);
    $("chat-log").scrollTop = m.offsetTop - $("chat-log").offsetTop - 8; // show the start of the newest message
  };
  const resLink = r => openResource
    ? `<a href="#res-${esc(r.id)}" data-res="${esc(r.id)}">${esc(r.name)}</a>`
    : `<a href="state.html?s=${esc(r.state === "US" ? "MA" : r.state)}">${esc(r.name)}</a>`;
  const host = u => esc(u.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]);

  function ask(q) {
    q = String(q || "").trim();
    if (!q) return;
    say("me", esc(q));
    const a = answer(q, terms, { params, resources });
    if (a.kind === "terms") {
      say("bot", a.cards.map(c => `<div class="card">
        <strong>${esc(c.term)}</strong>
        <p>${esc(c.short)}</p>${c.figure ? `<p class="fig">${esc(c.figure)}</p>` : ""}${c.more ? `<p>${esc(c.more)}</p>` : ""}
        ${c.source ? `<p class="src">Source: <a href="${esc(safeUrl(c.source))}" target="_blank" rel="noopener">${host(c.source)}</a></p>` : c.siteTerm ? `<p class="src">How this site uses the term.</p>` : ""}
        ${c.related.length ? `<p class="rel">On this site: ${c.related.map(resLink).join(" · ")}</p>` : ""}
      </div>`).join(""));
    } else if (a.kind === "resources") {
      say("bot", `<p>I don't have a definition for that, but these resources mention it:</p><p class="rel">${a.related.map(resLink).join(" · ")}</p>`);
    } else {
      say("bot", `<p>I don't have that in the glossary yet. Try one of these, or contact the program directly. Each directory entry lists how to reach them.</p>`);
    }
    $("chat-chips").innerHTML = a.suggestions.map(t => `<button class="chip-q" data-q="What is ${esc(t.term)}?">${esc(t.term.replace(/\s*\(.*\)$/, ""))}</button>`).join("");
  }
  $("chat-form").addEventListener("submit", e => { e.preventDefault(); ask($("chat-in").value); $("chat-in").value = ""; });
  root.addEventListener("click", e => {
    const chip = e.target.closest("[data-q]");
    if (chip) return ask(chip.dataset.q);
    const r = e.target.closest("[data-res]");
    if (r && openResource) { e.preventDefault(); openResource(r.dataset.res); }
  });

  // Tapping an underlined term anywhere on the page explains it.
  document.addEventListener("click", e => {
    const b = e.target.closest("button.term");
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    open();
    const t = byId[b.dataset.term];
    if (t) ask(`What is ${t.term}?`);
  }, true);

  return { open, ask };
}

// Underline the first mention of each glossary term inside `root` (plain text only, not links, buttons or form controls).
export function linkTerms(root, terms) {
  if (!root || root.dataset.termsLinked) return;
  root.dataset.termsLinked = "1";
  const phrases = terms.flatMap(t => [t.term.replace(/\s*\(.*\)$/, ""), ...(t.aliases || [])].map(a => ({ a: norm(a), id: t.id })))
    .filter(p => p.a.length >= 3 && !NO_AUTOLINK.has(p.a))
    .sort((x, y) => y.a.length - x.a.length);
  const used = new Set();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: n => n.parentElement.closest("a, button, input, select, option, label, summary, script, style, .term, .tag, h1")
      ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const text = node.nodeValue, low = text.toLowerCase();
    for (const { a, id } of phrases) {
      if (used.has(id)) continue;
      const re = new RegExp(`(^|[^a-z0-9])(${a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?=$|[^a-z0-9])`);
      const m = re.exec(low);
      if (!m) continue;
      const start = m.index + m[1].length, end = start + m[2].length;
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "term"; btn.dataset.term = id;
      btn.title = "What does this mean?";
      btn.textContent = text.slice(start, end);
      const after = node.splitText(start);
      after.nodeValue = after.nodeValue.slice(end - start);
      node.parentNode.insertBefore(btn, after);
      used.add(id);
      break; // one term per text node keeps it light
    }
  }
}
