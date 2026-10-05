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
    quality: (a, b) => (blend(b) ?? -1) - (blend(a) ?? -1) || R.summary(b.id).n - R.summary(a.id).n,
    rating: (a, b) => avgOf(b) - avgOf(a) || ((b.ai && b.ai.stars) || 0) - ((a.ai && a.ai.stars) || 0),
    ai: (a, b) => ((b.ai && b.ai.stars) || 0) - ((a.ai && a.ai.stars) || 0) || avgOf(b) - avgOf(a),
    score: (a, b) => score(b) - score(a),
    price: (a, b) => a.price - b.price,
    added: (a, b) => String(b.added || "").localeCompare(String(a.added || "")),
    land: (a, b) => (b.landAcres || 0) - (a.landAcres || 0),
  };
  /* Labels come from the ratings: AI score blended with the people's average
     (people weigh more as more of them rate). Sale agreed / Passed are facts and win. */
  // Combined score: the AI counts as one rating and each person as one more.
  const blend = (p) => {
    const ai = p.ai ? p.ai.stars : null, rs = R.forProperty(p.id);
    const all = (ai == null ? [] : [ai]).concat(rs.map((r) => r.stars));
    return all.length ? all.reduce((a, b) => a + b, 0) / all.length : null;
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
    const sorted = [...props].sort(sorters[$("sort").value] || sorters.quality);
    for (const p of sorted) {
      const href = `property.html?p=${encodeURIComponent(p.id)}`;
      const lb = label(p);
      const price = el("span", { class: "ic-price", text: euro(p.price) });
      if (rate) price.append(el("small", { text: " ≈ $" + Math.round(p.price * rate).toLocaleString("en-US") }));
      const facts = [p.beds ? `${p.beds} bed` : null, p.floorM2 ? `${p.floorM2} m²` : null, p.landAcres ? `${p.landAcres} ac` : null, p.ber ? `BER ${p.ber}` : null].filter(Boolean).join(" · ");
      const li = el("li", { class: "ic", id: "ic-" + p.id,
        onmouseenter: () => highlight(p.id, true), onmouseleave: () => highlight(p.id, false),
        onclick: (e) => {
          // the whole card opens the house, except the ratings badge and real links
          if (e.target.closest(".scores") || e.target.closest("a")) return;
          if (e.metaKey || e.ctrlKey) window.open(href, "_blank"); else location.href = href;
        } },
        el("a", { class: "ic-photo", href, "aria-label": p.name },
          el("img", { src: p.photos && p.photos[0] ? p.photos[0].url : "", alt: "", loading: "lazy", referrerpolicy: "no-referrer" })),
        el("div", { class: "ic-body" },
          el("div", { class: "ic-main" },
            el("div", { class: "ic-titleline" },
              el("a", { class: "ic-name", href, text: p.name }),
              el("span", { class: "ic-area", title: p.area || p.address || "", text: (p.area || p.address || "").split(",").map((x) => x.trim()).filter((x) => x && x.toLowerCase() !== p.name.toLowerCase()).join(", ") }),
              el("span", { class: "status " + statusClass(lb), text: lb, title: blend(p) != null ? `All ratings ${blend(p).toFixed(2)}` : "" })),
            el("p", { class: "ic-line" }, price, facts ? el("span", { class: "ic-facts", text: facts }) : null),
            p.tagline ? el("p", { class: "ic-tag", text: p.tagline }) : null),
          scoresBadge(p)));
      list.append(li);
    }
  }

  const bar = (v, cls, range) => window.HDBar(v, cls, range);
  const scoresBadge = (p) => window.HDScores(p);

  function highlight(id, on) {
    const m = markers[id];
    if (m) { m.zIndex = on ? 1000 : null; m.content.classList.toggle("hot", on); }
    const card = $("ic-" + id);
    if (card) card.classList.toggle("hot", on);
  }

  /* Price pins are plain HTML (AdvancedMarkerElement), styled in style.css. */
  function pinPreview(p) {
    const sum = R.summary(p.id), aiS = p.ai ? p.ai.stars : null, lb = label(p);
    const row = (icon, v, cls, extra) => el("div", { class: "pp-row" }, el("span", { class: "pp-ico", text: icon }), bar(v, cls),
      el("span", { class: "pp-val", text: v == null ? "–" : v.toFixed(1) }), extra ? el("span", { class: "pp-extra", text: extra }) : null);
    const photo = p.photos && (p.photos.find((x) => x.role === "facade") || p.photos[0]);
    return el("div", { class: "pin-pop" },
      photo ? el("img", { src: photo.url, alt: "", referrerpolicy: "no-referrer" }) : null,
      el("div", { class: "pp-body" },
        el("div", { class: "pp-title" }, el("b", { text: p.name }), el("span", { class: "status " + statusClass(lb), text: lb })),
        el("div", { class: "pp-area", text: (p.area || "").split(",").map((x) => x.trim()).filter((x) => x && x.toLowerCase() !== p.name.toLowerCase()).join(", ") }),
        el("div", { class: "pp-price", text: euro(p.price) + (rate ? `  ≈ $${Math.round(p.price * rate).toLocaleString("en-US")}` : "") }),
        row("🤖", aiS, "ai"),
        row("👥", sum.avg, "us", sum.n ? `${sum.n} ${sum.n === 1 ? "rating" : "ratings"}` : "not rated")));
  }
  // Pin colour = your own rating: red (1) → green (5); slate blue if you haven't rated it.
  const MINE_COLORS = { 1: "#c2271d", 2: "#e0701c", 3: "#cfa915", 4: "#6fa83a", 5: "#1a8a3a" };
  function paintPin(d, p) {
    const out = /passed|sale agreed|sold/i.test(label(p)), mine = R.mine(p.id);
    d.classList.toggle("out", out);
    d.classList.toggle("rated", !!mine && !out);
    d.style.setProperty("--pin", out ? "#8a948f" : mine ? MINE_COLORS[mine.stars] : "#3b6a7a");
    d.title = mine ? `You rated it ${mine.stars} of 5` : "You haven't rated this yet";
  }
  function pin(p) {
    const d = el("div", { class: "pin" }, el("span", { class: "pin-price", text: euroK(p.price) }));
    paintPin(d, p);
    d.addEventListener("mouseenter", () => {
      d.querySelector(".pin-pop")?.remove();
      d.append(pinPreview(p));
      const mapTop = $("idxmap").getBoundingClientRect().top, pinTop = d.getBoundingClientRect().top;
      d.classList.toggle("below", pinTop - mapTop < 250);
      highlight(p.id, true);
    });
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
    const legend = el("div", { class: "pin-legend" }, el("span", { class: "pl-t", text: "Your rating" }),
      ...[1, 2, 3, 4, 5].map((n) => el("span", { class: "pl-i" }, el("i", { style: `background:${MINE_COLORS[n]}` }), document.createTextNode(String(n)))),
      el("span", { class: "pl-i" }, el("i", { style: "background:#3b6a7a" }), document.createTextNode("not yet")));
    map.controls[google.maps.ControlPosition.LEFT_BOTTOM].push(legend);
    // Declutter: place pins best-first; any pin that would overlap a placed one shrinks to a dot.
    const proj = new google.maps.OverlayView();
    proj.onAdd = () => {}; proj.onRemove = () => {}; proj.draw = () => {};
    proj.setMap(map);
    const declutter = () => {
      const pr = proj.getProjection(); if (!pr) return;
      const placed = [];
      const order = [...props].sort((a, b) => (blend(b) ?? 0) - (blend(a) ?? 0));
      for (const p of order) {
        const m = markers[p.id]; if (!m) continue;
        const pt = pr.fromLatLngToContainerPixel(new google.maps.LatLng(p.lat, p.lng));
        const w = 14 + euroK(p.price).length * 8.6 + (R.mine(p.id) ? 12 : 0), h = 30;
        const box = { x0: pt.x - w / 2 - 3, x1: pt.x + w / 2 + 3, y0: pt.y - h - 8, y1: pt.y + 2 };
        const hit = placed.some((b) => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0);
        m.content.classList.toggle("dot", hit);
        m.zIndex = hit ? 1 : 100;
        if (!hit) placed.push(box);
      }
    };
    map.addListener("idle", declutter);
    window.__hdDeclutter = declutter;
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
        if (chip) chip.title = blend(p) != null ? `All ratings ${blend(p).toFixed(2)}` : "";
        if (markers[p.id]) paintPin(markers[p.id].content, p);
      }
      if (window.__hdDeclutter) window.__hdDeclutter();
      // update ratings in place so cards don't jump while you rate
      for (const p of props) {
        const badge = document.querySelector(`#ic-${CSS.escape(p.id)} .scores`);
        const nb = scoresBadge(p);
        if (badge && badge.dataset.sig !== nb.dataset.sig) badge.replaceWith(nb);
      }
      if (document.activeElement !== nm) nm.value = R.me();
      const dl = $("idx-raters"); dl.textContent = "";
      for (const p of R.people()) dl.append(el("option", { value: p }));
    });
    R.refresh().then(renderList);   // re-sort once when the shared ratings arrive
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
