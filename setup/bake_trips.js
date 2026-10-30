// Usage: node setup/bake_trips.js <property-id> [<property-id> ...]
// Resolves each house's trips once (Places search, drive route, walk and bike times) in a real browser under the
// site's own origin, so the referrer-locked key works, and writes them into properties/<id>.json as trip.resolved.
// Viewers then make no Places or Routes calls for trip cards; the page treats stored results as fresh for 30 days.
// Uses a persistent browser profile in $BAKE_PROFILE (default /tmp/house-days-bake) so re-runs reuse its cache.
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const ids = process.argv.slice(2);
const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json' };
(async () => {
  const ctx = await chromium.launchPersistentContext(process.env.BAKE_PROFILE || '/tmp/house-days-bake', { viewport: { width: 1280, height: 900 } });
  await ctx.route('https://gangeli.github.io/ireland/**', async (route) => {
    const u = new URL(route.request().url()); const f = path.join(ROOT, u.pathname.replace('/ireland/', '') || 'index.html');
    if (fs.existsSync(f) && fs.statSync(f).isFile()) return route.fulfill({ status: 200, body: fs.readFileSync(f), headers: { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' } });
    return route.continue();
  });
  // Start from an empty trip cache so a full localStorage can't silently drop results.
  { const pg = await ctx.newPage(); await pg.goto('https://gangeli.github.io/ireland/config.js').catch(() => {});
    await pg.evaluate(() => { for (const k of Object.keys(localStorage)) if (/^hd:v\d+:/.test(k)) localStorage.removeItem(k); }).catch(() => {}); await pg.close(); }
  for (const id of ids) {
    const file = path.join(ROOT, 'properties', id + '.json');
    const P = JSON.parse(fs.readFileSync(file, 'utf8'));
    const pg = await ctx.newPage();
    await pg.goto(`https://gangeli.github.io/ireland/property.html?p=${id}&live=1`, { timeout: 90000 });
    await pg.waitForFunction(() => [...document.querySelectorAll('.mins')].every((e) => e.textContent !== '–'), null, { timeout: 180000 }).catch(() => {});
    await pg.waitForTimeout(8000); // walk and bike times arrive just after each drive time
    const ls = await pg.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])));
    // Free this house's cache entries: localStorage holds ~5 MB, and once full the page can't cache (or bake) anything.
    await pg.evaluate((id) => { for (const k of Object.keys(localStorage)) if (k.includes(`:${id}:`)) localStorage.removeItem(k); }, id);
    await pg.close();
    const at = new Date().toISOString();
    let n = 0;
    for (const t of P.trips) {
      const pre = `:${id}:${t.id}:`;
      const pick = (want) => Object.entries(ls).filter(([k]) => k.includes(pre) && want(k)).map(([, v]) => JSON.parse(v)).sort((a, b) => b.ts - a.ts)[0];
      const drive = pick((k) => !k.includes(':act:') && !k.includes(':ride:'));
      if (!drive || !drive.dest) { console.warn(id, t.id, 'unresolved; left for live lookup'); continue; }
      const act = pick((k) => k.includes(':act:')) || {};
      t.resolved = {
        at, dest: drive.dest, duration: Math.round(drive.route.duration), distance: drive.route.distance, alts: drive.alts || [],
        walk: act.WALK ? { duration: Math.round(act.WALK.duration), distance: act.WALK.distance } : null,
        bike: act.BICYCLE ? { duration: Math.round(act.BICYCLE.duration), distance: act.BICYCLE.distance, ...(act.BICYCLE.est ? { est: true } : {}) } : null,
      };
      n++;
    }
    fs.writeFileSync(file, JSON.stringify(P, null, 2));
    console.log(id, `${n}/${P.trips.length} trips baked`);
  }
  await ctx.close();
})();
