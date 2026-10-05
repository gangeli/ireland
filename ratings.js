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
window.HDStarText = (avg) => {
  if (avg == null) return "";
  const half = Math.round(avg * 2) / 2, full = Math.floor(half), h = half - full ? 1 : 0;
  return "★".repeat(full) + (h ? "½" : "") + "☆".repeat(5 - full - h);
};

/* Ask for a name the first time someone rates; remembered in this browser.
 * Resolves with the name, or null if they cancel. */
window.HDAskName = function () {
  const R = window.HDRatings;
  if (R.me()) return Promise.resolve(R.me());
  return new Promise((resolve) => {
    const dlg = document.createElement("dialog");
    dlg.className = "namedlg";
    dlg.innerHTML = `<form method="dialog" class="namedlg-form">
        <div class="namedlg-sign" aria-hidden="true">
          <svg viewBox="0 0 64 64" width="40" height="40"><path d="M16 33 32 19l16 14" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 31v15h22V31" fill="none" stroke="#fff" stroke-width="5" stroke-linejoin="round"/><rect x="29" y="37" width="6" height="9" fill="#e3b21f"/></svg>
          <span class="namedlg-stars">★★★★★</span>
        </div>
        <div class="namedlg-body">
          <h2>Who's rating?</h2>
          <p>Your stars go up under your name, so everyone can see who loved what. This device will remember you.</p>
          <div class="namedlg-chips" hidden></div>
          <label for="hd-name-in">Your name</label>
          <input id="hd-name-in" maxlength="40" autocomplete="nickname" placeholder="e.g. Gabor" required>
          <div class="namedlg-actions">
            <button type="button" class="namedlg-cancel">Not now</button>
            <button type="submit" class="namedlg-ok">Save and rate</button>
          </div>
        </div>
      </form>`;
    document.body.append(dlg);
    const input = dlg.querySelector("input");
    const chips = dlg.querySelector(".namedlg-chips");
    for (const p of R.people()) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "namedlg-chip"; b.textContent = "I'm " + p;
      b.addEventListener("click", () => finish(p));
      chips.append(b); chips.hidden = false;
    }
    let done = false;
    const finish = (v) => {
      if (done) return; done = true;
      if (v) R.setMe(v);
      dlg.close(); dlg.remove();
      resolve(v || null);
    };
    dlg.querySelector(".namedlg-cancel").addEventListener("click", () => finish(null));
    dlg.querySelector("form").addEventListener("submit", (e) => { e.preventDefault(); const v = input.value.trim(); if (v) finish(v); else input.focus(); });
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); finish(null); });
    dlg.showModal();
    input.focus();
  });
};
