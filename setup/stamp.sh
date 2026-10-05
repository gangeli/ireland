#!/usr/bin/env bash
# Stamp asset URLs with a fresh version so browsers never mix cached old JS/CSS with new HTML.
# Run before every commit that changes app.js, index.js, ratings.js, config.js or style.css.
set -euo pipefail
cd "$(dirname "$0")/.."
V="$(date -u +%Y%m%d%H%M%S)"
for f in index.html property.html; do
  sed -E -i.bak "s/\?v=[A-Za-z0-9]+\"/?v=$V\"/g" "$f" && rm -f "$f.bak"
done
echo "stamped v=$V"
