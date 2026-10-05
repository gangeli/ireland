#!/usr/bin/env bash
# Idempotent setup for shared house ratings and new-listing alerts: Firestore, a tiny public
# Cloud Function, and a Cloud Scheduler job that checks the shortlist every 30 minutes.
# No auth on purpose: anyone with the site can read and post ratings (with a name).
# Safe to re-run: skips what exists, redeploys the function only when its code changes.
#
#   bash ratings-setup.sh
set -euo pipefail
export CLOUDSDK_CORE_DISABLE_PROMPTS=1

PROJECT="${PROJECT:-ireland-7844}"
REGION="${REGION:-us-central1}"          # Cloud Function region
DB_LOCATION="${DB_LOCATION:-nam5}"       # Firestore location (nam5 = US multi-region)
FN="house-days-ratings"

say()  { printf '\033[1;32m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!! \033[0m %s\n' "$*"; }
die()  { printf '\033[1;31mxx \033[0m %s\n' "$*"; exit 1; }
trap 'warn "Stopped at line $LINENO: $BASH_COMMAND"' ERR

command -v gcloud >/dev/null || die "gcloud not found"
gcloud projects describe "$PROJECT" >/dev/null 2>&1 || die "Project $PROJECT not found; run the main setup first"
[[ "$(gcloud billing projects describe "$PROJECT" --format='value(billingEnabled)')" == "True" ]] \
  || die "Billing isn't enabled on $PROJECT; run the main setup first"
NUM="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"

# Bill API quota to this project instead of gcloud's shared default client project, whose
# per-minute read quota is shared by everyone and runs out (RESOURCE_EXHAUSTED on get-iam-policy).
gcloud services enable cloudresourcemanager.googleapis.com serviceusage.googleapis.com --project="$PROJECT" >/dev/null 2>&1 || true
export CLOUDSDK_BILLING_QUOTA_PROJECT="$PROJECT"
gcloud projects describe "$PROJECT" >/dev/null 2>&1 || unset CLOUDSDK_BILLING_QUOTA_PROJECT   # fall back if not allowed yet

# Retry a gcloud command on quota / etag / transient errors, with backoff.
retry() { local n; for n in 1 2 3 4 5 6; do "$@" && return 0; sleep $((n * 5)); done; return 1; }

# 1. APIs
say "Enabling APIs"
for s in firestore.googleapis.com cloudfunctions.googleapis.com run.googleapis.com \
         cloudbuild.googleapis.com artifactregistry.googleapis.com logging.googleapis.com \
         cloudscheduler.googleapis.com; do
  printf '   %-40s ' "$s"
  if gcloud services enable "$s" --project="$PROJECT" >/dev/null 2>&1; then echo on; else echo FAILED; fi
done

# 2. Firestore database
HAVE_LOC="$(gcloud firestore databases describe --database='(default)' --project="$PROJECT" --format='value(locationId)' 2>/dev/null || true)"
if [[ -z "$HAVE_LOC" ]]; then
  say "Creating Firestore database in $DB_LOCATION"
  gcloud firestore databases create --location="$DB_LOCATION" --type=firestore-native --project="$PROJECT" >/dev/null \
    || die "Couldn't create the database. If you just deleted one, Google can take a few minutes to free the name; wait and re-run."
elif [[ "$HAVE_LOC" != "$DB_LOCATION" ]]; then
  die "The Firestore database is in $HAVE_LOC, not $DB_LOCATION. A database can't be moved. If it holds nothing you need, delete it with:
     gcloud firestore databases delete --database='(default)' --project=$PROJECT
   then re-run this script."
else
  say "Firestore database exists in $DB_LOCATION"
fi

# 3. Permissions for the default compute service account (builds the function and runs it)
SA="${NUM}-compute@developer.gserviceaccount.com"
# Read the policy once (not once per role), retrying if the quota is briefly exhausted.
POLICY=""
for n in 1 2 3 4 5 6; do
  POLICY="$(gcloud projects get-iam-policy "$PROJECT" --flatten='bindings[].members' \
    --filter="bindings.members=serviceAccount:$SA" --format='value(bindings.role)' 2>/dev/null)" && break
  POLICY="?"; warn "Couldn't read the IAM policy (quota?); retrying in $((n * 5))s"; sleep $((n * 5))
done
for role in roles/cloudbuild.builds.builder roles/datastore.user roles/logging.logWriter roles/artifactregistry.writer; do
  if [[ "$POLICY" != "?" ]] && grep -qx "$role" <<<"$POLICY"; then
    echo "   has $role"
  else
    say "Granting $role to $SA"   # idempotent: adding an existing binding is a no-op
    retry gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$SA" --role="$role" --condition=None >/dev/null 2>&1 \
      || die "Couldn't grant $role after several tries; wait a minute and re-run"
  fi
done

# 4. Function source
SRC="$(mktemp -d)"
trap 'rm -rf "$SRC"' EXIT
cat > "$SRC/package.json" <<'EOF'
{
  "name": "house-days-ratings",
  "version": "1.1.0",
  "main": "index.js",
  "engines": { "node": ">=20" },
  "dependencies": {
    "@google-cloud/functions-framework": "^3.4.0",
    "@google-cloud/firestore": "^7.10.0",
    "web-push": "^3.6.7"
  }
}
EOF
cat > "$SRC/index.js" <<'EOF'
// Shared ratings + new-listing alerts for the House Days site. Open by design: no auth.
// Ratings
//   GET                      -> { ratings: [{ property, person, stars, note, updated }] }
//   POST { property, person, stars 1-5, note }   upserts one person's rating of one property
//   POST { property, person, delete: true }      removes it
// Alerts (Web Push)
//   GET  ?action=vapid       -> { key }  public VAPID key for pushManager.subscribe
//   POST { action:"subscribe", sub, person }     stores a push subscription
//   POST { action:"unsubscribe", endpoint }      removes it
//   POST { action:"test", endpoint }             sends a test alert to that one subscription
//   GET  ?action=check       compares the live shortlist with every house seen before and alerts all
//                            subscribers about new ones. Cloud Scheduler calls it; harmless to call by hand.
// POST bodies are JSON sent as text/plain so browsers skip the CORS preflight.
const functions = require("@google-cloud/functions-framework");
const { Firestore } = require("@google-cloud/firestore");
const webpush = require("web-push");
const crypto = require("crypto");
const db = new Firestore();
const col = db.collection("ratings");
const subs = db.collection("push");
const meta = db.collection("meta");
const SITE = "https://gangeli.github.io/ireland/";
const RAW = "https://raw.githubusercontent.com/gangeli/ireland/main/properties/";
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const hash = (s) => crypto.createHash("sha256").update(String(s)).digest("hex").slice(0, 32);

let keysCache = null;
async function vapid() {
  if (!keysCache) {
    const ref = meta.doc("vapid");
    const got = await ref.get();
    keysCache = got.exists ? got.data() : null;
    if (!keysCache) { keysCache = webpush.generateVAPIDKeys(); await ref.set(keysCache); }
  }
  webpush.setVapidDetails("mailto:house-days@users.noreply.github.com", keysCache.publicKey, keysCache.privateKey);
  return keysCache;
}
async function send(doc, payload) {
  try { await webpush.sendNotification(doc.data().sub, JSON.stringify(payload), { TTL: 86400 }); return true; }
  catch (e) {
    if (e.statusCode === 404 || e.statusCode === 410) await doc.ref.delete(); // subscription expired
    else console.error("push failed", e.statusCode, e.body);
    return false;
  }
}
const getJSON = async (u) => { const r = await fetch(u + "?t=" + Date.now()); if (!r.ok) throw new Error(u + " " + r.status); return r.json(); };
const euro = (n) => (n ? "€" + Math.round(n / 1000) + "k" : "");

async function check() {
  await vapid();
  const idx = await getJSON(RAW + "index.json");
  const ids = idx.properties || [];
  const ref = meta.doc("seen");
  const got = await ref.get();
  if (!got.exists) { await ref.set({ ids, updated: new Date().toISOString() }); return { baseline: ids.length }; }
  const seen = new Set(got.data().ids || []);
  const fresh = ids.filter((i) => !seen.has(i));
  if (!fresh.length) return { fresh: 0 };
  await ref.set({ ids: [...new Set([...seen, ...ids])], updated: new Date().toISOString() });
  const houses = [];
  for (const id of fresh) {
    try { const d = await getJSON(RAW + id + ".json"); houses.push({ id, name: d.name, area: d.area, price: d.price }); }
    catch { houses.push({ id, name: id }); }
  }
  const h = houses[0];
  const payload = houses.length === 1
    ? { title: "New on the shortlist: " + h.name, body: [h.area, euro(h.price)].filter(Boolean).join(" · "), url: SITE + "property.html?p=" + h.id, tag: "new-" + h.id }
    : { title: houses.length + " new houses on the shortlist", body: houses.map((x) => x.name).join(", "), url: SITE + "?new=" + fresh.join(","), tag: "new-batch" };
  const all = await subs.get();
  let sent = 0;
  for (const d of all.docs) if (await send(d, payload)) sent++;
  return { fresh: fresh.length, sent };
}

functions.http("ratings", async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  res.set("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).send("");
  try {
    if (req.method === "GET") {
      const action = String(req.query.action || "");
      if (action === "vapid") return res.json({ key: (await vapid()).publicKey });
      if (action === "check") return res.json(await check());
      const snap = await col.limit(5000).get();
      return res.json({ ratings: snap.docs.map((d) => d.data()) });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "GET or POST" });
    let b = req.body;
    if (Buffer.isBuffer(b)) b = b.toString("utf8");
    if (typeof b === "string") b = JSON.parse(b || "{}");
    b = b || {};
    if (b.action === "subscribe") {
      const sub = b.sub || {};
      if (!/^https:\/\//.test(sub.endpoint || "") || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) return res.status(400).json({ error: "bad subscription" });
      await subs.doc(hash(sub.endpoint)).set({
        sub: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
        person: String(b.person || "").slice(0, 40), created: new Date().toISOString(),
      });
      return res.json({ ok: true });
    }
    if (b.action === "unsubscribe") { await subs.doc(hash(b.endpoint || "")).delete(); return res.json({ ok: true }); }
    if (b.action === "test") {
      await vapid();
      const d = await subs.doc(hash(b.endpoint || "")).get();
      if (!d.exists) return res.status(404).json({ error: "not subscribed" });
      const ok = await send(d, { title: "Alerts are on", body: "This browser will hear about new houses on the shortlist.", url: SITE, tag: "test" });
      return res.json({ ok });
    }
    const property = String(b.property || "");
    const person = String(b.person || "").trim().slice(0, 40);
    if (!/^[a-z0-9-]{1,80}$/.test(property)) return res.status(400).json({ error: "property must be a page id" });
    if (!person || !slug(person)) return res.status(400).json({ error: "person needs a name" });
    const id = `${property}__${slug(person)}`;
    if (b.delete) { await col.doc(id).delete(); return res.json({ ok: true, deleted: id }); }
    const stars = Number(b.stars);
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) return res.status(400).json({ error: "stars must be 1-5" });
    const rating = { property, person, stars, note: String(b.note || "").slice(0, 600), updated: new Date().toISOString() };
    await col.doc(id).set(rating);
    return res.json({ ok: true, rating });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "server error" });
  }
});
EOF
HASH="$(cat "$SRC/package.json" "$SRC/index.js" | shasum | cut -c1-12)"

# 5. Deploy (only when the code changed)
CURRENT_HASH="$(gcloud functions describe "$FN" --gen2 --region="$REGION" --project="$PROJECT" \
  --format='value(labels.src)' 2>/dev/null || true)"
if [[ "$CURRENT_HASH" == "$HASH" ]]; then
  say "Function $FN is up to date"
else
  say "Deploying $FN (takes 2–3 minutes the first time)"
  gcloud functions deploy "$FN" --gen2 --project="$PROJECT" --region="$REGION" \
    --runtime=nodejs20 --source="$SRC" --entry-point=ratings --trigger-http \
    --allow-unauthenticated --memory=256Mi --max-instances=3 \
    --update-labels="src=$HASH" >/dev/null
fi

URL="$(gcloud functions describe "$FN" --gen2 --region="$REGION" --project="$PROJECT" --format='value(serviceConfig.uri)')"

# 6. Alerts: check the shortlist for new houses every 30 minutes (Cloud Scheduler; the free tier covers it)
JOB="house-days-alerts"
if gcloud scheduler jobs describe "$JOB" --location="$REGION" --project="$PROJECT" >/dev/null 2>&1; then
  gcloud scheduler jobs update http "$JOB" --location="$REGION" --project="$PROJECT" \
    --schedule="*/30 * * * *" --uri="$URL?action=check" --http-method=GET >/dev/null && say "Alert schedule is up to date"
else
  say "Scheduling the new-listing check every 30 minutes"
  gcloud scheduler jobs create http "$JOB" --location="$REGION" --project="$PROJECT" \
    --schedule="*/30 * * * *" --uri="$URL?action=check" --http-method=GET --time-zone="Etc/UTC" >/dev/null \
    || warn "Couldn't create the scheduler job; alerts then go out only when $URL?action=check is opened"
fi

# 7. Smoke test
say "Testing $URL"
if curl -fsS "$URL" | grep -q '"ratings"'; then
  say "Ratings endpoint is live"
else
  warn "The endpoint didn't answer as expected; check: gcloud functions logs read $FN --gen2 --region=$REGION --project=$PROJECT"
fi
if curl -fsS "$URL?action=vapid" | grep -q '"key"'; then say "Alerts endpoint is live"; else warn "The alerts endpoint didn't answer; see the function logs"; fi
curl -fsS "$URL?action=check" >/dev/null || true   # the first check records today's shortlist as the baseline
say "Done. Ratings URL: $URL"
