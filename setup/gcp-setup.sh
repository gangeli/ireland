#!/usr/bin/env bash
# Idempotent Google Cloud setup for the House Days site.
# Safe to re-run: every step checks current state before changing anything.
#
#   PROJECT=ireland-7844 ./setup/gcp-setup.sh
#   BILLING=XXXXXX-XXXXXX-XXXXXX ./setup/gcp-setup.sh   # pin a billing account
#
# Prints the browser key at the end and writes it to config.js.
set -euo pipefail

PROJECT="${PROJECT:-ireland-7844}"
KEY_NAME="house-days browser key"
BUDGET_NAME="house-days"
BUDGET_AMOUNT="${BUDGET_AMOUNT:-25USD}"
REFERRERS="https://gangeli.github.io/*,http://localhost:*/*"
SERVICES=(
  maps-backend.googleapis.com          # Maps JavaScript API
  street-view-image-backend.googleapis.com
  routes.googleapis.com
  places.googleapis.com                # Places API (New)
  directions-backend.googleapis.com    # legacy fallback; may refuse on new projects
)
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

say()  { printf '\033[1;32m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!! \033[0m %s\n' "$*"; }
die()  { printf '\033[1;31mxx \033[0m %s\n' "$*"; exit 1; }

command -v gcloud >/dev/null || die "gcloud not found"
gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q . || die "run: gcloud auth login"

# 1. Project
if gcloud projects describe "$PROJECT" >/dev/null 2>&1; then
  say "Project $PROJECT exists"
else
  say "Creating project $PROJECT"
  gcloud projects create "$PROJECT"
fi

# 2. Billing: must be linked to an OPEN account
if [[ -z "${BILLING:-}" ]]; then
  BILLING="$(gcloud billing accounts list --filter='open=true' --format='value(name.basename())' | head -n1)"
fi
if [[ -z "$BILLING" ]]; then
  gcloud billing accounts list
  die "No open billing account. Open or create one at https://console.cloud.google.com/billing, then re-run."
fi
OPEN="$(gcloud billing accounts describe "$BILLING" --format='value(open)')"
[[ "$OPEN" == "True" ]] || die "Billing account $BILLING is closed. Pick an open one with BILLING=..."

CURRENT="$(gcloud billing projects describe "$PROJECT" --format='value(billingAccountName.basename())')"
ENABLED="$(gcloud billing projects describe "$PROJECT" --format='value(billingEnabled)')"
if [[ "$CURRENT" == "$BILLING" && "$ENABLED" == "True" ]]; then
  say "Billing already linked to $BILLING"
else
  say "Linking billing account $BILLING"
  gcloud billing projects link "$PROJECT" --billing-account="$BILLING" >/dev/null
fi

# 3. APIs (enable is a no-op when already on)
say "Enabling APIs"
gcloud services enable --project="$PROJECT" apikeys.googleapis.com billingbudgets.googleapis.com
for s in "${SERVICES[@]}"; do
  if gcloud services enable "$s" --project="$PROJECT" >/dev/null 2>&1; then
    echo "   on: $s"
  else
    warn "could not enable $s (fine for the legacy Directions API)"
  fi
done

# 4. Browser key: create once, then keep its restrictions in sync
TARGETS=()
for s in "${SERVICES[@]}"; do TARGETS+=("--api-target=service=$s"); done
KEY_RES="$(gcloud services api-keys list --project="$PROJECT" \
  --filter="displayName='$KEY_NAME'" --format='value(name)' | head -n1)"
if [[ -n "$KEY_RES" ]]; then
  say "Key exists, syncing restrictions"
  gcloud services api-keys update "$KEY_RES" --project="$PROJECT" \
    --allowed-referrers="$REFERRERS" "${TARGETS[@]}" >/dev/null
else
  say "Creating browser key"
  gcloud services api-keys create --project="$PROJECT" --display-name="$KEY_NAME" \
    --allowed-referrers="$REFERRERS" "${TARGETS[@]}" >/dev/null
  KEY_RES="$(gcloud services api-keys list --project="$PROJECT" \
    --filter="displayName='$KEY_NAME'" --format='value(name)' | head -n1)"
fi
KEY_STRING="$(gcloud services api-keys get-key-string "$KEY_RES" --format='value(keyString)')"

# 5. Budget alert
EXISTING_BUDGET="$(gcloud billing budgets list --billing-account="$BILLING" \
  --filter="displayName='$BUDGET_NAME'" --format='value(name)' 2>/dev/null | head -n1 || true)"
if [[ -n "$EXISTING_BUDGET" ]]; then
  say "Budget '$BUDGET_NAME' exists"
else
  say "Creating $BUDGET_AMOUNT budget with alerts at 50% and 100%"
  gcloud billing budgets create --billing-account="$BILLING" \
    --display-name="$BUDGET_NAME" --budget-amount="$BUDGET_AMOUNT" \
    --filter-projects="projects/$PROJECT" \
    --threshold-rule=percent=0.5 --threshold-rule=percent=1.0 >/dev/null \
    || warn "Budget creation failed; set one in the console under Billing > Budgets"
fi

# 6. Write config.js
if [[ -f "$REPO_ROOT/config.js" ]] && grep -q "$KEY_STRING" "$REPO_ROOT/config.js"; then
  say "config.js already has this key"
else
  cat > "$REPO_ROOT/config.js" <<EOF
// Browser key, restricted by HTTP referrer to gangeli.github.io and localhost,
// and to the Maps JS, Street View Static, Routes, Places and Directions APIs.
window.HOUSE_DAYS_KEY = "$KEY_STRING";
// Which property to show when the URL has no ?p= parameter.
window.HOUSE_DAYS_DEFAULT = "forty-shades";
EOF
  say "Wrote config.js (commit and push it)"
fi

say "Done. Project $PROJECT, billing $BILLING, key $KEY_STRING"
