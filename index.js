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
    rating: (a, b) => avgOf(b) - avgOf(a) || ((b.ai && b.ai.stars) || 0) - ((a.ai && a.ai.stars) || 0),
    ai: (a, b) => ((b.ai && b.ai.stars) || 0) - ((a.ai && a.ai.stars) || 0) || avgOf(b) - avgOf(a),
    score: (a, b) => score(b) - score(a),
    price: (a, b) => a.price - b.price,
    added: (a, b) => String(b.added || "").localeCompare(String(a.added || "")),
    land: (a, b) => (b.landAcres || 0) - (a.landAcres || 0),
  };
  /* Labels come from the ratings: AI score blended with the people's average
     (people weigh more as more of them rate). Sale agreed / Passed are facts and win. */
  const blend = (p) => {
    const ai = p.ai ? p.ai.stars : null, sum = R.summary(p.id);
    if (!sum.n) return ai;
    if (ai == null) return sum.avg;
    const w = sum.n / (sum.n + 1);
    return (1 - w) * ai + w * sum.avg;
  };
  let labels = {};
  function computeLabels() {
    labels = {};
    const active = props.filter((p) => !/sale agreed|sold|passed/i.test(p.status || ""));
    for (const p of props) if (!active.includes(p)) labels[p.id] = p.status;
    const ranked = active.map((p) => [p, blend(p)]).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
    ranked.forEach(([p, b], i) => {
      labels[p.id] = b == null ? "Considering" : (i === 0 && b >= 4) ? "Front-runner" : b >= 3.5 ? "Strong contender" : b >= 2.75 ? "Considering" : "Long shot";
    });
  }
  const label = (p) => labels[p.id] || p.status || "Considering";
  const statusClass = (s) => "st-" + String(s || "considering").toLowerCase().replace(/[^a-z]+/g, "-");

  function renderList() {
    computeLabels();
    const list = $("idx-list"); list.textContent = "";
    $("idx-count").textContent = String(props.length);
    const sorted = [...props].sort(sorters[$("sort").value] || sorters.score);
    for (const p of sorted) {
      const href = `property.html?p=${encodeURIComponent(p.id)}`;
      const lb = label(p);
      const price = el("span", { class: "ic-price", text: euro(p.price) });
      if (rate) price.append(el("small", { text: " ≈ $" + Math.round(p.price * rate).toLocaleString("en-US") }));
      const facts = [p.beds ? `${p.beds} bed` : null, p.floorM2 ? `${p.floorM2} m²` : null, p.landAcres ? `${p.landAcres} ac` : null, p.ber ? `BER ${p.ber}` : null].filter(Boolean).join(" · ");
      const li = el("li", { class: "ic", id: "ic-" + p.id,
        onmouseenter: () => highlight(p.id, true), onmouseleave: () => highlight(p.id, false) },
        el("a", { class: "ic-photo", href, "aria-label": p.name },
          el("img", { src: p.photos && p.photos[0] ? p.photos[0].url : "", alt: "", loading: "lazy", referrerpolicy: "no-referrer" })),
        el("div", { class: "ic-body" },
          el("div", { class: "ic-main" },
            el("div", { class: "ic-titleline" },
              el("a", { class: "ic-name", href, text: p.name }),
              el("span", { class: "ic-area", title: p.area || p.address || "", text: (p.area || p.address || "").split(",").map((x) => x.trim()).filter((x) => x && x.toLowerCase() !== p.name.toLowerCase()).join(", ") }),
              el("span", { class: "status " + statusClass(lb), text: lb, title: blend(p) != null ? `Blended score ${blend(p).toFixed(2)}` : "" })),
            el("p", { class: "ic-line" }, price, facts ? el("span", { class: "ic-facts", text: facts }) : null),
            p.tagline ? el("p", { class: "ic-tag", text: p.tagline }) : null),
          scoresBadge(p)));
      list.append(li);
    }
  }

  /* Scores: 🤖 AI and 👥 people on matching 5-star bars, plus your own stars. Hover for detail. */
  function bar(value, cls, range) {
    const b = el("span", { class: "sbar " + cls });
    b.append(el("i", { class: "sbar-fill", style: `width:${value == null ? 0 : (value / 5) * 100}%` }));
    if (range) b.append(el("i", { class: "sbar-range", style: `left:${(range[0] / 5) * 100}%;width:${((range[1] - range[0]) / 5) * 100}%` }));
    return b;
  }
  function scoresBadge(p) {
    const rs = R.forProperty(p.id), sum = R.summary(p.id), mine = R.mine(p.id);
    const sd = rs.length > 1 ? Math.sqrt(rs.reduce((a, r) => a + (r.stars - sum.avg) ** 2, 0) / rs.length) : null;
    const lo = rs.length > 1 ? Math.min(...rs.map((r) => r.stars)) : null, hi = rs.length > 1 ? Math.max(...rs.map((r) => r.stars)) : null;
    const aiS = p.ai ? p.ai.stars : null;
    const pop = el("div", { class: "spop", role: "tooltip" },
      el("p", { class: "spop-h" }, el("b", { text: "🤖 AI" }), document.createTextNode(aiS != null ? ` ${aiS.toFixed(1)} ` : " not scored "), el("span", { class: "spop-stars ai", text: aiS != null ? window.HDStarText(aiS) : "" })),
      p.ai && p.ai.why ? el("p", { class: "spop-why", text: p.ai.why }) : null,
      el("p", { class: "spop-h" }, el("b", { text: "👥 People" }), document.createTextNode(sum.n ? ` ${sum.avg.toFixed(1)}${sd != null ? ` ± ${sd.toFixed(1)}` : ""} from ${sum.n}` : " no ratings yet")),
      rs.length ? el("ul", { class: "spop-list" }, ...rs.map((r) => el("li", {},
        el("span", { class: "spop-name", text: r.person }),
        el("span", { class: "spop-stars", text: window.HDStarText(r.stars) }),
        r.note ? el("span", { class: "spop-note", text: r.note }) : null))) : null);
    const sig = JSON.stringify([mine && mine.stars, rs.map((r) => [r.person, r.stars, r.note])]);
    const you = window.HDStars(mine ? mine.stars : 0, async (n) => {
      const who = await window.HDAskName();
      if (!who) return;
      $("idx-name").value = who;
      const cur = R.mine(p.id);
      await R.rate(p.id, n, cur ? cur.note : "");
    }, { small: true, label: `Your rating for ${p.name}` });
    return el("div", { class: "scores", tabindex: "0", "data-sig": sig, "aria-label": `AI ${aiS ?? "not scored"}, people ${sum.n ? sum.avg.toFixed(1) : "not rated"}` },
      el("span", { class: "srow", title: "AI" }, el("span", { class: "slab", text: "🤖" }), bar(aiS, "ai"), el("span", { class: "sval", text: aiS != null ? aiS.toFixed(1) : "–" })),
      el("span", { class: "srow", title: "People" }, el("span", { class: "slab", text: "👥" }), bar(sum.avg, "us", lo != null && hi > lo ? [lo, hi] : null),
        el("span", { class: "sval", text: sum.n ? sum.avg.toFixed(1) : "–" }),
        sd != null && sd > 0 ? el("span", { class: "ssd", text: "±" + sd.toFixed(1) }) : null),
      el("span", { class: "srow srow-you" }, el("span", { class: "slab slab-you", text: "You" }), you),
      pop);
  }

  function highlight(id, on) {
    const m = markers[id];
    if (m) { m.zIndex = on ? 1000 : null; m.content.classList.toggle("hot", on); }
    const card = $("ic-" + id);
    if (card) card.classList.toggle("hot", on);
  }

  /* Price pins are plain HTML (AdvancedMarkerElement), styled in style.css. */
  function pin(p) {
    const d = el("div", { class: "pin" + (/passed|sale agreed|sold/i.test(label(p)) ? " out" : ""), text: euroK(p.price) });
    d.addEventListener("mouseenter", () => highlight(p.id, true));
    d.addEventListener("mouseleave", () => highlight(p.id, false));
    return d;
  }

  async function initMap() {
    const box = $("idxmap"); box.classList.remove("needs-key"); box.textContent = "";
    const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
    map = new google.maps.Map(box, { center: { lat: 53.1, lng: -7.6 }, zoom: 7, mapId: window.HOUSE_DAYS_MAP_ID || "DEMO_MAP_ID", mapTypeControl: true, streetViewControl: false, fullscreenControl: true, gestureHandling: "cooperative" });
    const bounds = new google.maps.LatLngBounds();
    for (const p of props) {
      const pos = { lat: p.lat, lng: p.lng };
      const m = new AdvancedMarkerElement({ position: pos, map, content: pin(p), title: `${p.name}, ${euroK(p.price)}`, gmpClickable: true });
      m.addListener("click", () => {
        const card = $("ic-" + p.id);
        if ($("idx-main").dataset.view === "map") { location.href = `property.html?p=${encodeURIComponent(p.id)}`; return; }
        if (card) { card.scrollIntoView({ behavior: "instant", block: "center" }); card.classList.add("hot"); setTimeout(() => card.classList.remove("hot"), 1600); }
      });
      markers[p.id] = m; bounds.extend(pos);
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
      computeLabels();
      for (const p of props) {
        const chip = document.querySelector(`#ic-${CSS.escape(p.id)} .status`);
        if (chip && chip.textContent !== label(p)) { chip.textContent = label(p); chip.className = "status " + statusClass(label(p)); }
        if (markers[p.id]) markers[p.id].content.classList.toggle("out", /passed|sale agreed|sold/i.test(label(p)));
      }
      // update ratings in place so cards don't jump while you rate
      for (const p of props) {
        const badge = document.querySelector(`#ic-${CSS.escape(p.id)} .scores`);
        const nb = scoresBadge(p);
        if (badge && badge.dataset.sig !== nb.dataset.sig) badge.replaceWith(nb);
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
