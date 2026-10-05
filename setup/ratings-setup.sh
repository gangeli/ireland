#!/usr/bin/env bash
# Idempotent setup for shared house ratings: Firestore + a tiny public Cloud Function.
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

# 1. APIs
say "Enabling APIs"
for s in firestore.googleapis.com cloudfunctions.googleapis.com run.googleapis.com \
         cloudbuild.googleapis.com artifactregistry.googleapis.com logging.googleapis.com; do
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
for role in roles/cloudbuild.builds.builder roles/datastore.user roles/logging.logWriter roles/artifactregistry.writer; do
  if gcloud projects get-iam-policy "$PROJECT" --flatten='bindings[].members' \
       --filter="bindings.role=$role AND bindings.members=serviceAccount:$SA" --format='value(bindings.role)' | grep -q .; then
    echo "   has $role"
  else
    say "Granting $role to $SA"
    ok=""
    for attempt in 1 2 3 4 5; do   # concurrent IAM edits return an etag conflict; retry with backoff
      if gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$SA" --role="$role" --condition=None >/dev/null 2>&1; then ok=1; break; fi
      sleep $((attempt * 3))
    done
    [[ -n "$ok" ]] || die "Couldn't grant $role after 5 tries; re-run in a minute"
  fi
done

# 4. Function source
SRC="$(mktemp -d)"
trap 'rm -rf "$SRC"' EXIT
cat > "$SRC/package.json" <<'EOF'
{
  "name": "house-days-ratings",
  "version": "1.0.0",
  "main": "index.js",
  "engines": { "node": ">=20" },
  "dependencies": {
    "@google-cloud/functions-framework": "^3.4.0",
    "@google-cloud/firestore": "^7.10.0"
  }
}
EOF
cat > "$SRC/index.js" <<'EOF'
// Shared ratings for the House Days site. Open by design: no auth.
// GET  -> { ratings: [{ property, person, stars, note, updated }] }
// POST -> body (JSON, sent as text/plain) { property, person, stars 1-5, note } upserts one
//         person's rating of one property; { property, person, delete: true } removes it.
const functions = require("@google-cloud/functions-framework");
const { Firestore } = require("@google-cloud/firestore");
const db = new Firestore();
const col = db.collection("ratings");
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

functions.http("ratings", async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  res.set("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).send("");
  try {
    if (req.method === "GET") {
      const snap = await col.limit(5000).get();
      return res.json({ ratings: snap.docs.map((d) => d.data()) });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "GET or POST" });
    let b = req.body;
    if (typeof b === "string") b = JSON.parse(b || "{}");
    if (Buffer.isBuffer(b)) b = JSON.parse(b.toString("utf8") || "{}");
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

# 6. Smoke test
say "Testing $URL"
if curl -fsS "$URL" | grep -q '"ratings"'; then
  say "Ratings endpoint is live"
else
  warn "The endpoint didn't answer as expected; check: gcloud functions logs read $FN --gen2 --region=$REGION --project=$PROJECT"
fi
say "Done. Ratings URL: $URL"
