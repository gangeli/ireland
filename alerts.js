/* New-listing alerts: an opt-in bell in the shortlist header.
   Uses Web Push through the ratings function (setup/ratings-setup.sh). The function checks the
   shortlist every 30 minutes and pushes to every subscribed browser when a new house appears. */
(function () {
  "use strict";
  const API = window.HOUSE_DAYS_RATINGS_URL || "";
  const btn = document.getElementById("alerts-btn");
  if (!btn) return;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

  let reg = null, sub = null;
  const b64ToBytes = (s) => {
    const pad = "=".repeat((4 - (s.length % 4)) % 4);
    const raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  };
  const post = (body) => fetch(API, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(body) })
    .then((r) => r.json().then((j) => { if (!r.ok) throw new Error(j.error || r.status); return j; }));

  async function current() {
    if (!supported) return null;
    reg = reg || await navigator.serviceWorker.getRegistration("./") || null;
    sub = reg ? await reg.pushManager.getSubscription() : null;
    return sub;
  }
  function paint() {
    const on = !!sub && Notification.permission === "granted";
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-pressed", String(on));
    btn.querySelector(".ab-text").textContent = on ? "Alerts on" : "Alerts";
    btn.title = on ? "You'll get a notification when a new house is added" : "Get notified when new houses are added";
  }

  const dlg = document.createElement("dialog");
  dlg.className = "namedlg alertdlg";
  dlg.innerHTML = `<form method="dialog" class="namedlg-form">
      <div class="namedlg-sign"><span class="alertdlg-title"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><path d="M10 20a2 2 0 0 0 4 0" fill="none" stroke="#fff" stroke-width="2"/></svg>New-house alerts</span></div>
      <div class="namedlg-body">
        <h2 class="alertdlg-h"></h2>
        <div class="alertdlg-copy"></div>
        <p class="alertdlg-msg" role="status"></p>
        <div class="namedlg-actions"></div>
      </div>
    </form>`;
  document.body.append(dlg);
  const $d = (s) => dlg.querySelector(s);
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });

  const EXPLAIN = `
    <ul class="alertdlg-list">
      <li><b>What you'll get.</b> A notification on this device when the daily search adds a house to the shortlist: at most one a day, and most days none. Tapping it opens the new house's page.</li>
      <li><b>What happens next.</b> Your browser asks whether gangeli.github.io may show notifications. Nothing is sent unless you allow it.</li>
      <li><b>What's stored.</b> An anonymous delivery address for this browser, plus your rating name if you've set one, on the same small server as the ratings. No email address and no tracking.</li>
      <li><b>Turning it off.</b> Come back here, or block notifications for this site in your browser settings.</li>
    </ul>`;

  function actions(list) {
    const box = $d(".namedlg-actions"); box.textContent = "";
    for (const [text, cls, fn] of list) {
      const b = document.createElement("button");
      b.type = "button"; b.className = cls; b.textContent = text;
      b.addEventListener("click", fn);
      box.append(b);
    }
  }
  const say = (t, bad) => { const m = $d(".alertdlg-msg"); m.textContent = t || ""; m.classList.toggle("bad", !!bad); };
  const close = ["Close", "namedlg-cancel", () => dlg.close()];

  async function enable() {
    say("Asking your browser…");
    try {
      // Ask first, while the click still counts as a user gesture.
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { say("Notifications weren't allowed, so alerts stay off. You can change this in your browser's site settings.", true); return; }
      say("Setting up…");
      const keyRes = await fetch(API + "?action=vapid").then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (!keyRes || !keyRes.key) { say("The alerts server isn't switched on yet. Try again later.", true); return; }
      reg = await navigator.serviceWorker.register("sw.js", { scope: "./" });
      await navigator.serviceWorker.ready;
      sub = await reg.pushManager.getSubscription() || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(keyRes.key) });
      const me = window.HDRatings ? window.HDRatings.me() : "";
      await post({ action: "subscribe", sub: sub.toJSON(), person: me });
      paint();
      render();
      say("Done. A test alert is on its way.");
      post({ action: "test", endpoint: sub.endpoint }).catch(() => {});
    } catch (e) {
      console.warn("alerts", e);
      say("Couldn't turn alerts on: " + (e.message || e), true);
    }
  }
  async function disable() {
    try {
      if (sub) { post({ action: "unsubscribe", endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe(); }
      sub = null; paint(); render(); say("Alerts are off for this browser.");
    } catch (e) { say("Couldn't turn alerts off: " + (e.message || e), true); }
  }
  async function test() {
    say("Sending…");
    try { await post({ action: "test", endpoint: sub.endpoint }); say("Sent. It should appear in a few seconds."); }
    catch (e) { say("The test didn't go through: " + (e.message || e), true); }
  }

  function render() {
    const h = $d(".alertdlg-h"), copy = $d(".alertdlg-copy");
    if (!API) { h.textContent = "Alerts aren't set up"; copy.innerHTML = "<p>This copy of the site has no server to send alerts from.</p>"; actions([close]); return; }
    if (!supported && isIOS && !standalone) {
      h.textContent = "Add the site to your Home Screen first";
      copy.innerHTML = `<p>On iPhone and iPad, Safari only allows notifications from sites added to the Home Screen. Tap <b>Share</b>, then <b>Add to Home Screen</b>, open the shortlist from the new icon, and tap <b>Alerts</b> again.</p>` + EXPLAIN;
      actions([close]); return;
    }
    if (!supported) { h.textContent = "This browser can't show alerts"; copy.innerHTML = "<p>Try Chrome, Edge, Firefox or Safari on a computer, or Safari on an iPhone after adding the site to the Home Screen.</p>"; actions([close]); return; }
    if (Notification.permission === "denied") {
      h.textContent = "Notifications are blocked";
      copy.innerHTML = "<p>This browser is set to block notifications from this site. To get alerts, allow notifications for gangeli.github.io in your browser's site settings (usually the icon to the left of the address), then come back here.</p>";
      actions([close]); return;
    }
    if (sub && Notification.permission === "granted") {
      h.textContent = "Alerts are on";
      copy.innerHTML = "<p>This browser gets a notification when a new house joins the shortlist. Other devices need turning on separately.</p>";
      actions([["Turn off", "namedlg-cancel", disable], ["Send a test", "namedlg-ok", test]]);
      return;
    }
    h.textContent = "Hear about new houses";
    copy.innerHTML = EXPLAIN;
    actions([["Not now", "namedlg-cancel", () => dlg.close()], ["Allow alerts", "namedlg-ok", enable]]);
  }

  btn.addEventListener("click", async () => {
    await current().catch(() => null);
    paint(); say(""); render();
    dlg.showModal();
  });
  current().then(paint).catch(() => {});
})();
