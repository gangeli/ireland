/* The shortlist: every property in properties/index.json on a map and in a list. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null) continue;
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    for (const k of kids) if (k != null) n.append(k);
    return n;
  }
  const load = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } };
  const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } };
  const forget = (k) => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } };
  const euroK = (n) => "€" + (n >= 1e6 ? (n / 1e6).toFixed(2).replace(/0$/, "") + "m" : Math.round(n / 1000) + "k");
  const euro = (n) => "€" + Math.round(n).toLocaleString("en-IE");

  let props = [], rate = null, map = null;
  const markers = {};

  const score = (p) => (p.pros || []).reduce((a, b) => a + b.weight, 0) - (p.cons || []).reduce((a, b) => a + b.weight, 0);
  const R = window.HDRatings;
  const avgOf = (p) => { const x = R.summary(p.id); return x.avg == null ? -1 : x.avg; };
  const sorters = {
    rating: (a, b) => avgOf(b) - avgOf(a) || score(b) - score(a),
    score: (a, b) => score(b) - score(a),
    price: (a, b) => a.price - b.price,
    added: (a, b) => String(b.added || "").localeCompare(String(a.added || "")),
    land: (a, b) => (b.landAcres || 0) - (a.landAcres || 0),
  };
  const statusClass = (s) => "st-" + String(s || "considering").toLowerCase().replace(/[^a-z]+/g, "-");

  function renderList() {
    const list = $("idx-list"); list.textContent = "";
    const sorted = [...props].sort(sorters[$("sort").value] || sorters.score);
    for (const p of sorted) {
      const href = `property.html?p=${encodeURIComponent(p.id)}`;
      const s = score(p);
      const price = el("span", { class: "ic-price", text: euro(p.price) });
      if (rate) price.append(el("small", { text: " ≈ $" + Math.round(p.price * rate).toLocaleString("en-US") }));
      const li = el("li", { class: "ic", id: "ic-" + p.id,
        onmouseenter: () => highlight(p.id, true), onmouseleave: () => highlight(p.id, false) },
        el("a", { class: "ic-photo", href, "aria-label": p.name },
          el("img", { src: p.photos && p.photos[0] ? p.photos[0].url : "", alt: "", loading: "lazy", referrerpolicy: "no-referrer" })),
        el("div", { class: "ic-body" },
          el("div", { class: "ic-top" },
            el("span", { class: "status " + statusClass(p.status), text: p.status || "Considering" }),
            el("span", { class: "ic-score", title: "Weighted pros minus cons", text: (s > 0 ? "+" : "") + s })),
          el("a", { class: "ic-name", href, text: p.name }),
          el("p", { class: "ic-area", text: p.area || p.address }),
          price,
          el("p", { class: "ic-facts", text: [
            `${p.beds} bed`, `${p.floorM2} m²`, p.landAcres ? `${p.landAcres} ac` : null, p.ber ? `BER ${p.ber}` : null,
          ].filter(Boolean).join(" · ") }),
          p.tagline ? el("p", { class: "ic-tag", text: p.tagline }) : null,
          rateRow(p),
          el("div", { class: "ic-links" },
            el("a", { href, text: "Day in the life →" }),
            p.listingUrl ? el("a", { href: p.listingUrl, target: "_blank", rel: "noopener", text: "Listing" }) : null)));
      list.append(li);
    }
  }

  function rateRow(p) {
    const sum = R.summary(p.id), mine = R.mine(p.id);
    const others = R.forProperty(p.id).map((r) => `${r.person} ${r.stars}`).join(", ");
    const sig = JSON.stringify([mine && mine.stars, R.forProperty(p.id).map((r) => [r.person, r.stars])]);
    return el("div", { class: "ic-rate", "data-sig": sig },
      window.HDStars(mine ? mine.stars : 0, async (n) => {
        if (!R.me()) { $("idx-name").focus(); $("idx-name").placeholder = "Your name first"; return; }
        await R.rate(p.id, n, mine ? mine.note : "");
      }, { small: true, label: `Your rating for ${p.name}` }),
      el("span", { class: "ic-avg", title: others },
        sum.n ? el("b", { text: window.HDStarText(sum.avg) }) : null,
        document.createTextNode(sum.n ? ` ${sum.avg.toFixed(1)} · ${others}` : "Not rated yet")));
  }

  function highlight(id, on) {
    const m = markers[id];
    if (m) m.setZIndex(on ? 1000 : null), m.setIcon(pill(props.find((p) => p.id === id), on));
    const card = $("ic-" + id);
    if (card) card.classList.toggle("hot", on);
  }

  function pill(p, hot) {
    const label = euroK(p.price);
    const w = 14 + label.length * 8.2;
    const out = /passed|sale agreed|sold/i.test(p.status || "");
    const fill = hot ? "#e3b21f" : out ? "#8a948f" : "#0b6b3a", ink = hot ? "#1b2421" : "#ffffff";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="34"><path d="M4 1h${w - 8}a3 3 0 0 1 3 3v18a3 3 0 0 1-3 3H${w / 2 + 6}l-6 7-6-7H4a3 3 0 0 1-3-3V4a3 3 0 0 1 3-3z" fill="${fill}" stroke="#ffffff" stroke-width="1.5"/><text x="${w / 2}" y="18" font-family="IBM Plex Mono, monospace" font-size="13" font-weight="600" fill="${ink}" text-anchor="middle">${label}</text></svg>`;
    return { url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg), anchor: new google.maps.Point(w / 2, 33) };
  }

  function initMap() {
    const box = $("idxmap"); box.classList.remove("needs-key"); box.textContent = "";
    map = new google.maps.Map(box, { center: { lat: 53.1, lng: -7.6 }, zoom: 7, mapTypeControl: true, streetViewControl: false, fullscreenControl: true, gestureHandling: "cooperative" });
    const bounds = new google.maps.LatLngBounds();
    for (const p of props) {
      const m = new google.maps.Marker({ position: { lat: p.lat, lng: p.lng }, map, icon: pill(p, false), title: `${p.name}, ${euroK(p.price)}` });
      m.addListener("click", () => {
        const card = $("ic-" + p.id);
        if ($("idx-main").dataset.view === "map") { location.href = `property.html?p=${encodeURIComponent(p.id)}`; return; }
        if (card) { card.scrollIntoView({ behavior: "smooth", block: "center" }); card.classList.add("hot"); setTimeout(() => card.classList.remove("hot"), 1600); }
      });
      m.addListener("mouseover", () => highlight(p.id, true));
      m.addListener("mouseout", () => highlight(p.id, false));
      markers[p.id] = m; bounds.extend(m.getPosition());
    }
    if (props.length > 1) map.fitBounds(bounds, 48);
    else if (props.length === 1) { map.setCenter(bounds.getCenter()); map.setZoom(10); }
  }

  function setView(v) {
    $("idx-main").dataset.view = v;
    for (const b of ["split", "map", "list"]) $("v-" + b).setAttribute("aria-selected", String(b === v));
    if (map) google.maps.event.trigger(map, "resize");
    try { localStorage.setItem("hd:view", v); } catch (e) { /* ignore */ }
  }

  async function eurUsd() {
    // Frankfurter (ECB rates) moved to frankfurter.dev; the old .app host no longer sends CORS headers.
    const tries = [
      ["https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD", (j) => ({ rate: j.rates && j.rates.USD, date: j.date })],
      ["https://open.er-api.com/v6/latest/EUR", (j) => ({ rate: j.rates && j.rates.USD, date: (j.time_last_update_utc || "").slice(5, 16) })],
    ];
    for (const [url, pick] of tries) {
      try { const r = pick(await (await fetch(url)).json()); if (r.rate) return r; } catch (e) { /* try next */ }
    }
    return null;
  }

  async function boot() {
    const man = await (await fetch("properties/index.json")).json();
    const ids = man.properties || [];
    props = (await Promise.all(ids.map((id) => fetch(`properties/${encodeURIComponent(id)}.json`).then((r) => r.json()).catch(() => null)))).filter(Boolean);
    renderList();
    $("sort").addEventListener("change", renderList);
    const nm = $("idx-name");
    nm.value = R.me();
    nm.addEventListener("change", () => R.setMe(nm.value));
    R.onChange(() => {
      // update ratings in place so cards don't jump while you rate
      for (const p of props) {
        const row = document.querySelector(`#ic-${CSS.escape(p.id)} .ic-rate`);
        const fresh = rateRow(p);
        if (row && row.dataset.sig !== fresh.dataset.sig) row.replaceWith(fresh);
      }
      const dl = $("idx-raters"); dl.textContent = "";
      for (const p of R.people()) dl.append(el("option", { value: p }));
    });
    R.refresh();
    for (const b of ["split", "map", "list"]) $("v-" + b).addEventListener("click", () => setView(b));
    let saved = null; try { saved = localStorage.getItem("hd:view"); } catch (e) { /* ignore */ }
    if (saved) setView(saved);

    eurUsd().then((fx) => { if (fx) { rate = fx.rate; renderList(); } });

    $("keyform").addEventListener("submit", (e) => { e.preventDefault(); const k = $("keyinput").value.trim(); if (k) { store("hd:key", k); location.reload(); } });
    const KEY = load("hd:key") || window.HOUSE_DAYS_KEY || "";
    if (!KEY) { $("keybar").hidden = false; return; }
    window.__hdIdx = initMap;
    window.gm_authFailure = () => { forget("hd:key"); $("keybar").hidden = false; };
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(KEY)}&v=weekly&loading=async&callback=__hdIdx`;
    s.async = true;
    document.head.append(s);
  }
  boot();
})();
