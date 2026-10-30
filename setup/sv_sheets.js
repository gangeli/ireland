// Usage: node setup/sv_sheets.js <property-id> <outdir>   (outdir in a scratch folder, never the repo)
// Loads the house page (local files served under the real origin so the Maps key works), waits for trips to resolve,
// then for each trip within 8 km builds a Street View contact sheet along the WALKING route and screenshots it.
const { chromium } = require('playwright'); const fs=require('fs'); const path=require('path');
const ROOT=path.resolve(__dirname, ".."); const [id, out] = process.argv.slice(2);
fs.mkdirSync(out,{recursive:true});
(async () => {
  const ctx = await chromium.launchPersistentContext(process.env.BAKE_PROFILE || '/tmp/house-days-bake', {viewport:{width:1400,height:1000}}); const b = { close: () => ctx.close() };
  await ctx.route('https://gangeli.github.io/ireland/**', async (route) => {
    const u = new URL(route.request().url()); const p = u.pathname.replace('/ireland/','') || 'index.html'; const f = path.join(ROOT,p);
    if (fs.existsSync(f) && fs.statSync(f).isFile()) return route.fulfill({status:200, body: fs.readFileSync(f), headers:{'content-type':({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json'})[path.extname(f)]||'application/octet-stream'}});
    return route.continue();
  });
  const pg = await ctx.newPage();
  await pg.goto(`https://gangeli.github.io/ireland/property.html?p=${id}`);
  await pg.waitForFunction(() => [...document.querySelectorAll('.mins')].every(e => e.textContent !== '–'), null, {timeout: 120000}).catch(()=>{});
  await pg.waitForTimeout(3000);
  const trips = await pg.evaluate(async (id) => {
    const P = await (await fetch(`properties/${id}.json`)).json();
    const res = [];
    // Prefer the stored results (trip.resolved) so this tool doesn't pay for fresh Places/Routes lookups.
    for (const t of P.trips) if (t.resolved && t.resolved.distance <= 8000) res.push({ tid: t.id, dest: t.resolved.dest, driveKm: t.resolved.distance / 1000 });
    if (res.length) return { P: { lat: P.lat, lng: P.lng }, res };
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k.includes(`:${id}:`) || k.includes(':act:')) continue;
      const v = JSON.parse(localStorage.getItem(k)); const tid = k.split(':')[3];
      if (v && v.dest && v.route && v.route.distance <= 8000) res.push({ tid, dest: v.dest, driveKm: v.route.distance / 1000 });
    }
    return { P: { lat: P.lat, lng: P.lng }, res };
  }, id);
  const KEY = await pg.evaluate(() => (window.HOUSE_DAYS_MAPS_KEY || window.MAPS_KEY || (window.CONFIG && window.CONFIG.mapsKey) || ''));
  const meta = [];
  for (const t of trips.res) {
    const info = await pg.evaluate(async ({ P, dest, tid }) => {
      const r = await new google.maps.DirectionsService().route({ origin: P, destination: { lat: dest.lat, lng: dest.lng }, travelMode: google.maps.TravelMode.WALKING });
      const leg = r.routes[0].legs[0]; const path = r.routes[0].overview_path.map(p => [p.lat(), p.lng()]);
      const hav = (a, b) => { const R = 6371000, toR = Math.PI / 180, dLa = (b[0]-a[0])*toR, dLo = (b[1]-a[1])*toR; const x = Math.sin(dLa/2)**2 + Math.cos(a[0]*toR)*Math.cos(b[0]*toR)*Math.sin(dLo/2)**2; return 2*R*Math.asin(Math.sqrt(x)); };
      const brg = (a, b) => { const toR = Math.PI/180, y = Math.sin((b[1]-a[1])*toR)*Math.cos(b[0]*toR), x = Math.cos(a[0]*toR)*Math.sin(b[0]*toR) - Math.sin(a[0]*toR)*Math.cos(b[0]*toR)*Math.cos((b[1]-a[1])*toR); return (Math.atan2(y, x)/toR + 360) % 360; };
      let total = 0; const cum = [0]; for (let i = 1; i < path.length; i++) { total += hav(path[i-1], path[i]); cum.push(total); }
      const n = Math.min(16, Math.max(4, Math.round(total / 250)));
      const shots = [];
      for (let k = 0; k < n; k++) {
        const d = (k + 0.5) * total / n; let i = 1; while (i < cum.length - 1 && cum[i] < d) i++;
        const a = path[i-1], b = path[i], f = (d - cum[i-1]) / ((cum[i]-cum[i-1]) || 1);
        shots.push({ lat: a[0] + (b[0]-a[0])*f, lng: a[1] + (b[1]-a[1])*f, h: brg(a, b), d });
      }
      document.body.innerHTML = ''; document.body.style.cssText = 'margin:0;background:#fff;font:12px sans-serif';
      const head = document.createElement('div'); head.style.cssText = 'padding:6px;font:bold 14px sans-serif'; head.textContent = `${tid}: walk to ${dest.name} — ${leg.distance.text}, ${leg.duration.text}`; document.body.append(head);
      const grid = document.createElement('div'); grid.id = 'grid'; grid.style.cssText = 'display:grid;grid-template-columns:repeat(4,340px);gap:4px;padding:4px'; document.body.append(grid);
      const svs = new google.maps.StreetViewService();
      for (const s of shots) {
        const cell = document.createElement('div'); const cap = document.createElement('div'); const pano = document.createElement('div');
        pano.style.cssText = 'width:340px;height:210px;background:#ccc'; cap.textContent = `${Math.round(s.d)} m`;
        cell.append(pano, cap); grid.append(cell);
        try {
          const { data } = await svs.getPanorama({ location: { lat: s.lat, lng: s.lng }, radius: 40, source: google.maps.StreetViewSource.OUTDOOR });
          new google.maps.StreetViewPanorama(pano, { pano: data.location.pano, pov: { heading: s.h, pitch: -4 }, zoom: 0, disableDefaultUI: true, showRoadLabels: false });
          cap.textContent += ` · imagery ${data.imageDate || '?'}`;
        } catch (e) { pano.textContent = 'no Street View here'; }
      }
      return { dist: leg.distance.value, dur: leg.duration.value, n: shots.length, steps: leg.steps.map(s => s.instructions.replace(/<[^>]+>/g, ' ')).slice(0, 12) };
    }, { P: trips.P, dest: t.dest, tid: t.tid });
    await pg.waitForTimeout(6000);
    const file = path.join(out, `${id}__${t.tid}.png`);
    await pg.locator('body').screenshot({ path: file });
    meta.push({ trip: t.tid, dest: t.dest.name, walk_m: info.dist, walk_min: Math.round(info.dur / 60), frames: info.n, steps: info.steps, sheet: file });
    await pg.goto(`https://gangeli.github.io/ireland/property.html?p=${id}`); await pg.waitForTimeout(4000);
  }
  fs.writeFileSync(path.join(out, `${id}.json`), JSON.stringify(meta, null, 1));
  console.log(JSON.stringify(meta.map(m => [m.trip, m.dest, m.walk_m, m.walk_min])));
  await b.close();
})();
