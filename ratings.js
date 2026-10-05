/* Shared ratings. Each person rates each house 1–5 stars with an optional note.
 * Ratings sync through a small public Cloud Function (HOUSE_DAYS_RATINGS_URL in
 * config.js). Every rating is also kept in this browser, so nothing is lost while
 * the service is down or not set up yet; local ratings are pushed up once it answers. */
window.HDRatings = (function () {
  "use strict";
  const URL_ = window.HOUSE_DAYS_RATINGS_URL || "";
  const LKEY = "hd:ratings-local", MEKEY = "hd:me";
  const get = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } };
  const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } };
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const key = (r) => r.property + "__" + slug(r.person);

  let byKey = {};          // merged view
  let shared = false;      // did the service answer?
  let lastSig = "", lastShared = null;
  const listeners = [];
  const emit = () => listeners.forEach((f) => { try { f(); } catch (e) { console.warn(e); } });

  function local() { return get(LKEY) || {}; }
  function saveLocal(r) { const l = local(); l[key(r)] = r; put(LKEY, l); }
  function dropLocal(k) { const l = local(); delete l[k]; put(LKEY, l); }

  async function post(body) {
    const res = await fetch(URL_, { method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8" }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error("ratings " + res.status);
    return res.json();
  }

  async function refresh() {
    const l = local();
    let remote = null;
    if (URL_) {
      try {
        const res = await fetch(URL_, { cache: "no-store" });
        if (res.ok) remote = (await res.json()).ratings || [];
      } catch (e) { /* offline or not deployed yet */ }
    }
    shared = remote !== null;
    const merged = {};
    for (const r of remote || []) merged[key(r)] = r;
    for (const [k, r] of Object.entries(l)) {
      const there = merged[k];
      if (!there || String(r.updated) > String(there.updated)) {
        merged[k] = r;
        if (shared && !r.deleted) post(r).catch(() => {});                 // push up what only lived here
        if (shared && r.deleted) post({ ...r, delete: true }).catch(() => {});
      }
    }
    for (const [k, r] of Object.entries(merged)) if (r.deleted) delete merged[k];
    const sig = JSON.stringify(Object.keys(merged).sort().map((k) => [k, merged[k].stars, merged[k].note, merged[k].updated]));
    byKey = merged;
    if (sig !== lastSig || shared !== lastShared) { lastSig = sig; lastShared = shared; emit(); }
  }

  function me() { return (get(MEKEY) || "").trim(); }
  function setMe(name) { put(MEKEY, String(name || "").trim().slice(0, 40)); emit(); }

  async function rate(property, stars, note) {
    const person = me();
    if (!person) throw new Error("Pick a name first");
    const r = { property, person, stars, note: String(note || "").slice(0, 600), updated: new Date().toISOString() };
    saveLocal(r);
    byKey[key(r)] = r; emit();
    if (!URL_) return { shared: false };
    try { await post(r); shared = true; return { shared: true }; }
    catch (e) { shared = false; return { shared: false }; }
  }
  async function clear(property) {
    const person = me(); if (!person) return;
    const r = { property, person, deleted: true, updated: new Date().toISOString() };
    saveLocal(r); delete byKey[key(r)]; emit();
    if (URL_) { try { await post({ ...r, delete: true }); dropLocal(key(r)); } catch (e) { /* retried on next refresh */ } }
  }

  function forProperty(id) {
    return Object.values(byKey).filter((r) => r.property === id).sort((a, b) => b.stars - a.stars || a.person.localeCompare(b.person));
  }
  function mine(id) { const p = me(); return p ? byKey[id + "__" + slug(p)] || null : null; }
  function summary(id) {
    const rs = forProperty(id);
    return { n: rs.length, avg: rs.length ? rs.reduce((a, r) => a + r.stars, 0) / rs.length : null };
  }
  function people() { return [...new Set(Object.values(byKey).map((r) => r.person))].sort(); }

  window.addEventListener("focus", () => { refresh(); });
  setInterval(() => { if (!document.hidden) refresh(); }, 60000);

  return {
    refresh, rate, clear, me, setMe, forProperty, mine, summary, people,
    onChange: (f) => listeners.push(f),
    isShared: () => shared,
    configured: () => !!URL_,
  };
})();

/* A row of five star buttons. onPick(n) is called with 1–5. */
window.HDStars = function (value, onPick, opts) {
  const o = opts || {};
  const box = document.createElement("div");
  box.className = "stars" + (o.small ? " stars-sm" : "");
  box.setAttribute("role", "radiogroup");
  box.setAttribute("aria-label", o.label || "Your rating");
  for (let i = 1; i <= 5; i++) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "star" + (value && i <= value ? " on" : "");
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(value === i));
    b.setAttribute("aria-label", i + (i === 1 ? " star" : " stars"));
    b.textContent = "★";
    b.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); onPick(i); });
    b.addEventListener("mouseenter", () => box.querySelectorAll(".star").forEach((s, j) => s.classList.toggle("hover", j < i)));
    box.append(b);
  }
  box.addEventListener("mouseleave", () => box.querySelectorAll(".star").forEach((s) => s.classList.remove("hover")));
  return box;
};
window.HDStarText = (avg) => avg == null ? "" : "★".repeat(Math.round(avg)) + "☆".repeat(5 - Math.round(avg));
