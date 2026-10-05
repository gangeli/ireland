/* House Days: a "day in the life" page for one property.
 * Static data comes from properties/<id>.json. Everything live (places,
 * drive times, Street View frames) is fetched in the browser with a
 * referrer-restricted Maps key. Resolved trips are cached in localStorage
 * for a week so reloading the page doesn't re-bill the Places/Routes calls. */
(function () {
  "use strict";

  const SPEEDS = [1, 5, 15, 30, 60, 120, 300, 600];
  const ARRIVE_M = 1500;   // over the last 1.5 km, frames get denser and playback eases down to 1x
  const SWAP_MS = 110;            // fastest frame swap (~9 fps)
  const CACHE_DAYS = 7;
  const CACHE_VER = "v3";
  const hashStr = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };

  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const PID = params.get("p") || window.HOUSE_DAYS_DEFAULT || "forty-shades";

  let P = null;          // property
  let KEY = "";
  let mapsReady = false;
  const trips = {};      // id -> resolved {dest, route, alts, depMs}

  /* ---------- small helpers ---------- */
  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null) continue;
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k === "style") n.setAttribute("style", v);
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    for (const k of kids) if (k != null) n.append(k);
    return n;
  }
  const euro = (n) => "€" + Math.round(n).toLocaleString("en-IE");
  const fmtMin = (s) => {
    const m = Math.round(s / 60);
    if (m < 60) return m + " min";
    return Math.floor(m / 60) + " h " + String(m % 60).padStart(2, "0");
  };
  const fmtKm = (m) => (m < 10000 ? (m / 1000).toFixed(1) : Math.round(m / 1000)) + " km";
  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* full or blocked */ } }
  function load(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function forget(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }

  /* ---------- geo ---------- */
  const R = 6371000, rad = Math.PI / 180;
  function hav(a, b) {
    const dLat = (b[0] - a[0]) * rad, dLng = (b[1] - a[1]) * rad;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }
  function bearing(a, b) {
    const y = Math.sin((b[1] - a[1]) * rad) * Math.cos(b[0] * rad);
    const x = Math.cos(a[0] * rad) * Math.sin(b[0] * rad) - Math.sin(a[0] * rad) * Math.cos(b[0] * rad) * Math.cos((b[1] - a[1]) * rad);
    return (Math.atan2(y, x) / rad + 360) % 360;
  }
  function decodePolyline(str) {
    let i = 0, lat = 0, lng = 0; const out = [];
    while (i < str.length) {
      for (const which of [0, 1]) {
        let b, shift = 0, result = 0;
        do { b = str.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        const d = (result & 1) ? ~(result >> 1) : (result >> 1);
        if (which === 0) lat += d; else lng += d;
      }
      out.push([lat / 1e5, lng / 1e5]);
    }
    return out;
  }

  /* ---------- Dublin time ---------- */
  function dublinOffsetMin(date) {
    const part = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Dublin", timeZoneName: "longOffset" })
      .formatToParts(date).find((x) => x.type === "timeZoneName");
    const m = part && part.value.match(/GMT([+-])(\d{2}):?(\d{2})?/);
    return m ? (m[1] === "+" ? 1 : -1) * (Number(m[2]) * 60 + Number(m[3] || 0)) : 0;
  }
  function dublinParts(date) {
    const o = {};
    for (const x of new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Dublin", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date)) o[x.type] = x.value;
    return o;
  }
  const DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  function departureFor(trip) {
    const want = trip.day === "friday" ? 5 : trip.day === "saturday" ? 6 : trip.group === "night" ? 3 : 2; // Tue; 3am trip = Wed early hours
    const now = new Date();
    const p = dublinParts(now);
    let y = Number(p.year), mo = Number(p.month), d = Number(p.day);
    let add = (want - DOW[p.weekday] + 7) % 7 || 7;
    const base = new Date(Date.UTC(y, mo - 1, d + add));
    y = base.getUTCFullYear(); mo = base.getUTCMonth(); d = base.getUTCDate();
    const [hh, mm] = trip.when.split(":").map(Number);
    let t = Date.UTC(y, mo, d, hh, mm);
    t -= dublinOffsetMin(new Date(t)) * 60000;
    return t;
  }
  function clockAt(ms) { const p = dublinParts(new Date(ms)); return p.hour + ":" + p.minute; }

  /* ---------- static render ---------- */
  function renderStatic() {
    const parts = (P.area || P.address).split(",").map((x) => x.trim());
    const town = parts.find((x) => x && x.toLowerCase() !== P.name.toLowerCase()) || parts[0];
    document.title = town ? `${P.name}, ${town}` : P.name;
    const photos = P.photos || [];
    const hero = photos.find((x) => x.role === "facade") || photos[0];
    if (hero) { $("heroimg").referrerPolicy = "no-referrer"; $("heroimg").src = hero.url; }
    $("addr").textContent = [P.address, P.eircode].filter(Boolean).join(" · ");
    $("name").textContent = P.name;
    $("tagline").textContent = P.tagline || "";
    $("listinglink").href = P.listingUrl;
    $("gmapslink").href = `https://www.google.com/maps/search/?api=1&query=${P.lat},${P.lng}`;
    $("maillink").href = "#";
    $("maillink").addEventListener("click", (e) => { e.preventDefault(); openMail(); });

    const has = (v) => v !== undefined && v !== null && v !== "";
    const dom = has(P.listed) ? Math.max(0, Math.round((Date.now() - Date.parse(P.listed)) / 86400000)) : null;
    const sqft = (m2) => Math.round(m2 * 10.764).toLocaleString("en-IE") + " sq ft";
    const stats = [
      ["Asking", euro(P.price), [has(P.floorM2) ? `${euro(P.price / P.floorM2)}/m²` : null, `stamp duty ${euro(P.stampDuty || P.price * 0.01)}`].filter(Boolean).join(" · "), "asking"],
      ["Beds / baths", `${P.beds ?? "?"} / ${P.baths ?? "?"}`, P.bedsNote],
      ["House", has(P.floorM2) ? `${P.floorM2} m²` : "Not stated", has(P.floorM2) ? sqft(P.floorM2) + (has(P.atticM2) ? ` + ${P.atticM2} m² attic` : "") : null],
      ["Land", has(P.landAcres) ? `${P.landAcres} ac` : "Not stated", has(P.landHa) ? `${P.landHa} ha` : null],
      ["Energy", null, [has(P.berKwh) ? `${P.berKwh} kWh/m²/yr` : null, P.heating].filter(Boolean).join(" · ")],
      ["On market", dom === null ? "–" : `${dom} days`, [has(P.listed) ? `Listed ${new Date(P.listed).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })}` : null, has(P.views) ? `${P.views.toLocaleString("en-IE")} views` : null].filter(Boolean).join(" · ")],
    ];
    const box = $("stats");
    for (const [k, v, small, id] of stats) {
      const dd = el("dd");
      if (v == null) dd.append(el("span", { class: "ber ber-" + String(P.ber || "x")[0].toLowerCase(), text: P.ber || "BER ?" }));
      else dd.textContent = v;
      if (id) dd.append(el("small", { id: "usd-" + id, class: "usd" }));
      if (small) dd.append(el("small", { text: small }));
      box.append(el("dl", { class: "stat" }, el("dt", { text: k }), dd));
    }
    const SV = [["electricity", "⚡", "Power"], ["water", "💧", "Water"], ["sewer", "🚽", "Sewer"], ["internet", "🌐", "Internet"]];
    const sv = P.services || {};
    const svDd = $("hero-services"); svDd.textContent = "";
    for (const [k, icon, name] of SV) {
      const v = sv[k] || { status: "unknown", detail: "Not stated" };
      // Internet shows what you'd actually get: type · estimated speed · provider
      const net = k === "internet" && v.type ? [v.type, v.speed, v.provider].filter(Boolean).join(" · ") : null;
      svDd.append(el("div", { class: "svc-row svc-" + v.status, title: `${name}: ${v.detail}` },
        el("span", { class: "svc-ico", text: icon }),
        el("span", { class: "svc-name", text: name }),
        el("span", { class: "svc-val", text: net || v.detail.split(/[;,(]/)[0] })));
    }


    // Ledger, with a balance bar up top: total weight for vs against
    const sp = P.pros.reduce((a, b) => a + b.weight, 0), sc = P.cons.reduce((a, b) => a + b.weight, 0);
    const bal = $("balance");
    bal.append(
      el("span", { class: "bal-n bal-against", text: String(sc) }),
      el("div", { class: "bal-bar", title: `Against ${sc} · For ${sp} (weights 1–3)` },
        el("i", { class: "bal-c", style: `flex:${sc}` }), el("i", { class: "bal-p", style: `flex:${sp}` })),
      el("span", { class: "bal-n bal-for", text: String(sp) }));
    const col = (cls, title, items) => {
      const c = el("div", { class: "l-col " + cls }, el("h3", { text: title }));
      for (const it of items) {
        c.append(el("div", { class: "l-item" },
          el("div", { class: "l-bar", style: `--w:${Math.round((it.weight / 3) * 100)}%`, title: `Weight ${it.weight} of 3` },
            el("span", { text: it.text })),
          el("p", { class: "l-detail", text: it.detail })));
      }
      return c;
    };
    $("ledger").append(col("l-cons", "Against", P.cons), col("l-pros", "For", P.pros));

    // Gallery: one slot per kind of view, filled from role-tagged photos; the rest of the photos follow
    const ROLES = [["facade", "The house"], ["garden", "Garden and grounds"], ["interior", "Inside"]];
    renderPlan(photos);
    const used = new Set();
    const slots = $("slots");
    const galleryItems = [];
    const addPhoto = (x, label, cls) => {
      const i = galleryItems.length;
      galleryItems.push({ url: x.url, cap: x.caption && x.caption !== "Listing photo" ? `${label}: ${x.caption}` : label });
      slots.append(el("figure", { class: "slot " + (cls || "") },
        el("button", { type: "button", class: "slot-img", "aria-label": `Enlarge: ${label}`, onclick: () => openLB(i, galleryItems) },
          el("img", { src: x.url, alt: label, loading: "lazy", referrerpolicy: "no-referrer" })),
        el("figcaption", { text: label })));
    };
    for (const [role, label] of ROLES) {
      const x = photos.find((p) => p.role === role && !used.has(p.url));
      if (x) { used.add(x.url); addPhoto(x, label, "slot-" + role); }
    }
    slots.append(
      el("figure", { class: "slot slot-map" }, el("div", { id: "satmap", class: "mapbox needs-key" }, el("span", { text: "Satellite view loads with a Maps key" })), el("figcaption", { text: "From above" })),
      el("figure", { class: "slot slot-map" }, el("div", { id: "pano", class: "mapbox needs-key" }, el("span", { text: "Street View loads with a Maps key" })), el("figcaption", { id: "panocap", text: "At the gate" })));
    for (const x of photos) if (!used.has(x.url) && x.role !== "floorplan" && x.role !== "siteplan") { used.add(x.url); addPhoto(x, "Listing photo", "slot-extra"); }

    const cats = P.categories || [...new Set(P.trips.map((t) => t.category))];
    const box2 = $("trips");
    for (const c of cats) {
      const ts = P.trips.filter((t) => t.category === c);
      if (!ts.length) continue;
      const list = el("ol", { class: "timeline" });
      for (const t of ts) {
        list.append(el("li", { class: "trip" },
          el("button", { type: "button", class: "trip-card", id: "card-" + t.id, onclick: () => openTrip(t) },
            el("img", { class: "trip-photo", alt: "", id: "ph-" + t.id }),
            el("div", { class: "trip-main" },
              el("span", { class: "trip-label" }, document.createTextNode(t.kind),
                t.rating && t.rating.level ? el("span", { class: "school-q q-" + t.rating.level.toLowerCase().replace(/[^a-z]+/g, "-"), text: t.rating.level, title: t.rating.basis || "" }) : null),
              el("span", { class: "trip-dest", id: "dn-" + t.id, text: t.title || t.candidates[0].split(",")[0] }),
              t.note ? el("p", { class: "trip-note", text: t.note }) : null,
              el("p", { class: "trip-alt", id: "alt-" + t.id })),
            el("div", { class: "trip-go" },
              el("span", { class: "mins", id: "mn-" + t.id, text: "–" }),
              el("span", { class: "ride", text: "Ride along →" })))));
      }
      box2.append(el("h3", { class: "group-h", text: c }), list);
    }
  }

  /* ---------- floor plan ---------- */
  function renderPlan(photos) {
    const box = $("plan"); box.textContent = "";
    const plans = photos.filter((x) => x.role === "floorplan"), site = photos.filter((x) => x.role === "siteplan");
    const sheets = [...plans.map((x, i) => ({ ...x, label: plans.length > 1 ? `Floor ${i + 1}` : "Floor plan" })), ...site.map((x) => ({ ...x, label: "Site plan" }))];
    const sheet = el("div", { class: "plan-sheet" });
    if (sheets.length) {
      const big = el("img", { alt: sheets[0].label, referrerpolicy: "no-referrer", src: sheets[0].url });
      const zoom = el("button", { type: "button", class: "plan-img", "aria-label": "Enlarge the floor plan" }, big);
      let cur = 0;
      zoom.addEventListener("click", () => { LB.items = sheets.map((x) => ({ url: x.url, cap: x.label })); openLB(cur); });
      sheet.append(zoom);
      if (sheets.length > 1) {
        const tabs = el("div", { class: "plan-tabs", role: "tablist" });
        sheets.forEach((x, i) => tabs.append(el("button", { type: "button", role: "tab", "aria-selected": String(i === 0), text: x.label, onclick: (e) => {
          cur = i; big.src = x.url; big.alt = x.label;
          tabs.querySelectorAll("button").forEach((b, j) => b.setAttribute("aria-selected", String(j === i)));
        } })));
        sheet.prepend(tabs);
      }
      sheet.append(el("p", { class: "plan-hint", text: "Click to enlarge" }));
      if (!plans.length) sheet.append(el("div", { class: "plan-missing" },
        el("span", { text: "No floor plan in the listing, only a site plan." }),
        el("button", { type: "button", class: "md-btn", text: "Ask the agent", onclick: () => openMail() })));
    } else {
      sheet.classList.add("plan-none");
      sheet.append(el("p", { class: "plan-none-h", text: "No floor plan in the listing" }),
        el("p", { text: "Ask the agent for one; it's the quickest way to settle the ground-floor bedroom question." }),
        el("button", { type: "button", class: "md-btn md-primary", text: "Ask the agent", onclick: () => openMail() }));
    }
    const g = P.groundFloorBedroom || { status: "unknown", detail: "Not stated." };
    const has = (v) => v !== undefined && v !== null && v !== "";
    const facts = el("dl", { class: "plan-facts" },
      el("div", { class: "pf-gfb pf-" + g.status }, el("dt", { text: "Ground-floor bedroom" }), el("dd", { text: g.detail })),
      el("div", {}, el("dt", { text: "Floor area" }), el("dd", { text: has(P.floorM2) ? `${P.floorM2} m² · ${Math.round(P.floorM2 * 10.764).toLocaleString("en-IE")} sq ft${has(P.atticM2) ? ` + ${P.atticM2} m² attic` : ""}` : "Not stated" })),
      el("div", {}, el("dt", { text: "Bedrooms" }), el("dd", { text: `${P.beds ?? "?"}${P.bedsNote ? ` (${P.bedsNote.replace(/^\+\s*/, "plus ")})` : ""}` })),
      el("div", {}, el("dt", { text: "Bathrooms" }), el("dd", { text: String(P.baths ?? "?") })),
      el("div", {}, el("dt", { text: "Type" }), el("dd", { text: P.type || "–" })));
    box.append(sheet, facts);
  }

  /* ---------- lightbox ---------- */
  const LB = { items: [], i: 0 };
  function showLB() {
    const it = LB.items[LB.i]; if (!it) return;
    $("lb-img").referrerPolicy = "no-referrer";
    $("lb-img").src = it.url; $("lb-img").alt = it.cap; $("lb-cap").textContent = `${it.cap} · ${LB.i + 1} of ${LB.items.length}`;
    $("lb-prev").hidden = $("lb-next").hidden = LB.items.length < 2;
  }
  function openLB(i, items) { if (items) LB.items = items; LB.i = i; showLB(); if (!$("lightbox").open) $("lightbox").showModal(); }
  function stepLB(d) { LB.i = (LB.i + d + LB.items.length) % LB.items.length; showLB(); }

  /* ---------- email the agent ---------- */
  function draft() {
    const town = (P.area || P.address).split(",")[0].trim();
    const sv = P.services || {}, known = (k) => sv[k] && (sv[k].status === "ok" || sv[k].status === "check");
    const septic = sv.sewer && /septic/i.test(sv.sewer.detail || ""), well = sv.water && /well/i.test(sv.water.detail || "");
    const standard = [
      "Is it still available? Is there a closing date, and have any offers come in?",
      known("water") && known("sewer")
        ? (septic || well ? `${septic ? "When was the septic tank installed and last inspected, and is it registered and compliant?" : ""}${septic && well ? " " : ""}${well ? "Is there a recent water quality test for the well?" : ""}` : null)
        : "Is the water from mains or a private well, and is the wastewater on mains or a septic tank? If septic, when was it last inspected?",
      sv.internet && sv.internet.status === "ok" ? null : "What broadband can the house get?",
      "Are there any rights of way, boundary or title issues, and do all extensions and outbuildings have planning permission or an exemption?",
      "Has the house, the site or the access road ever flooded?",
      "We're based in California. Could you do a video walk-through, and send the floor plan and the BER advisory report?",
    ];
    const qs = [...(P.questions || []), ...standard.filter(Boolean)];
    return {
      subject: `Enquiry: ${P.name}, ${town}`,
      body: `Hello,\n\nI'm interested in ${P.name}, ${P.address} (${P.listingUrl}). Before arranging a viewing, could you help with a few questions?\n\n` +
        qs.map((q, i) => `${i + 1}. ${q}`).join("\n") + "\n\nMany thanks,\n",
    };
  }
  function syncMailLinks() {
    const to = P.agentEmail || "", su = $("md-subject").value, body = $("md-text").value;
    $("md-mailto").href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(su)}&body=${encodeURIComponent(body)}`;
    $("md-gmail").href = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(su)}&body=${encodeURIComponent(body)}`;
  }
  function openMail() {
    const d = draft();
    $("md-title").textContent = P.name;
    const ag = $("md-agent"); ag.textContent = "";
    const row = (k, v, copy) => { if (!v) return; const dd = el("dd", {}, el("span", { class: "md-val", text: v })); if (copy) dd.append(el("button", { type: "button", class: "md-copy", "data-text": v, text: "Copy" })); ag.append(el("div", {}, el("dt", { text: k }), dd)); };
    row("Agent", P.agent);
    row("Email", P.agentEmail || "Not public. Use the listing's contact form, or ask the agency by phone.", !!P.agentEmail);
    row("Phone", P.agentPhone, true);
    row("Listing", P.listingUrl, true);
    $("md-subject").value = d.subject;
    if (!$("md-text").dataset.pid || $("md-text").dataset.pid !== P.id) { $("md-text").value = d.body; $("md-text").dataset.pid = P.id; }
    $("md-listing").href = P.listingUrl;
    syncMailLinks();
    $("maildlg").showModal();
  }
  async function copyText(text, btn) {
    try { await navigator.clipboard.writeText(text); btn.textContent = "Copied"; }
    catch (e) { btn.textContent = "Select and copy"; }
    setTimeout(() => { btn.textContent = "Copy"; }, 1600);
  }

  /* ---------- ratings ---------- */
  function initRatings() {
    const R = window.HDRatings; if (!R) return;
    $("hp-note").addEventListener("click", () => window.HDRateDialog({ id: P.id, name: P.name, ai: P.ai }));
    const badge = () => {
      const box = $("hero-scores"), cur = box.firstChild, fresh = window.HDScores(P);
      if (!cur || cur.dataset.sig !== fresh.dataset.sig) box.replaceChildren(fresh);
      const mine = R.mine(P.id);
      $("hp-note").textContent = mine && mine.note ? "Edit your note" : "Add a note";
    };
    R.onChange(badge); badge(); R.refresh();
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
  async function showDollars() {
    try {
      const fx = await eurUsd();
      if (!fx) return;
      const rate = fx.rate, j = { date: fx.date };
      const usd = (n) => "$" + Math.round(n * rate).toLocaleString("en-US");
      const box = $("usd-asking");
      box.textContent = `≈ ${usd(P.price)}`;
      box.title = `At €1 = $${rate.toFixed(4)} (ECB rate, ${j.date})`;
      const next = box.nextElementSibling;
      const duty = P.stampDuty || P.price * 0.01;
      if (next) next.textContent = [P.floorM2 ? `${euro(P.price / P.floorM2)}/m² (${usd(P.price / P.floorM2)})` : null, `stamp duty ${euro(duty)} (${usd(duty)})`].filter(Boolean).join(" · ");
    } catch (e) { /* no rate, euros only */ }
  }

  /* ---------- Maps loading ---------- */
  function showKeyBar(msg) {
    $("keybar").hidden = false;
    if (msg) $("keyinput").placeholder = msg;
  }
  function loadMaps(key) {
    return new Promise((resolve, reject) => {
      window.__hdReady = () => resolve();
      window.gm_authFailure = () => {
        forget("hd:key");
        showKeyBar("Key rejected: check billing and the referrer list");
        reject(new Error("auth"));
      };
      const s = document.createElement("script");
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&libraries=places,geometry,marker&loading=async&callback=__hdReady`;
      s.async = true;
      s.onerror = () => reject(new Error("load"));
      document.head.append(s);
    });
  }

  /* ---------- gallery maps ---------- */
  const CITIES = [["Dublin", 53.3498, -6.2603], ["Cork", 51.8985, -8.4756], ["Limerick", 52.6638, -8.6267], ["Galway", 53.2707, -9.0568], ["Waterford", 52.2593, -7.1101], ["Kilkenny", 52.6541, -7.2448]];
  function initHeroMap() {
    const box = $("heromap"); if (!box || getComputedStyle(box).display === "none") return;
    const here = [P.lat, P.lng];
    const [cname, clat, clng] = CITIES.slice().sort((a, b) => hav(here, [a[1], a[2]]) - hav(here, [b[1], b[2]]))[0];
    const m = new google.maps.Map(box, { mapId: window.HOUSE_DAYS_MAP_ID || "DEMO_MAP_ID", disableDefaultUI: true, gestureHandling: "none", keyboardShortcuts: false, clickableIcons: false });
    const b = new google.maps.LatLngBounds(); b.extend({ lat: P.lat, lng: P.lng }); b.extend({ lat: clat, lng: clng });
    m.fitBounds(b, { top: 70, right: 40, bottom: 250, left: 60 });
    const tag = (text, cls) => el("div", { class: "hm-tag " + cls, text });
    new google.maps.marker.AdvancedMarkerElement({ map: m, position: { lat: P.lat, lng: P.lng }, content: tag(P.name, "hm-house") });
    const km = Math.round(hav(here, [clat, clng]) / 1000);
    new google.maps.marker.AdvancedMarkerElement({ map: m, position: { lat: clat, lng: clng }, content: tag(`${cname} · ${km} km`, "hm-city") });
  }

  function initGalleryMaps() {
    try { initHeroMap(); } catch (e) { console.warn("hero map", e); }
    const here = { lat: P.lat, lng: P.lng };
    const sat = $("satmap"); sat.classList.remove("needs-key"); sat.textContent = "";
    const m = new google.maps.Map(sat, { center: here, zoom: 17, mapId: window.HOUSE_DAYS_MAP_ID || "DEMO_MAP_ID", mapTypeId: "satellite", disableDefaultUI: true, zoomControl: true, gestureHandling: "cooperative" });
    new google.maps.marker.AdvancedMarkerElement({ position: here, map: m, title: P.name });

    const panoEl = $("pano"); panoEl.classList.remove("needs-key"); panoEl.textContent = "";
    new google.maps.StreetViewService().getPanorama({ location: here, radius: 600, source: google.maps.StreetViewSource.OUTDOOR })
      .then(({ data }) => {
        const loc = data.location.latLng;
        const head = bearing([loc.lat(), loc.lng()], [P.lat, P.lng]);
        new google.maps.StreetViewPanorama(panoEl, { pano: data.location.pano, pov: { heading: head, pitch: 0 }, addressControl: false, motionTrackingControl: false, fullscreenControl: true });
        const dist = Math.round(hav([loc.lat(), loc.lng()], [P.lat, P.lng]));
        $("panocap").textContent = `At the gate · ${dist} m from the house${data.imageDate ? ", imagery " + data.imageDate : ""}`;
      })
      .catch(() => { panoEl.classList.add("needs-key"); panoEl.textContent = "No Street View within 600 m of the house."; });
  }

  /* ---------- places + routes ---------- */
  const PLACE_FIELDS = ["displayName", "location", "photos", "formattedAddress", "googleMapsURI", "rating", "userRatingCount"];
  // How far (straight line, km) a sensible answer for each trip can be, and what to map-search for if the named candidates fail.
  const TRIP_RULES = {
    school:   { maxKm: 15,  types: ["primary_school"], radius: 12000 },
    "school-good": { maxKm: 30 },
    secondary: { maxKm: 30, types: ["secondary_school"], radius: 25000 },
    "secondary-good": { maxKm: 45 },
    shop:     { maxKm: 10,  types: ["convenience_store", "grocery_store", "supermarket"], radius: 10000 },
    bigshop:  { maxKm: 40,  types: ["supermarket"], radius: 30000 },
    dinner:   { maxKm: 25,  types: ["restaurant", "pub"], radius: 15000 },
    hospital: { maxKm: 120, types: ["hospital"], radius: 50000 },
    train:    { maxKm: 60,  types: ["train_station"], radius: 40000 },
    town:     { maxKm: 50 }, city: { maxKm: 100 },
  };
  function toDest(pl, how) {
    const photo = pl.photos && pl.photos[0];
    return {
      name: pl.displayName, address: pl.formattedAddress, uri: pl.googleMapsURI,
      rating: pl.rating || null, ratings: pl.userRatingCount || 0,
      lat: pl.location.lat(), lng: pl.location.lng(), how: how || "named",
      photo: photo ? photo.getURI({ maxWidth: 900 }) : null,
      credit: photo && photo.authorAttributions && photo.authorAttributions[0]
        ? { name: photo.authorAttributions[0].displayName, uri: photo.authorAttributions[0].uri } : null,
    };
  }
  async function findNearby(rule) {
    const { Place, SearchNearbyRankPreference } = await google.maps.importLibrary("places");
    const { places } = await Place.searchNearby({
      fields: PLACE_FIELDS,
      locationRestriction: { center: { lat: P.lat, lng: P.lng }, radius: rule.radius },
      includedPrimaryTypes: rule.types,
      maxResultCount: 3,
      rankPreference: SearchNearbyRankPreference.DISTANCE,
      region: "ie",
    });
    return (places || []).map((pl) => toDest(pl, "nearby"));
  }
  async function findPlace(query) {
    const { Place } = await google.maps.importLibrary("places");
    const { places } = await Place.searchByText({
      textQuery: query,
      fields: PLACE_FIELDS,
      locationBias: { center: { lat: P.lat, lng: P.lng }, radius: 50000 },
      maxResultCount: 1,
      region: "ie",
    });
    const pl = places && places[0];
    if (!pl) return null;
    return toDest(pl, "named");
  }
  const secs = (s) => (typeof s === "string" ? parseFloat(s) : Number(s || 0));
  async function routeViaRoutesApi(dest, depMs) {
    const body = {
      origin: { location: { latLng: { latitude: P.lat, longitude: P.lng } } },
      destination: { location: { latLng: { latitude: dest.lat, longitude: dest.lng } } },
      travelMode: "DRIVE", routingPreference: "TRAFFIC_AWARE", polylineQuality: "HIGH_QUALITY",
      departureTime: new Date(depMs).toISOString(), regionCode: "ie", units: "METRIC",
    };
    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json", "X-Goog-Api-Key": KEY,
        "X-Goog-FieldMask": "routes.duration,routes.staticDuration,routes.distanceMeters,routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration,routes.legs.steps.polyline.encodedPolyline",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("routes " + res.status + " " + (await res.text()).slice(0, 200));
    const j = await res.json();
    const r = j.routes && j.routes[0];
    if (!r) throw new Error("no route");
    return {
      duration: secs(r.duration), distance: r.distanceMeters,
      steps: r.legs[0].steps.map((s) => ({ dist: s.distanceMeters || 0, dur: secs(s.staticDuration), pts: decodePolyline(s.polyline.encodedPolyline) })),
    };
  }
  async function routeViaDirections(dest, depMs) {
    const res = await new google.maps.DirectionsService().route({
      origin: { lat: P.lat, lng: P.lng }, destination: { lat: dest.lat, lng: dest.lng },
      travelMode: google.maps.TravelMode.DRIVING,
      drivingOptions: { departureTime: new Date(depMs), trafficModel: google.maps.TrafficModel.BEST_GUESS },
    });
    const leg = res.routes[0].legs[0];
    return {
      duration: (leg.duration_in_traffic || leg.duration).value, distance: leg.distance.value,
      steps: leg.steps.map((s) => ({ dist: s.distance.value, dur: s.duration.value, pts: s.path.map((p) => [p.lat(), p.lng()]) })),
    };
  }
  async function routeTo(dest, depMs) {
    try { return await routeViaRoutesApi(dest, depMs); }
    catch (e) { console.warn("Routes API failed, trying Directions", e); return await routeViaDirections(dest, depMs); }
  }
  const slim = (route) => ({ ...route, steps: route.steps.map((s) => ({ ...s, pts: s.pts.map(([a, b]) => [+a.toFixed(5), +b.toFixed(5)]) })) });

  async function resolveTrip(t) {
    const ck = `hd:${CACHE_VER}:${PID}:${t.id}:${hashStr(JSON.stringify(t.candidates))}`;
    const hit = load(ck);
    if (hit && Date.now() - hit.ts < CACHE_DAYS * 86400000) return hit;
    const depMs = departureFor(t);
    const rule = TRIP_RULES[t.id] || {};
    const near = (d) => !rule.maxKm || hav([P.lat, P.lng], [d.lat, d.lng]) / 1000 <= rule.maxKm;
    const options = [];
    const tryDest = async (dest) => {
      try { options.push({ dest, route: await routeTo(dest, depMs) }); } catch (e) { console.warn("route", t.id, dest.name, e); }
    };
    for (const q of t.candidates) {
      try {
        const dest = await findPlace(q);
        if (!dest) { console.warn("trip", t.id, "no match for", q); continue; }
        if (!near(dest)) { console.warn("trip", t.id, q, "matched", dest.name, "too far away; skipping"); continue; }
        await tryDest(dest);
      } catch (e) { console.warn("trip", t.id, q, e); }
    }
    // Named candidates all failed: fall back to the nearest place of the right type on the map.
    if (!options.length && rule.types) {
      try { for (const dest of (await findNearby(rule)).slice(0, 2)) await tryDest(dest); }
      catch (e) { console.warn("trip", t.id, "nearby search failed", e); }
    }
    if (!options.length) throw new Error("nothing found for " + t.id);
    options.sort((a, b) => a.route.duration - b.route.duration);
    const best = options[0];
    const out = {
      ts: Date.now(), depMs, dest: best.dest, route: slim(best.route),
      alts: options.slice(1).map((o) => ({ name: o.dest.name, duration: o.route.duration, distance: o.route.distance })),
    };
    store(ck, out);
    return out;
  }

  async function resolveAll() {
    // Short trips first so the top of the timeline fills in quickly.
    for (const t of P.trips) {
      try {
        const r = await resolveTrip(t);
        trips[t.id] = r;
        $("dn-" + t.id).textContent = r.dest.name;
        const mn = $("mn-" + t.id);
        mn.textContent = "";
        mn.append(fmtMin(r.route.duration).replace(" min", ""), el("small", { text: r.route.duration < 3600 ? "min" : "" }));
        $("alt-" + t.id).textContent = fmtKm(r.route.distance) + (r.dest.how === "nearby" ? " · nearest found by map search" : "") + (r.alts.length ? " · vs " + r.alts.map((a) => `${a.name} ${fmtMin(a.duration)}`).join(", ") : "");
        const im = $("ph-" + t.id); im.alt = r.dest.name;
        im.src = r.dest.photo || destStreetView(r.dest);
      } catch (e) {
        console.warn(e);
        $("mn-" + t.id).textContent = "?";
        $("alt-" + t.id).textContent = "Couldn't find this one; check the browser console.";
      }
    }
  }

  /* ---------- frames ---------- */
  function buildFrames(route) {
    const sumDur = route.steps.reduce((a, s) => a + s.dur, 0) || route.duration;
    const scale = route.duration / sumDur;
    const pts = []; // [lat, lng, d, t, speed]
    let D = 0, T = 0;
    for (const s of route.steps) {
      const spd = s.dur > 0 ? s.dist / s.dur : 13;
      let len = 0;
      for (let i = 1; i < s.pts.length; i++) len += hav(s.pts[i - 1], s.pts[i]);
      len = len || 1;
      for (let i = 0; i < s.pts.length; i++) {
        if (i > 0) {
          const seg = hav(s.pts[i - 1], s.pts[i]);
          D += seg; T += (seg / len) * s.dur * scale;
        }
        const last = pts[pts.length - 1];
        if (!last || last[0] !== s.pts[i][0] || last[1] !== s.pts[i][1]) pts.push([s.pts[i][0], s.pts[i][1], D, T, spd]);
      }
    }
    const total = D;
    const at = (d) => { // binary search interpolation along the path
      let lo = 0, hi = pts.length - 1;
      if (d <= 0) return pts[0];
      if (d >= total) return pts[hi];
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (pts[mid][2] <= d) lo = mid; else hi = mid; }
      const a = pts[lo], b = pts[hi], f = (d - a[2]) / ((b[2] - a[2]) || 1);
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, d, a[3] + (b[3] - a[3]) * f, a[4]];
    };
    const spacing = (d, spd) => {
      if (total - d < 500) return 10;                        // arrival: dense, played at ~1x
      if (total - d < ARRIVE_M) return 15;
      if (d < 1500) return 22;                               // the character is at the ends
      if (spd > 24) return 320;                              // motorway: sparse
      if (spd > 16) return 90;                               // national roads
      return 35;                                             // lanes and towns
    };
    let budget = 1;
    let frames;
    for (let pass = 0; pass < 4; pass++) {
      frames = [];
      for (let d = 0; d <= total; ) {
        const p = at(d);
        frames.push({ lat: p[0], lng: p[1], d, t: p[3] });
        d += spacing(d, p[4]) * budget;
      }
      if (frames.length <= 900) break;
      budget *= frames.length / 900;
    }
    const endP = pts[pts.length - 1];
    frames.push({ lat: endP[0], lng: endP[1], d: total, t: route.duration });
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      const ahead = at(Math.min(total, f.d + 30));
      f.h = (total - f.d > 5) ? bearing([f.lat, f.lng], [ahead[0], ahead[1]]) : (i ? frames[i - 1].h : 0);
    }
    return { frames, total, pts };
  }
  const svUrl = (f) => `https://maps.googleapis.com/maps/api/streetview?size=640x360&location=${f.lat.toFixed(6)},${f.lng.toFixed(6)}&heading=${Math.round(f.h)}&pitch=-3&fov=90&source=outdoor&return_error_code=true&key=${encodeURIComponent(KEY)}`;

  const destStreetView = (d) => `https://maps.googleapis.com/maps/api/streetview?size=640x400&location=${d.lat.toFixed(6)},${d.lng.toFixed(6)}&radius=80&source=outdoor&key=${encodeURIComponent(KEY)}`;

  /* ---------- player ---------- */
  const PL = { t: null, r: null, frames: [], dist: 0, simT: 0, total: 1, speed: 30, playing: false, shown: -1, lastSwap: 0, front: "a", cache: new Map(), buffering: false, contig: -1, loadToken: 0, raf: 0, map: null, line: null, marker: null };

  function buildDial() {
    const dial = $("pl-dial");
    const cx = 105, cy = 100, r = 80;
    const ang = (i) => Math.PI - (i / (SPEEDS.length - 1)) * Math.PI;
    const svg = `<svg viewBox="0 0 210 118" aria-hidden="true">
      <path class="arc" d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}" />
      <path class="arc-on" id="dial-on" d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" />
      <line class="needle" id="dial-needle" x1="${cx}" y1="${cy}" x2="${cx - r + 18}" y2="${cy}" />
      <circle class="hub" cx="${cx}" cy="${cy}" r="6" /></svg>`;
    dial.innerHTML = svg;
    SPEEDS.forEach((s, i) => {
      const a = ang(i);
      const x = cx + Math.cos(a) * (r + 18), y = cy - Math.sin(a) * (r + 14);
      const b = el("button", { type: "button", role: "radio", "aria-checked": "false", "data-i": String(i), style: `left:${(x / 210) * 100}%;top:${(y / 118) * 100}%`, text: s + "×", onclick: () => setSpeed(i) });
      dial.append(b);
    });
    dial.append(el("span", { class: "dial-label", text: "Speed" }));
    dial.addEventListener("keydown", (e) => {
      if (dial.classList.contains("locked")) return;
      const cur = SPEEDS.indexOf(PL.speed);
      if (e.key === "ArrowRight" || e.key === "ArrowUp") { setSpeed(Math.min(SPEEDS.length - 1, cur + 1)); e.preventDefault(); }
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") { setSpeed(Math.max(0, cur - 1)); e.preventDefault(); }
    });
  }
  function setSpeed(i) {
    PL.speed = SPEEDS[i];
    const frac = i / (SPEEDS.length - 1);
    $("dial-on").setAttribute("stroke-dashoffset", String(100 - frac * 100));
    $("dial-on").style.strokeOpacity = frac === 0 ? "0" : "1";
    $("dial-needle").style.transform = `rotate(${frac * 180}deg)`;
    $("pl-dial").querySelectorAll("button").forEach((b) => {
      const on = Number(b.dataset.i) === i;
      b.setAttribute("aria-checked", String(on)); b.tabIndex = on ? 0 : -1;
    });
  }

  function lockDial(locked) {
    const dial = $("pl-dial");
    dial.classList.toggle("locked", locked);
    dial.title = locked ? "Speed unlocks once every frame has loaded" : "";
    dial.querySelectorAll("button").forEach((b) => { b.disabled = locked; });
  }

  /* First ride: fetch frames in order, a few at a time, and only let playback
     run as far as the frames that have arrived. Once all are in, unlock speed. */
  function startLoader() {
    const token = ++PL.loadToken, N = PL.frames.length, CONC = 6;
    let next = 0, inflight = 0;
    const entry = (i) => PL.cache.get(svUrl(PL.frames[i]));
    const pump = () => {
      if (PL.loadToken !== token) return;
      while (inflight < CONC && next < N) {
        const e = getImg(next++);
        if (e.done) continue;
        inflight++;
        e.waiters.push(() => { if (PL.loadToken !== token) return; inflight--; pump(); });
      }
      while (PL.contig + 1 < N && (entry(PL.contig + 1) || {}).done) PL.contig++;
      const got = PL.contig + 1;
      $("pl-buffer").textContent = `Loading Street View · ${got} of ${N} frames`;
      if (got >= N) { PL.buffering = false; $("pl-buffer").hidden = true; lockDial(false); }
    };
    pump();
  }

  function frameAt(t) {
    const f = PL.frames; let lo = 0, hi = f.length - 1;
    if (t >= f[hi].t) return hi;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (f[mid].t <= t) lo = mid; else hi = mid; }
    return lo;
  }
  function getImg(i) {
    const f = PL.frames[i]; const url = svUrl(f);
    let e = PL.cache.get(url);
    if (!e) {
      e = { url, done: false, ok: false, waiters: [] };
      const im = new Image();
      im.onload = () => { e.done = true; e.ok = true; e.waiters.forEach((w) => w()); e.waiters = []; };
      im.onerror = () => { e.done = true; e.ok = false; e.waiters.forEach((w) => w()); e.waiters = []; };
      im.referrerPolicy = "strict-origin-when-cross-origin";
      im.src = url; e.img = im;
      PL.cache.set(url, e);
    }
    return e;
  }
  function paint(i) {
    const e = getImg(i);
    const swap = () => {
      if (PL.wanted !== i) return;
      PL.shown = i;
      if (!e.ok) { $("pl-gap").hidden = false; return; }
      $("pl-gap").hidden = true;
      const back = PL.front === "a" ? $("pl-b") : $("pl-a");
      const front = PL.front === "a" ? $("pl-a") : $("pl-b");
      back.src = e.url; back.classList.add("on"); front.classList.remove("on");
      PL.front = PL.front === "a" ? "b" : "a";
    };
    PL.wanted = i;
    if (e.done) swap(); else e.waiters.push(swap);
  }
  function hud() {
    const t = PL.simT, f = PL.frames[Math.max(0, PL.shown)] || PL.frames[0];
    const s2 = Math.round(t), hh = Math.floor(s2 / 3600), mm = Math.floor((s2 % 3600) / 60), ss = s2 % 60;
    $("pl-clock").textContent = (hh ? hh + ":" + String(mm).padStart(2, "0") : mm) + ":" + String(ss).padStart(2, "0");
    $("pl-left").textContent = fmtMin(Math.max(0, PL.total - t));
    $("pl-dist").textContent = fmtKm(Math.max(0, PL.dist - f.d));
    $("pl-signkm").title = PL.eff && PL.eff < PL.speed - 0.5 ? `Slowing for arrival: ${PL.eff.toFixed(0)}×` : "";
    $("pl-signkm").textContent = fmtKm(Math.max(0, PL.dist - f.d));
    if (PL.marker) PL.marker.position = { lat: f.lat, lng: f.lng };
    if (!PL.scrubbing) $("pl-scrub").value = String(Math.round((t / PL.total) * 1000));
  }
  function arrive(show) {
    $("pl-arrive").hidden = !show;
    if (show) { PL.playing = false; $("pl-play").textContent = "↺"; $("pl-play").setAttribute("aria-label", "Replay"); }
  }
  function tick(now) {
    const dt = PL.last ? Math.min(0.25, (now - PL.last) / 1000) : 0;
    PL.last = now;
    if (PL.playing) {
      let cap = PL.total;
      if (PL.buffering) cap = PL.contig >= 0 ? PL.frames[PL.contig].t : 0;
      // ease toward 1x over the final stretch so the arrival plays at real speed
      const fNow = PL.frames[frameAt(PL.simT)];
      const rem = PL.dist - (fNow ? fNow.d : 0);
      const k = rem < ARRIVE_M ? Math.pow(Math.max(0, rem) / ARRIVE_M, 2) : 1;
      PL.eff = 1 + (PL.speed - 1) * k;
      PL.simT = Math.min(cap, PL.total, PL.simT + dt * PL.eff);
      if (PL.simT >= PL.total) arrive(true);
    }
    const target = frameAt(PL.simT);
    if (target !== PL.wanted && now - PL.lastSwap >= SWAP_MS) { PL.lastSwap = now; paint(target); }
    if (PL.playing && !PL.buffering) for (let k = 1; k <= 6; k++) getImg(frameAt(Math.min(PL.total, PL.simT + k * PL.speed * SWAP_MS / 1000)));
    hud();
    PL.raf = requestAnimationFrame(tick);
  }
  function togglePlay() {
    if (!PL.frames.length) return;
    if (PL.simT >= PL.total) { PL.simT = 0; arrive(false); }
    PL.playing = !PL.playing;
    $("pl-play").textContent = PL.playing ? "❚❚" : "▶";
    $("pl-play").setAttribute("aria-label", PL.playing ? "Pause" : "Play");
  }

  async function openTrip(t) {
    const dlg = $("player");
    $("pl-kind").textContent = `${t.category} · ${t.kind}`;
    $("pl-title").textContent = t.title || t.candidates[0].split(",")[0];
    $("pl-note").textContent = t.note || "";
    $("pl-loading").hidden = false; $("pl-loading").textContent = mapsReady ? "Plotting the route…" : "Add a Maps key at the top of the page to ride along.";
    arrive(false); $("pl-gap").hidden = true;
    $("pl-a").removeAttribute("src"); $("pl-b").removeAttribute("src");
    if (!dlg.open) dlg.showModal();
    if (!mapsReady) return;
    let r = trips[t.id];
    try { if (!r) { r = await resolveTrip(t); trips[t.id] = r; } }
    catch (e) { $("pl-loading").textContent = "Couldn't plot this trip. The browser console has details."; return; }

    const { frames, total, pts } = buildFrames(r.route);
    Object.assign(PL, { t, r, frames, dist: total, total: r.route.duration, simT: 0, shown: -1, wanted: -1, playing: false, last: 0, contig: -1 });
    PL.loadToken++;
    const allCached = frames.every((f) => (PL.cache.get(svUrl(f)) || {}).done);
    PL.buffering = !allCached;
    lockDial(PL.buffering);
    $("pl-buffer").hidden = !PL.buffering;
    $("pl-loading").textContent = "Loading Street View…";
    $("pl-title").textContent = r.dest.name;
    $("pl-signname").textContent = r.dest.name;
    $("pl-elapsed").textContent = fmtMin(r.route.duration);
    $("pl-note").textContent = t.note || "";
    $("pl-destname").textContent = r.dest.name;
    $("pl-destmeta").textContent = `${fmtMin(r.route.duration)} · ${fmtKm(r.route.distance)}` + (r.dest.rating ? ` · ${r.dest.rating}★ (${r.dest.ratings})` : "");
    const di = $("pl-destimg");
    di.src = r.dest.photo || destStreetView(r.dest); di.hidden = false;
    const cr = $("pl-destcredit"); cr.textContent = "";
    if (r.dest.credit) cr.append("Photo: ", el("a", { href: r.dest.credit.uri, target: "_blank", rel: "noopener", text: r.dest.credit.name }), " via Google");

    // default speed: whole trip in ~40 seconds
    const ideal = r.route.duration / 40;
    let best = 1; SPEEDS.forEach((s, i) => { if (i > 0 && Math.abs(Math.log(s / ideal)) < Math.abs(Math.log(SPEEDS[best] / ideal))) best = i; });
    setSpeed(best);

    if (!PL.map) {
      PL.map = new google.maps.Map($("pl-map"), { mapId: window.HOUSE_DAYS_MAP_ID || "DEMO_MAP_ID", disableDefaultUI: true, zoomControl: true, gestureHandling: "cooperative", mapTypeId: "roadmap" });
      PL.line = new google.maps.Polyline({ map: PL.map, strokeColor: "#0b6b3a", strokeWeight: 5, strokeOpacity: 0.9 });
      PL.marker = new google.maps.marker.AdvancedMarkerElement({ map: PL.map, content: el("div", { class: "car-dot" }), zIndex: 10 });
      PL.home = new google.maps.marker.AdvancedMarkerElement({ map: PL.map, position: { lat: P.lat, lng: P.lng }, title: P.name });
    }
    PL.line.setPath(pts.map((p) => ({ lat: p[0], lng: p[1] })));
    const bounds = new google.maps.LatLngBounds();
    pts.forEach((p) => bounds.extend({ lat: p[0], lng: p[1] }));
    PL.map.fitBounds(bounds, 24);

    if (PL.buffering) startLoader(); else PL.contig = frames.length - 1;
    paint(0);
    const first = getImg(0);
    const ready = () => { $("pl-loading").hidden = true; };
    if (first.done) ready(); else first.waiters.push(ready);
    if (!PL.raf) PL.raf = requestAnimationFrame(tick);
    togglePlay();
  }
  function closeTrip() {
    PL.loadToken++;
    PL.playing = false; cancelAnimationFrame(PL.raf); PL.raf = 0;
    $("player").close();
  }

  /* ---------- boot ---------- */
  async function boot() {
    try {
      const res = await fetch(`properties/${encodeURIComponent(PID)}.json`, { cache: "no-cache" });  // revalidate: data changes nightly
      P = await res.json();
    } catch (e) {
      document.body.prepend(el("p", { class: "wrap", text: `Couldn't load property "${PID}".` }));
      return;
    }
    renderStatic();
    showDollars();
    initRatings();
    $("lb-close").addEventListener("click", () => $("lightbox").close());
    $("md-close").addEventListener("click", () => $("maildlg").close());
    $("maildlg").addEventListener("click", (e) => {
      if (e.target === $("maildlg")) { $("maildlg").close(); return; }
      const b = e.target.closest(".md-copy"); if (!b) return;
      const src = b.dataset.copy ? $(b.dataset.copy) : null;
      if (src) { src.select(); copyText(src.value, b); } else copyText(b.dataset.text, b);
    });
    $("md-text").addEventListener("input", syncMailLinks);
    $("lb-prev").addEventListener("click", () => stepLB(-1));
    $("lb-next").addEventListener("click", () => stepLB(1));
    $("lightbox").addEventListener("click", (e) => { if (e.target === $("lightbox")) $("lightbox").close(); });
    document.addEventListener("keydown", (e) => {
      if (!$("lightbox").open) return;
      if (e.key === "ArrowLeft") stepLB(-1);
      if (e.key === "ArrowRight") stepLB(1);
    });
    buildDial();
    $("pl-play").addEventListener("click", togglePlay);
    $("pl-close").addEventListener("click", closeTrip);
    $("player").addEventListener("close", () => { PL.playing = false; cancelAnimationFrame(PL.raf); PL.raf = 0; });
    const scrub = $("pl-scrub");
    scrub.addEventListener("input", () => {
      PL.scrubbing = true;
      PL.simT = (Number(scrub.value) / 1000) * PL.total;
      if (PL.buffering) PL.simT = Math.min(PL.simT, PL.contig >= 0 ? PL.frames[PL.contig].t : 0);
      arrive(PL.simT >= PL.total);
      PL.lastSwap = 0;
    });
    scrub.addEventListener("change", () => { PL.scrubbing = false; });
    document.addEventListener("keydown", (e) => {
      if (!$("player").open) return;
      if (e.key === " " && e.target === document.body) { togglePlay(); e.preventDefault(); }
    });
    $("forgetkey").addEventListener("click", () => { forget("hd:key"); location.reload(); });
    $("clearcache").addEventListener("click", () => {
      try { Object.keys(localStorage).filter((k) => k.startsWith("hd:" + CACHE_VER + ":" + PID)).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* ignore */ }
      location.reload();
    });
    $("keyform").addEventListener("submit", (e) => {
      e.preventDefault();
      const k = $("keyinput").value.trim();
      if (!k) return;
      store("hd:key", k);
      location.reload();
    });

    KEY = load("hd:key") || window.HOUSE_DAYS_KEY || "";
    if (!KEY) { showKeyBar(); return; }
    try {
      await loadMaps(KEY);
      mapsReady = true;
      initGalleryMaps();
      resolveAll();
    } catch (e) {
      console.warn("Maps failed", e);
      showKeyBar("Maps didn't load: check the key");
    }
  }
  boot();
})();
